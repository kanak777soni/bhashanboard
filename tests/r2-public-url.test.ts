import assert from "node:assert/strict";
import test from "node:test";
import { normalizeR2PublicBaseUrl } from "../lib/r2-public-url";

test("R2 public delivery requires a clean HTTPS origin", () => {
  assert.equal(
    normalizeR2PublicBaseUrl(" https://media.example.com/ "),
    "https://media.example.com"
  );
  assert.equal(normalizeR2PublicBaseUrl("http://media.example.com"), undefined);
  assert.equal(normalizeR2PublicBaseUrl("https://user:pass@media.example.com"), undefined);
  assert.equal(normalizeR2PublicBaseUrl("https://media.example.com/subpath"), undefined);
  assert.equal(normalizeR2PublicBaseUrl("https://media.example.com?bucket=other"), undefined);
  assert.equal(normalizeR2PublicBaseUrl(""), undefined);
});
