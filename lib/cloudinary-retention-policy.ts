export const CLOUDINARY_COMPLETED_DELETE_GRACE_MS = 24 * 60 * 60 * 1000;
export const CLOUDINARY_DELETE_RETRY_LEASE_MS = 5 * 60 * 1000;
export const CLOUDINARY_DELETE_LIMIT = 8;
export const CLOUDINARY_DELETE_MAX_BATCHES = 3;

export type CloudinaryRetentionStatus =
  | "authorized"
  | "processing"
  | "completed"
  | "rejected"
  | "expired"
  | "deleting"
  | "deleted";

export type CloudinaryDeletionReason =
  | "rejected-upload"
  | "expired-upload"
  | "unattached-completed"
  | "detached-completed"
  | "delete-retry";

/**
 * Mirrors the SQL claim policy in cloudinary-retention.ts.
 *
 * An expired authorization waits until the durable, overall intent expiry
 * before deletion. This prevents a slow direct upload that crossed only its
 * short authorization deadline from recreating an asset after cleanup.
 */
export function cloudinaryDeletionReason({
  status,
  attached,
  completedAtMs,
  detachedAtMs,
  expiresAtMs,
  updatedAtMs,
  nowMs,
}: {
  status: CloudinaryRetentionStatus;
  attached: boolean;
  completedAtMs?: number;
  detachedAtMs?: number;
  expiresAtMs?: number;
  updatedAtMs?: number;
  nowMs: number;
}): CloudinaryDeletionReason | undefined {
  if (attached || !Number.isFinite(nowMs)) return undefined;

  if (
    status === "rejected" &&
    Number.isFinite(expiresAtMs) &&
    expiresAtMs! <= nowMs
  ) {
    return "rejected-upload";
  }

  if (
    status === "expired" &&
    Number.isFinite(expiresAtMs) &&
    expiresAtMs! <= nowMs
  ) {
    return "expired-upload";
  }

  if (status === "completed") {
    const detached = Number.isFinite(detachedAtMs);
    const anchorMs = detached ? detachedAtMs : completedAtMs;
    if (
      Number.isFinite(anchorMs) &&
      anchorMs! <= nowMs - CLOUDINARY_COMPLETED_DELETE_GRACE_MS
    ) {
      return detached ? "detached-completed" : "unattached-completed";
    }
  }

  if (
    status === "deleting" &&
    Number.isFinite(updatedAtMs) &&
    updatedAtMs! <= nowMs - CLOUDINARY_DELETE_RETRY_LEASE_MS
  ) {
    return "delete-retry";
  }

  return undefined;
}
