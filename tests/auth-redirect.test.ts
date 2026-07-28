import assert from "node:assert/strict";
import test from "node:test";
import { safeAuthReturnPath } from "../lib/auth-redirect";

test("auth callbacks stay on this site", () => {
  assert.equal(safeAuthReturnPath("/statement/a?from=vote"), "/statement/a?from=vote");
  assert.equal(safeAuthReturnPath("https://evil.example"), "/account");
  assert.equal(safeAuthReturnPath("//evil.example"), "/account");
  assert.equal(safeAuthReturnPath("/\\evil.example"), "/account");
  assert.equal(safeAuthReturnPath("/api/auth/sign-out"), "/account");
  assert.equal(safeAuthReturnPath("/ok\r\nLocation: https://evil.example"), "/account");
});
