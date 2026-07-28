const R2_VIDEO_KEY_PATTERN =
  /^statement-videos\/[0-9a-f]{2}\/[0-9a-f]{64}\.mp4$/;
const R2_QUARANTINE_KEY_PATTERN =
  /^quarantine\/statement-videos\/[0-9a-f]{2}\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.mp4$/;

export const R2_VIDEO_PREFIX = "statement-videos/";
export const R2_QUARANTINE_PREFIX = "quarantine/statement-videos/";
export const R2_QUARANTINE_GRACE_MS = 24 * 60 * 60 * 1000;
export const R2_FINAL_ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000;
export const R2_QUARANTINE_SCAN_LIMIT = 5_000;
export const R2_QUARANTINE_DELETE_LIMIT = 25;
export const R2_FINAL_ORPHAN_AUDIT_LIMIT = 25;

export interface ListedR2Object {
  key: string;
  lastModified: Date;
  bytes: number;
}

export function isR2VideoObjectKey(value: unknown): value is string {
  if (typeof value !== "string" || !R2_VIDEO_KEY_PATTERN.test(value)) return false;
  const match = /^statement-videos\/([0-9a-f]{2})\/([0-9a-f]{64})\.mp4$/.exec(value);
  return Boolean(match && match[1] === match[2]?.slice(0, 2));
}

export function isR2QuarantineObjectKey(value: unknown): value is string {
  return typeof value === "string" && R2_QUARANTINE_KEY_PATTERN.test(value);
}

export function contentAddressedR2VideoKey(sha256: string): string | undefined {
  if (!/^[0-9a-f]{64}$/.test(sha256)) return undefined;
  return `${R2_VIDEO_PREFIX}${sha256.slice(0, 2)}/${sha256}.mp4`;
}

export function r2FinalUploadCanBeAuditedAsOrphan({
  status,
  attached,
  completedAtMs,
  nowMs,
}: {
  status: string;
  attached: boolean;
  completedAtMs: number;
  nowMs: number;
}): boolean {
  return (
    status === "completed" &&
    !attached &&
    [completedAtMs, nowMs].every(Number.isFinite) &&
    completedAtMs <= nowMs - R2_FINAL_ORPHAN_GRACE_MS
  );
}

/**
 * Last-resort cleanup for quarantine objects that have no usable intent row.
 * Intent-driven cleanup can run sooner; an untracked object must cross the full
 * grace period before it is eligible.
 */
export function selectR2QuarantineCandidates({
  objects,
  protectedKeys,
  nowMs,
  limit = R2_QUARANTINE_DELETE_LIMIT,
}: {
  objects: readonly ListedR2Object[];
  protectedKeys: ReadonlySet<string>;
  nowMs: number;
  limit?: number;
}): ListedR2Object[] {
  if (!Number.isFinite(nowMs)) return [];
  const safeLimit = Number.isSafeInteger(limit)
    ? Math.min(Math.max(limit, 0), R2_QUARANTINE_DELETE_LIMIT)
    : 0;
  if (safeLimit === 0) return [];

  const cutoffMs = nowMs - R2_QUARANTINE_GRACE_MS;
  const selected: ListedR2Object[] = [];
  const seen = new Set<string>();
  for (const object of objects) {
    const modifiedMs = object.lastModified instanceof Date
      ? object.lastModified.getTime()
      : Number.NaN;
    if (
      !isR2QuarantineObjectKey(object.key) ||
      seen.has(object.key) ||
      protectedKeys.has(object.key) ||
      !Number.isFinite(modifiedMs) ||
      modifiedMs > cutoffMs ||
      !Number.isSafeInteger(object.bytes) ||
      object.bytes < 0
    ) {
      continue;
    }
    seen.add(object.key);
    selected.push(object);
    if (selected.length >= safeLimit) break;
  }
  return selected;
}
