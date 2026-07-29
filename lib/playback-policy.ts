export interface PlaybackPolicyInput {
  publicationEligible: boolean;
  authPending: boolean;
  signedIn: boolean;
  emailVerified: boolean;
  voteStateReady: boolean;
  hasCurrentVote: boolean;
  hasWatchSession: boolean;
  watchSessionUnavailable: boolean;
}

export interface PlaybackPolicy {
  canTrackWatch: boolean;
  gatePending: boolean;
  playbackAllowed: boolean;
  needsWatchSession: boolean;
}

export type WatchSessionErrorDisposition = "reset" | "retry";

const TERMINAL_WATCH_SESSION_CODES = new Set([
  "INVALID_SESSION_ID",
  "WATCH_SESSION_NOT_FOUND",
  "WATCH_SESSION_EXPIRED",
  "VIDEO_CHANGED",
  "INVALID_STATEMENT_ID",
  "STATEMENT_NOT_FOUND",
  "STATEMENT_NOT_ELIGIBLE",
  "VIDEO_NOT_ELIGIBLE",
  "AUTH_REQUIRED",
  "EMAIL_NOT_VERIFIED",
  "ACCOUNT_BANNED",
]);

/**
 * Terminal errors mean the current receipt path can never recover. Conflicts,
 * throttling, network failures, and malformed transient responses retain the
 * session so the serialized heartbeat loop can retry.
 */
export function watchSessionErrorDisposition(
  code: string | null | undefined
): WatchSessionErrorDisposition {
  return code && TERMINAL_WATCH_SESSION_CODES.has(code) ? "reset" : "retry";
}

export type BallotNavigationKey =
  | "ArrowLeft"
  | "ArrowRight"
  | "ArrowUp"
  | "ArrowDown"
  | "Home"
  | "End";

export function nextBallotIndex(
  currentIndex: number,
  key: string,
  optionCount: number
): number | null {
  if (
    !Number.isSafeInteger(currentIndex) ||
    !Number.isSafeInteger(optionCount) ||
    optionCount < 1 ||
    currentIndex < 0 ||
    currentIndex >= optionCount
  ) {
    return null;
  }
  if (key === "Home") return 0;
  if (key === "End") return optionCount - 1;
  if (key === "ArrowRight" || key === "ArrowDown") {
    return (currentIndex + 1) % optionCount;
  }
  if (key === "ArrowLeft" || key === "ArrowUp") {
    return (currentIndex - 1 + optionCount) % optionCount;
  }
  return null;
}

/**
 * Only a verified, eligible viewer who has not voted needs a watch session.
 * Everyone else may watch normally; an eligible viewer's unresolved identity
 * or vote lookup stays closed until we know which side of that boundary they
 * belong to.
 */
export function resolvePlaybackPolicy(
  input: PlaybackPolicyInput
): PlaybackPolicy {
  const verifiedViewer = input.signedIn && input.emailVerified;
  const canTrackWatch =
    input.publicationEligible &&
    verifiedViewer &&
    !input.hasCurrentVote;
  const gatePending =
    input.publicationEligible &&
    (input.authPending || (verifiedViewer && !input.voteStateReady));
  const playbackAllowed =
    !gatePending &&
    (!canTrackWatch ||
      input.hasWatchSession ||
      input.watchSessionUnavailable);

  return {
    canTrackWatch,
    gatePending,
    playbackAllowed,
    needsWatchSession:
      !gatePending &&
      canTrackWatch &&
      !input.hasWatchSession &&
      !input.watchSessionUnavailable,
  };
}
