import assert from "node:assert/strict";
import test from "node:test";
import { createLatestTaskQueue } from "../lib/latest-task-queue";
import {
  nextBallotIndex,
  resolvePlaybackPolicy,
  watchSessionErrorDisposition,
} from "../lib/playback-policy";

test("only verified, eligible, unvoted viewers wait for a watch session", () => {
  const base = {
    publicationEligible: true,
    authPending: false,
    signedIn: true,
    emailVerified: true,
    voteStateReady: true,
    hasCurrentVote: false,
    hasWatchSession: false,
    watchSessionUnavailable: false,
  };

  assert.deepEqual(resolvePlaybackPolicy(base), {
    canTrackWatch: true,
    gatePending: false,
    playbackAllowed: false,
    needsWatchSession: true,
  });
  assert.equal(
    resolvePlaybackPolicy({ ...base, hasWatchSession: true }).playbackAllowed,
    true
  );
  assert.equal(
    resolvePlaybackPolicy({ ...base, hasCurrentVote: true }).playbackAllowed,
    true
  );
  assert.equal(
    resolvePlaybackPolicy({
      ...base,
      signedIn: false,
      emailVerified: false,
    }).playbackAllowed,
    true
  );
  assert.equal(
    resolvePlaybackPolicy({ ...base, emailVerified: false }).playbackAllowed,
    true
  );
  assert.equal(
    resolvePlaybackPolicy({ ...base, publicationEligible: false })
      .playbackAllowed,
    true
  );
});

test("eligible playback waits while identity or vote state is unresolved", () => {
  const pendingIdentity = resolvePlaybackPolicy({
    publicationEligible: true,
    authPending: true,
    signedIn: false,
    emailVerified: false,
    voteStateReady: false,
    hasCurrentVote: false,
    hasWatchSession: false,
    watchSessionUnavailable: false,
  });
  assert.equal(pendingIdentity.gatePending, true);
  assert.equal(pendingIdentity.playbackAllowed, false);

  const pendingVote = resolvePlaybackPolicy({
    publicationEligible: true,
    authPending: false,
    signedIn: true,
    emailVerified: true,
    voteStateReady: false,
    hasCurrentVote: false,
    hasWatchSession: false,
    watchSessionUnavailable: false,
  });
  assert.equal(pendingVote.gatePending, true);
  assert.equal(pendingVote.needsWatchSession, false);
  assert.equal(pendingVote.playbackAllowed, false);
});

test("session failure keeps playback public without granting watch credit", () => {
  const failed = resolvePlaybackPolicy({
    publicationEligible: true,
    authPending: false,
    signedIn: true,
    emailVerified: true,
    voteStateReady: true,
    hasCurrentVote: false,
    hasWatchSession: false,
    watchSessionUnavailable: true,
  });

  assert.equal(failed.canTrackWatch, true);
  assert.equal(failed.playbackAllowed, true);
  assert.equal(failed.needsWatchSession, false);
});

test("only terminal watch-session errors discard the stale session", () => {
  for (const code of [
    "WATCH_SESSION_EXPIRED",
    "WATCH_SESSION_NOT_FOUND",
    "INVALID_SESSION_ID",
    "VIDEO_CHANGED",
    "STATEMENT_NOT_ELIGIBLE",
    "VIDEO_NOT_ELIGIBLE",
    "AUTH_REQUIRED",
    "EMAIL_NOT_VERIFIED",
    "ACCOUNT_BANNED",
  ]) {
    assert.equal(watchSessionErrorDisposition(code), "reset", code);
  }
  for (const code of [
    "WATCH_SESSION_CONFLICT",
    "RATE_LIMITED",
    "INVALID_HEARTBEAT",
    null,
  ]) {
    assert.equal(watchSessionErrorDisposition(code), "retry", String(code));
  }
});

test("ballot roving focus wraps and supports Home and End", () => {
  assert.equal(nextBallotIndex(0, "ArrowRight", 5), 1);
  assert.equal(nextBallotIndex(4, "ArrowRight", 5), 0);
  assert.equal(nextBallotIndex(0, "ArrowLeft", 5), 4);
  assert.equal(nextBallotIndex(2, "ArrowDown", 5), 3);
  assert.equal(nextBallotIndex(2, "ArrowUp", 5), 1);
  assert.equal(nextBallotIndex(3, "Home", 5), 0);
  assert.equal(nextBallotIndex(1, "End", 5), 4);
  assert.equal(nextBallotIndex(1, "Enter", 5), null);
});

test("heartbeat queue serializes writes and preserves the newest final sample", async () => {
  let releaseFirst!: () => void;
  const firstBlocked = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  const seen: number[] = [];
  let active = 0;
  let maxActive = 0;

  const queue = createLatestTaskQueue<number>(async (value) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    seen.push(value);
    if (value === 1) await firstBlocked;
    active -= 1;
  });

  const firstDrain = queue.enqueue(1);
  await Promise.resolve();
  void queue.enqueue(2);
  void queue.enqueue(3);
  const finalFlush = queue.flush(4);
  releaseFirst();
  await Promise.all([firstDrain, finalFlush]);

  assert.deepEqual(seen, [1, 4]);
  assert.equal(maxActive, 1);
});
