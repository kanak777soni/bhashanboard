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
  realityGap: 60,
  straightFace: 90,
  comicImpact: 70,
};

test("four statement-focused lenses describe the comic anatomy", () => {
  assert.equal(SARCASM_LENSES.length, 4);
  assert.deepEqual(
    SARCASM_LENSES.map((lens) => lens.label),
    [
      "Logic Break",
      "Reality Gap",
      "Full Confidence",
      "Comic Impact",
    ],
  );
});

test("clip summaries use the strongest dimensions instead of always using Logic Break", () => {
  assert.deepEqual(sarcasmHighlights(AXES, 2), [
    { label: "Full Confidence", value: 90 },
    { label: "Comic Impact", value: 70 },
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
  assert.equal(scoreSarcasmAxis(Number.NaN), null);
  assert.equal(scoreSarcasmAxis(null), null);
});

test("unrated legacy lenses are omitted instead of receiving an invented zero", () => {
  assert.deepEqual(
    sarcasmHighlights({ ...AXES, realityGap: null }, 4),
    [
      { label: "Full Confidence", value: 90 },
      { label: "Comic Impact", value: 70 },
      { label: "Logic Break", value: 40 },
    ],
  );
});
