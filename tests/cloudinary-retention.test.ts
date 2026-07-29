import assert from "node:assert/strict";
import test from "node:test";
import {
  CLOUDINARY_COMPLETED_DELETE_GRACE_MS,
  CLOUDINARY_DELETE_RETRY_LEASE_MS,
  cloudinaryDeletionReason,
} from "../lib/cloudinary-retention-policy";

test("completed Cloudinary media gets a full 24-hour attachment grace period", () => {
  const nowMs = Date.UTC(2026, 6, 29, 12);
  assert.equal(
    cloudinaryDeletionReason({
      status: "completed",
      attached: false,
      completedAtMs: nowMs - CLOUDINARY_COMPLETED_DELETE_GRACE_MS,
      nowMs,
    }),
    "unattached-completed"
  );
  assert.equal(
    cloudinaryDeletionReason({
      status: "completed",
      attached: false,
      completedAtMs: nowMs - CLOUDINARY_COMPLETED_DELETE_GRACE_MS + 1,
      nowMs,
    }),
    undefined
  );
  assert.equal(
    cloudinaryDeletionReason({
      status: "completed",
      attached: true,
      completedAtMs: 0,
      nowMs,
    }),
    undefined
  );
});

test("detachment restarts the completed-media grace period", () => {
  const nowMs = Date.UTC(2026, 6, 29, 12);
  assert.equal(
    cloudinaryDeletionReason({
      status: "completed",
      attached: false,
      completedAtMs: nowMs - 10 * CLOUDINARY_COMPLETED_DELETE_GRACE_MS,
      detachedAtMs: nowMs - CLOUDINARY_COMPLETED_DELETE_GRACE_MS + 1,
      nowMs,
    }),
    undefined
  );
  assert.equal(
    cloudinaryDeletionReason({
      status: "completed",
      attached: false,
      completedAtMs: nowMs - 10 * CLOUDINARY_COMPLETED_DELETE_GRACE_MS,
      detachedAtMs: nowMs - CLOUDINARY_COMPLETED_DELETE_GRACE_MS,
      nowMs,
    }),
    "detached-completed"
  );
});

test("rejected and expired assets wait past the signed-upload replay window", () => {
  const nowMs = Date.UTC(2026, 6, 29, 12);
  assert.equal(
    cloudinaryDeletionReason({
      status: "rejected",
      attached: false,
      expiresAtMs: nowMs + 1,
      nowMs,
    }),
    undefined
  );
  assert.equal(
    cloudinaryDeletionReason({
      status: "rejected",
      attached: false,
      expiresAtMs: nowMs,
      nowMs,
    }),
    "rejected-upload"
  );
  assert.equal(
    cloudinaryDeletionReason({
      status: "expired",
      attached: false,
      expiresAtMs: nowMs + 1,
      nowMs,
    }),
    undefined
  );
  assert.equal(
    cloudinaryDeletionReason({
      status: "expired",
      attached: false,
      expiresAtMs: nowMs,
      nowMs,
    }),
    "expired-upload"
  );
});

test("a deletion claim must cross its retry lease before another worker retries it", () => {
  const nowMs = Date.UTC(2026, 6, 29, 12);
  assert.equal(
    cloudinaryDeletionReason({
      status: "deleting",
      attached: false,
      updatedAtMs: nowMs - CLOUDINARY_DELETE_RETRY_LEASE_MS + 1,
      nowMs,
    }),
    undefined
  );
  assert.equal(
    cloudinaryDeletionReason({
      status: "deleting",
      attached: false,
      updatedAtMs: nowMs - CLOUDINARY_DELETE_RETRY_LEASE_MS,
      nowMs,
    }),
    "delete-retry"
  );
});
