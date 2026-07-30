import assert from "node:assert/strict";
import test from "node:test";
import { resolveStatementClass } from "../lib/classes";
import { calculateRating } from "../lib/rating";
import {
  provisionalClassFromFivePointScores,
  provisionalClassFromStoredAxes,
} from "../lib/sarcasm";
import type { Axes } from "../lib/types";

function scoresForTotal(total: number) {
  const values = [0, 0, 0, 0];
  let remaining = total;
  for (let index = 0; index < values.length; index++) {
    values[index] = Math.min(5, remaining);
    remaining -= values[index];
  }
  return {
    logic_damage: values[0],
    reality_gap: values[1],
    straight_face: values[2],
    rewatch_value: values[3],
  };
}

test("the equal four-mark total follows every provisional class boundary", () => {
  const cases = [
    [5, "participation"],
    [6, "bronze"],
    [8, "bronze"],
    [9, "silver"],
    [11, "silver"],
    [12, "gold"],
    [14, "gold"],
    [15, "diamond"],
    [17, "diamond"],
    [18, "kohinoor"],
    [20, "kohinoor"],
  ] as const;

  for (const [total, tier] of cases) {
    const preview = provisionalClassFromFivePointScores(
      scoresForTotal(total),
    );
    assert.equal(preview?.total, total);
    assert.equal(preview?.gp, 1000 + total * 50);
    assert.equal(preview?.tier.key, tier);
  }
});

test("a missing Reality Gap remains incomplete and cannot silently set a class", () => {
  assert.equal(
    provisionalClassFromStoredAxes({
      logic_damage: 5,
      straight_face: 5,
      rewatch_value: 5,
      crowd_complicity: 5,
      consequence: 5,
    }),
    null,
  );
});

test("public class replaces the provisional class at the tenth valid vote", () => {
  const axes: Axes = {
    logic: 100,
    realityGap: 100,
    straightFace: 100,
    comicImpact: 100,
  };

  const provisional = resolveStatementClass({
    gp: 1300,
    validVoteCount: 9,
    axes,
  });
  assert.equal(provisional.source, "provisional");
  assert.equal(provisional.tier?.key, "kohinoor");

  const publicResult = resolveStatementClass({
    gp: 1300,
    validVoteCount: 10,
    axes,
  });
  assert.equal(publicResult.source, "public");
  assert.equal(publicResult.tier?.key, "bronze");
});

test("editorial marks cannot alter equal-weight public rating maths", () => {
  const before = calculateRating({
    validVoteCount: 4,
    validVoteSum: 250,
  });
  provisionalClassFromFivePointScores(scoresForTotal(20));
  const after = calculateRating({
    validVoteCount: 4,
    validVoteSum: 250,
  });
  assert.deepEqual(after, before);
});
