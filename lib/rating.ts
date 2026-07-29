/**
 * The public rating model.
 *
 * Raw ballots stay discrete and equally weighted. Public performance is the
 * exact arithmetic mean of valid ballots; editorial scoring never changes a
 * public result. Entries remain unranked until ten valid rulings, which is the
 * stability boundary instead of a hidden prior.
 */

export const VOTE_VALUES = [0, 25, 50, 75, 100] as const;
export type VoteValue = (typeof VOTE_VALUES)[number];

export const RATING_MODEL_VERSION = 2;
/** Retained in persisted aggregate rows for backwards-compatible shape. */
export const RATING_PRIOR_STRENGTH = 0;
export const PUBLIC_EMPTY_PERFORMANCE = 50;

export interface RatingInput {
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

function nonNegativeInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RatingCalculationError(`${name} must be a non-negative safe integer.`);
  }
  return value;
}

export function calculateRating(input: RatingInput): RatingResult {
  const validVoteCount = nonNegativeInteger(input.validVoteCount, "Valid vote count");
  const validVoteSum = nonNegativeInteger(input.validVoteSum, "Valid vote sum");

  if (validVoteSum > validVoteCount * 100) {
    throw new RatingCalculationError("Valid vote sum exceeds the maximum possible total.");
  }

  const performance =
    validVoteCount === 0
      ? PUBLIC_EMPTY_PERFORMANCE
      : validVoteSum / validVoteCount;

  return {
    modelVersion: RATING_MODEL_VERSION,
    priorPerformance: PUBLIC_EMPTY_PERFORMANCE,
    priorStrength: RATING_PRIOR_STRENGTH,
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
  /** Whether playback was active at the preceding server sample. */
  lastPlaying: boolean;
  /** Whether the page was visible at the preceding server sample. */
  lastVisible: boolean;
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
  // A pause/visibility heartbeat describes the state at the end of the
  // preceding interval. If that interval began while playback was active and
  // visible, close its final natural advance before recording the paused
  // baseline. Otherwise the later paused position gets stored ahead of the
  // contiguous boundary and every heartbeat after resume looks like a seek.
  const intervalCanEarnCredit =
    (state.lastPlaying && state.lastVisible) ||
    (sample.playing && sample.visible);

  let contiguousThroughMs = oldContiguousThroughMs;
  if (
    intervalCanEarnCredit &&
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
  // An inactive sample must leave the next comparison at the verified
  // contiguous boundary. This also covers a user who pauses before the first
  // periodic "playing" heartbeat: storing the later paused media position
  // would make every resumed sample appear to start beyond verified coverage.
  const lastPositionMs =
    sample.playing && sample.visible ? positionMs : contiguousThroughMs;
  // A reported position near the end is not proof that playback reached it:
  // the user may have dragged the scrubber there while paused or hidden. The
  // monotonic contiguous boundary is the stronger source of truth. Deriving
  // this flag afresh also repairs unfinished sessions created before this rule.
  const reachedEnd =
    contiguousThroughMs >= clipEndMs - WATCH_END_TOLERANCE_MS;

  return {
    clipStartMs,
    clipEndMs,
    contiguousThroughMs,
    creditedWatchMs,
    lastPositionMs,
    lastHeartbeatAtMs: heartbeatAtMs,
    lastPlaying: sample.playing,
    lastVisible: sample.visible,
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
