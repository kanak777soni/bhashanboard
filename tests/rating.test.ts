import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateRating,
  calculateWatchProgress,
  isVoteValue,
  requiredWatchMilliseconds,
  watchHeartbeatWriteIsDue,
} from "../lib/rating";

test("the public rating is the exact equal-weight ballot mean", () => {
  const result = calculateRating({
    validVoteCount: 3,
    validVoteSum: 75 + 100 + 50,
  });

  assert.equal(result.performance, 75);
  assert.equal(result.gp, 1750);
  assert.equal(result.modelVersion, 2);
});

test("an empty public aggregate is neutral and carries no editorial weight", () => {
  const result = calculateRating({
    validVoteCount: 0,
    validVoteSum: 0,
  });

  assert.equal(result.performance, 50);
  assert.equal(result.gp, 1500);
  assert.equal(result.priorStrength, 0);
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
      lastPlaying: false,
      lastVisible: true,
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
      lastPlaying: false,
      lastVisible: true,
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
  assert.equal(result.reachedEnd, false);
});

test("paused or hidden positions near the end cannot satisfy the end gate", () => {
  const state = {
    clipStartMs: 0,
    clipEndMs: 10_000,
    contiguousThroughMs: 8_000,
    creditedWatchMs: 8_000,
    lastPositionMs: 8_000,
    lastHeartbeatAtMs: 8_000,
    lastPlaying: false,
    lastVisible: true,
    reachedEnd: false,
  };

  const paused = calculateWatchProgress(state, {
    positionMs: 9_500,
    heartbeatAtMs: 10_000,
    playing: false,
    visible: true,
  });
  assert.equal(paused.reachedEnd, false);
  assert.equal(paused.creditedWatchMs, 8_000);

  const hidden = calculateWatchProgress(state, {
    positionMs: 9_500,
    heartbeatAtMs: 10_000,
    playing: true,
    visible: false,
  });
  assert.equal(hidden.reachedEnd, false);
  assert.equal(hidden.creditedWatchMs, 8_000);

  const staleLegacyFlag = calculateWatchProgress(
    { ...state, contiguousThroughMs: 1_000, creditedWatchMs: 1_000, reachedEnd: true },
    {
      positionMs: 9_500,
      heartbeatAtMs: 10_000,
      playing: false,
      visible: true,
    }
  );
  assert.equal(staleLegacyFlag.reachedEnd, false);
});

test("natural visible progression through the end satisfies the end gate", () => {
  const result = calculateWatchProgress(
    {
      clipStartMs: 0,
      clipEndMs: 10_000,
      contiguousThroughMs: 8_000,
      creditedWatchMs: 8_000,
      lastPositionMs: 8_000,
      lastHeartbeatAtMs: 8_000,
      lastPlaying: true,
      lastVisible: true,
      reachedEnd: false,
    },
    {
      positionMs: 10_000,
      heartbeatAtMs: 10_000,
      playing: true,
      visible: true,
    }
  );

  assert.equal(result.seekDetected, false);
  assert.equal(result.creditedWatchMs, 10_000);
  assert.equal(result.reachedEnd, true);
});

test("rapid heartbeats cannot manufacture watch time", () => {
  let progress = {
    clipStartMs: 0,
    clipEndMs: 180_000,
    contiguousThroughMs: 0,
    creditedWatchMs: 0,
    lastPositionMs: 0,
    lastHeartbeatAtMs: 0,
    lastPlaying: false,
    lastVisible: true,
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
      lastPlaying: true,
      lastVisible: false,
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

test("a pause heartbeat closes the active interval without poisoning resume", () => {
  const paused = calculateWatchProgress(
    {
      clipStartMs: 0,
      clipEndMs: 20_000,
      contiguousThroughMs: 4_000,
      creditedWatchMs: 4_000,
      lastPositionMs: 4_000,
      lastHeartbeatAtMs: 4_000,
      lastPlaying: true,
      lastVisible: true,
      reachedEnd: false,
    },
    {
      positionMs: 7_000,
      heartbeatAtMs: 7_000,
      playing: false,
      visible: true,
    }
  );

  assert.equal(paused.seekDetected, false);
  assert.equal(paused.creditedWatchMs, 7_000);
  assert.equal(paused.lastPositionMs, 7_000);
  assert.equal(paused.lastPlaying, false);

  const resumed = calculateWatchProgress(paused, {
    positionMs: 11_000,
    heartbeatAtMs: 21_000,
    playing: true,
    visible: true,
  });
  assert.equal(resumed.seekDetected, false);
  assert.equal(resumed.creditedWatchMs, 11_000);
});

test("pausing before the first playing heartbeat preserves a resumable baseline", () => {
  const paused = calculateWatchProgress(
    {
      clipStartMs: 0,
      clipEndMs: 20_000,
      contiguousThroughMs: 0,
      creditedWatchMs: 0,
      lastPositionMs: 0,
      lastHeartbeatAtMs: 0,
      lastPlaying: false,
      lastVisible: true,
      reachedEnd: false,
    },
    {
      positionMs: 3_000,
      heartbeatAtMs: 3_000,
      playing: false,
      visible: true,
    }
  );
  assert.equal(paused.creditedWatchMs, 0);
  assert.equal(paused.lastPositionMs, 0);

  const resumed = calculateWatchProgress(paused, {
    positionMs: 7_000,
    heartbeatAtMs: 20_000,
    playing: true,
    visible: true,
  });
  assert.equal(resumed.seekDetected, false);
  assert.equal(resumed.creditedWatchMs, 7_000);
});

test("seeking while already paused cannot manufacture a new baseline", () => {
  const soughtWhilePaused = calculateWatchProgress(
    {
      clipStartMs: 0,
      clipEndMs: 20_000,
      contiguousThroughMs: 4_000,
      creditedWatchMs: 4_000,
      lastPositionMs: 4_000,
      lastHeartbeatAtMs: 4_000,
      lastPlaying: false,
      lastVisible: true,
      reachedEnd: false,
    },
    {
      positionMs: 9_000,
      heartbeatAtMs: 10_000,
      playing: false,
      visible: true,
    }
  );
  assert.equal(soughtWhilePaused.creditedWatchMs, 4_000);
  assert.equal(soughtWhilePaused.lastPositionMs, 4_000);

  const resumed = calculateWatchProgress(soughtWhilePaused, {
    positionMs: 11_000,
    heartbeatAtMs: 12_000,
    playing: true,
    visible: true,
  });
  assert.equal(resumed.seekDetected, true);
  assert.equal(resumed.creditedWatchMs, 4_000);
});
