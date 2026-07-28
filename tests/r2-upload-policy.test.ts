import assert from "node:assert/strict";
import test from "node:test";
import { r2UploadIntentShouldExpire } from "../lib/r2-upload-policy";

test("the short PUT deadline expires only an upload that has not started processing", () => {
  const uploadDeadline = Date.UTC(2026, 6, 28, 12, 30);
  const intentDeadline = Date.UTC(2026, 6, 29, 12);

  assert.equal(
    r2UploadIntentShouldExpire({
      status: "authorized",
      uploadExpiresAtMs: uploadDeadline,
      intentExpiresAtMs: intentDeadline,
      nowMs: uploadDeadline,
    }),
    true
  );
  assert.equal(
    r2UploadIntentShouldExpire({
      status: "processing",
      uploadExpiresAtMs: uploadDeadline,
      intentExpiresAtMs: intentDeadline,
      nowMs: uploadDeadline + 1,
    }),
    false
  );
});

test("a processing upload expires only at the durable intent deadline", () => {
  const uploadDeadline = Date.UTC(2026, 6, 28, 12, 30);
  const intentDeadline = Date.UTC(2026, 6, 29, 12);

  assert.equal(
    r2UploadIntentShouldExpire({
      status: "processing",
      uploadExpiresAtMs: uploadDeadline,
      intentExpiresAtMs: intentDeadline,
      nowMs: intentDeadline - 1,
    }),
    false
  );
  assert.equal(
    r2UploadIntentShouldExpire({
      status: "processing",
      uploadExpiresAtMs: uploadDeadline,
      intentExpiresAtMs: intentDeadline,
      nowMs: intentDeadline,
    }),
    true
  );
});
