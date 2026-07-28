import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateRating,
  calculateWatchProgress,
  isVoteValue,
  requiredWatchMilliseconds,
  watchHeartbeatWriteIsDue,
} from "../lib/rating";

test("the rating model reproduces the published example", () => {
  const result = calculateRating({
    priorPerformance: 60,
    priorStrength: 10,
    validVoteCount: 3,
    validVoteSum: 75 + 100 + 50,
  });

  assert.equal(result.performance, 825 / 13);
  assert.equal(result.gp, 1635);
});

test("only the five fixed ballot positions are accepted", () => {
  for (const value of [0, 25, 50, 75, 100]) assert.equal(isVoteValue(value), true);
  for (const value of [-1, 1, 24, 26, 99, 101, "50", null]) {
    assert.equal(isVoteValue(value), false);
  }
});

test("normal visible playback advances unique contiguous coverage", () => {
  const first = calculateWatchProgress(
    {
      clipStartMs: 0,
      clipEndMs: 10_000,
      contiguousThroughMs: 0,
      creditedWatchMs: 0,
      lastPositionMs: 0,
      lastHeartbeatAtMs: 0,
      reachedEnd: false,
    },
    {
      positionMs: 5_000,
      heartbeatAtMs: 5_000,
      playing: true,
      visible: true,
    }
  );
  assert.equal(first.creditedWatchMs, 5_000);
  assert.equal(first.seekDetected, false);

  const second = calculateWatchProgress(first, {
    positionMs: 9_000,
    heartbeatAtMs: 9_000,
    playing: true,
    visible: true,
  });
  assert.equal(second.creditedWatchMs, 9_000);
  assert.equal(second.reachedEnd, true);
  assert.equal(requiredWatchMilliseconds(0, 10_000), 9_000);
});

test("a forward seek does not earn watch credit", () => {
  const result = calculateWatchProgress(
    {
      clipStartMs: 0,
      clipEndMs: 10_000,
      contiguousThroughMs: 0,
      creditedWatchMs: 0,
      lastPositionMs: 0,
      lastHeartbeatAtMs: 0,
      reachedEnd: false,
    },
    {
      positionMs: 8_000,
      heartbeatAtMs: 1_000,
      playing: true,
      visible: true,
    }
  );

  assert.equal(result.seekDetected, true);
  assert.equal(result.creditedWatchMs, 0);
});

test("rapid heartbeats cannot manufacture watch time", () => {
  let progress = {
    clipStartMs: 0,
    clipEndMs: 180_000,
    contiguousThroughMs: 0,
    creditedWatchMs: 0,
    lastPositionMs: 0,
    lastHeartbeatAtMs: 0,
    reachedEnd: false,
  };

  for (let index = 1; index <= 200; index += 1) {
    progress = calculateWatchProgress(progress, {
      positionMs: index * 750,
      heartbeatAtMs: index * 10,
      playing: true,
      visible: true,
    });
  }

  assert.ok(progress.creditedWatchMs <= 2_000);
});

test("heartbeats inside the write-throttle window are ignored", () => {
  assert.equal(watchHeartbeatWriteIsDue(10_000, 11_999), false);
  assert.equal(watchHeartbeatWriteIsDue(10_000, 12_000), true);
});

test("hidden playback and replayed coverage do not earn extra time", () => {
  const hidden = calculateWatchProgress(
    {
      clipStartMs: 0,
      clipEndMs: 10_000,
      contiguousThroughMs: 4_000,
      creditedWatchMs: 4_000,
      lastPositionMs: 4_000,
      lastHeartbeatAtMs: 4_000,
      reachedEnd: false,
    },
    {
      positionMs: 6_000,
      heartbeatAtMs: 6_000,
      playing: true,
      visible: false,
    }
  );
  assert.equal(hidden.creditedWatchMs, 4_000);

  const replay = calculateWatchProgress(
    { ...hidden, lastPositionMs: 1_000 },
    {
      positionMs: 3_000,
      heartbeatAtMs: 8_000,
      playing: true,
      visible: true,
    }
  );
  assert.equal(replay.creditedWatchMs, 4_000);
});
