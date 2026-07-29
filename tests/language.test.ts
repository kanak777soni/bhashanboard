import assert from "node:assert/strict";
import test from "node:test";
import { languageTag } from "../lib/language";

test("language tags accept free-text capitalization and surrounding space", () => {
  assert.equal(languageTag("English"), "en");
  assert.equal(languageTag(" english "), "en");
  assert.equal(languageTag("HINDI"), "hi");
  assert.equal(languageTag("unknown language"), "und");
});
