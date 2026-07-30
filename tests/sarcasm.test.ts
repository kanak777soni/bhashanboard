import assert from "node:assert/strict";
import test from "node:test";
import {
  SARCASM_LENSES,
  sarcasmHighlights,
  sarcasmSignature,
  scoreSarcasmAxis,
} from "../lib/sarcasm";
import type { Axes } from "../lib/types";

const AXES: Axes = {
  logic: 40,
  straightFace: 90,
  rewatch: 70,
  crowd: 10,
  consequence: 80,
};

test("five distinct lenses describe the comic anatomy", () => {
  assert.equal(SARCASM_LENSES.length, 5);
  assert.deepEqual(
    SARCASM_LENSES.map((lens) => lens.label),
    [
      "Logic Break",
      "Full Confidence",
      "Replay Value",
      "Crowd Effect",
      "No Fallout",
    ],
  );
});

test("clip summaries use the strongest dimensions instead of always using Logic Break", () => {
  assert.deepEqual(sarcasmHighlights(AXES, 2), [
    { label: "Full Confidence", value: 90 },
    { label: "No Fallout", value: 80 },
  ]);
  assert.deepEqual(sarcasmSignature(AXES), {
    label: "Full Confidence",
    value: 90,
  });
});

test("axis scores are rounded and clamped for display", () => {
  assert.equal(scoreSarcasmAxis(74.6), 75);
  assert.equal(scoreSarcasmAxis(-4), 0);
  assert.equal(scoreSarcasmAxis(140), 100);
  assert.equal(scoreSarcasmAxis(Number.NaN), 0);
});
