/**
 * The public rating model.
 *
 * Raw ballots stay discrete and equally weighted. The editorial seed is a
 * frozen Bayesian prior, so a new entry cannot jump to the top after one vote
 * and the community steadily takes control as valid ballots accumulate.
 */

export const VOTE_VALUES = [0, 25, 50, 75, 100] as const;
export type VoteValue = (typeof VOTE_VALUES)[number];

export const RATING_MODEL_VERSION = 1;
export const RATING_PRIOR_STRENGTH = 10;

export interface RatingInput {
  priorPerformance: number;
  priorStrength?: number;
  validVoteCount: number;
  validVoteSum: number;
}

export interface RatingResult {
  modelVersion: number;
  priorPerformance: number;
  priorStrength: number;
  validVoteCount: number;
  validVoteSum: number;
  performance: number;
  gp: number;
}

export class RatingCalculationError extends Error {
  readonly code = "INVALID_RATING_INPUT";

  constructor(message: string) {
    super(message);
    this.name = "RatingCalculationError";
  }
}

export function isVoteValue(value: unknown): value is VoteValue {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    (VOTE_VALUES as readonly number[]).includes(value)
  );
}

function finiteInRange(value: number, low: number, high: number, name: string): number {
  if (!Number.isFinite(value) || value < low || value > high) {
    throw new RatingCalculationError(`${name} must be between ${low} and ${high}.`);
  }
  return value;
}

function nonNegativeInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RatingCalculationError(`${name} must be a non-negative safe integer.`);
  }
  return value;
}

export function performanceFromGp(gp: number): number {
  if (!Number.isFinite(gp)) {
    throw new RatingCalculationError("GP must be finite.");
  }
  return Math.min(100, Math.max(0, (gp - 1000) / 10));
}

export function calculateRating(input: RatingInput): RatingResult {
  const priorPerformance = finiteInRange(
    input.priorPerformance,
    0,
    100,
    "Prior performance"
  );
  const priorStrength = nonNegativeInteger(
    input.priorStrength ?? RATING_PRIOR_STRENGTH,
    "Prior strength"
  );
  const validVoteCount = nonNegativeInteger(input.validVoteCount, "Valid vote count");
  const validVoteSum = nonNegativeInteger(input.validVoteSum, "Valid vote sum");

  if (validVoteSum > validVoteCount * 100) {
    throw new RatingCalculationError("Valid vote sum exceeds the maximum possible total.");
  }

  const denominator = priorStrength + validVoteCount;
  if (denominator <= 0) {
    throw new RatingCalculationError("A rating needs a prior or at least one valid vote.");
  }

  const performance =
    (priorStrength * priorPerformance + validVoteSum) / denominator;

  return {
    modelVersion: RATING_MODEL_VERSION,
    priorPerformance,
    priorStrength,
    validVoteCount,
    validVoteSum,
    performance,
    gp: Math.round(1000 + performance * 10),
  };
}

// Watch-progress maths lives here so it can be unit tested without importing
// the server-only database store.
export const WATCH_REQUIRED_SHARE = 0.9;
export const WATCH_HEARTBEAT_MAX_GAP_MS = 20_000;
export const WATCH_HEARTBEAT_MIN_WRITE_INTERVAL_MS = 2_000;
export const WATCH_SEEK_TOLERANCE_MS = 2_000;
export const WATCH_END_TOLERANCE_MS = 1_500;

export interface WatchProgressState {
  clipStartMs: number;
  clipEndMs: number;
  contiguousThroughMs: number;
  creditedWatchMs: number;
  lastPositionMs: number;
  lastHeartbeatAtMs: number;
  reachedEnd: boolean;
}

export interface WatchHeartbeatSample {
  positionMs: number;
  heartbeatAtMs: number;
  playing: boolean;
  visible: boolean;
}

export interface WatchProgressResult extends WatchProgressState {
  creditedThisHeartbeatMs: number;
  seekDetected: boolean;
}

