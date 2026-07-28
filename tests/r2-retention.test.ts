import assert from "node:assert/strict";
import test from "node:test";
import {
  R2_QUARANTINE_DELETE_LIMIT,
  R2_FINAL_ORPHAN_GRACE_MS,
  R2_QUARANTINE_GRACE_MS,
  contentAddressedR2VideoKey,
  r2FinalUploadCanBeAuditedAsOrphan,
  selectR2QuarantineCandidates,
} from "../lib/r2-retention-policy";

const quarantineKey = (suffix: string) =>
  `quarantine/statement-videos/12/12345678-1234-4123-8123-${suffix.padStart(12, "0")}.mp4`;

test("R2 final keys are deterministic content addresses", () => {
  const sha256 = "12abcdef".repeat(8);
  assert.equal(contentAddressedR2VideoKey(sha256), `statement-videos/12/${sha256}.mp4`);
  assert.equal(contentAddressedR2VideoKey(sha256.slice(0, 32)), undefined);
  assert.equal(contentAddressedR2VideoKey(sha256.toUpperCase()), undefined);
});

test("an unattached public final is audited only after a full grace day", () => {
  const nowMs = Date.UTC(2026, 6, 29, 12);
  assert.equal(
    r2FinalUploadCanBeAuditedAsOrphan({
      status: "completed",
      attached: false,
      completedAtMs: nowMs - R2_FINAL_ORPHAN_GRACE_MS,
      nowMs,
    }),
    true
  );
  assert.equal(
    r2FinalUploadCanBeAuditedAsOrphan({
      status: "completed",
      attached: false,
      completedAtMs: nowMs - R2_FINAL_ORPHAN_GRACE_MS + 1,
      nowMs,
    }),
    false
  );
  assert.equal(
    r2FinalUploadCanBeAuditedAsOrphan({
      status: "completed",
      attached: true,
      completedAtMs: 0,
      nowMs,
    }),
    false
  );
});

test("R2 quarantine retention protects tracked uploads and requires a full day of age", () => {
  const nowMs = Date.UTC(2026, 6, 28, 12);
  const protectedKey = quarantineKey("1");
  const abandonedKey = quarantineKey("2");
  const selected = selectR2QuarantineCandidates({
    objects: [
      {
        key: protectedKey,
        lastModified: new Date(nowMs - R2_QUARANTINE_GRACE_MS - 1),
        bytes: 100,
      },
      {
        key: abandonedKey,
        lastModified: new Date(nowMs - R2_QUARANTINE_GRACE_MS),
        bytes: 100,
      },
      {
        key: quarantineKey("3"),
        lastModified: new Date(nowMs - R2_QUARANTINE_GRACE_MS + 1),
        bytes: 100,
      },
      { key: `statement-videos/12/${"12abcdef".repeat(8)}.mp4`, lastModified: new Date(0), bytes: 100 },
    ],
    protectedKeys: new Set([protectedKey]),
    nowMs,
  });
  assert.deepEqual(selected.map((object) => object.key), [abandonedKey]);
});

test("R2 quarantine retention deduplicates and enforces its hard per-run deletion cap", () => {
  const nowMs = Date.UTC(2026, 6, 28, 12);
  const objects = Array.from({ length: R2_QUARANTINE_DELETE_LIMIT + 5 }, (_, index) => ({
    key: quarantineKey(String(index + 1)),
    lastModified: new Date(nowMs - R2_QUARANTINE_GRACE_MS - 1),
    bytes: 100,
  }));
  objects.unshift(objects[0]);
  const selected = selectR2QuarantineCandidates({
    objects,
    protectedKeys: new Set(),
    nowMs,
    limit: 999,
  });
  assert.equal(selected.length, R2_QUARANTINE_DELETE_LIMIT);
  assert.equal(new Set(selected.map((object) => object.key)).size, selected.length);
});