function finiteMilliseconds(value: number, name: string): number {
  if (!Number.isFinite(value)) {
    throw new RatingCalculationError(`${name} must be finite.`);
  }
  return Math.round(value);
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

export function watchHeartbeatWriteIsDue(
  previousHeartbeatAtMs: number,
  heartbeatAtMs: number
): boolean {
  const previous = finiteMilliseconds(previousHeartbeatAtMs, "Previous heartbeat time");
  const current = finiteMilliseconds(heartbeatAtMs, "Heartbeat time");
  if (current < previous) {
    throw new RatingCalculationError("Heartbeat time cannot move backwards.");
  }
  return current - previous >= WATCH_HEARTBEAT_MIN_WRITE_INTERVAL_MS;
}

/**
 * Advance unique contiguous watch coverage using server wall-clock time.
 *
 * Replaying an already-covered section earns no extra time. A forward seek
 * creates a gap and cannot advance coverage until playback returns to the
 * covered boundary. The browser may report state, but it cannot report its own
 * elapsed time or accumulated credit.
 */
export function calculateWatchProgress(
  state: WatchProgressState,
  sample: WatchHeartbeatSample
): WatchProgressResult {
  const clipStartMs = finiteMilliseconds(state.clipStartMs, "Clip start");
  const clipEndMs = finiteMilliseconds(state.clipEndMs, "Clip end");
  if (clipStartMs < 0 || clipEndMs <= clipStartMs) {
    throw new RatingCalculationError("The clip must have valid start and end points.");
  }

  const previousHeartbeatAtMs = finiteMilliseconds(
    state.lastHeartbeatAtMs,
    "Previous heartbeat time"
  );
  const heartbeatAtMs = finiteMilliseconds(sample.heartbeatAtMs, "Heartbeat time");
  if (heartbeatAtMs < previousHeartbeatAtMs) {
    throw new RatingCalculationError("Heartbeat time cannot move backwards.");
  }

  const previousPositionMs = clamp(
    finiteMilliseconds(state.lastPositionMs, "Previous playback position"),
    clipStartMs,
    clipEndMs
  );
  const positionMs = clamp(
    finiteMilliseconds(sample.positionMs, "Playback position"),
    clipStartMs,
    clipEndMs
  );
  const oldContiguousThroughMs = clamp(
    finiteMilliseconds(state.contiguousThroughMs, "Contiguous watch position"),
    clipStartMs,
    clipEndMs
  );
  const oldCreditedWatchMs = clamp(
    finiteMilliseconds(state.creditedWatchMs, "Credited watch time"),
    0,
    clipEndMs - clipStartMs
  );

  const elapsedMs = Math.min(
    WATCH_HEARTBEAT_MAX_GAP_MS,
    heartbeatAtMs - previousHeartbeatAtMs
  );
  const positionAdvanceMs = positionMs - previousPositionMs;
  const jumpedForward =
    positionAdvanceMs > elapsedMs + WATCH_SEEK_TOLERANCE_MS;
  const startsBeyondCoveredBoundary =
    previousPositionMs > oldContiguousThroughMs + WATCH_SEEK_TOLERANCE_MS;
  const seekDetected = jumpedForward || startsBeyondCoveredBoundary;

  let contiguousThroughMs = oldContiguousThroughMs;
  if (
    sample.playing &&
    sample.visible &&
    positionAdvanceMs > 0 &&
    !seekDetected
  ) {
    // Never turn per-request clock jitter into watch credit. A fixed allowance
    // here compounds across rapid scripted heartbeats and lets a client earn
    // minutes of coverage in seconds. Server elapsed time is the hard ceiling.
    const wallClockLimitedAdvance = Math.min(positionAdvanceMs, elapsedMs);
    const candidate = Math.min(
      positionMs,
      oldContiguousThroughMs + wallClockLimitedAdvance
    );
    contiguousThroughMs = Math.max(oldContiguousThroughMs, candidate);
  }

  const creditedWatchMs = Math.max(
    oldCreditedWatchMs,
    contiguousThroughMs - clipStartMs
  );
  const creditedThisHeartbeatMs = creditedWatchMs - oldCreditedWatchMs;
  const reachedEnd =
    state.reachedEnd || positionMs >= clipEndMs - WATCH_END_TOLERANCE_MS;

  return {
    clipStartMs,
    clipEndMs,
    contiguousThroughMs,
    creditedWatchMs,
    lastPositionMs: positionMs,
    lastHeartbeatAtMs: heartbeatAtMs,
    reachedEnd,
    creditedThisHeartbeatMs,
    seekDetected,
  };
}

export function requiredWatchMilliseconds(clipStartMs: number, clipEndMs: number): number {
  const start = finiteMilliseconds(clipStartMs, "Clip start");
  const end = finiteMilliseconds(clipEndMs, "Clip end");
  if (start < 0 || end <= start) {
    throw new RatingCalculationError("The clip must have valid start and end points.");
  }
  return Math.ceil((end - start) * WATCH_REQUIRED_SHARE);
}
