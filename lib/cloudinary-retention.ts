import "server-only";

import { randomUUID } from "node:crypto";
import { db } from "./db";
import {
  cloudinaryStorageConfigured,
  destroyCloudinaryVideo,
} from "./cloudinary";
import {
  CLOUDINARY_COMPLETED_DELETE_GRACE_MS,
  CLOUDINARY_DELETE_MAX_BATCHES,
  CLOUDINARY_DELETE_LIMIT,
  CLOUDINARY_DELETE_RETRY_LEASE_MS,
  type CloudinaryDeletionReason,
} from "./cloudinary-retention-policy";
import {
  isCloudinaryVideoPublicId,
  normalizeCloudinaryAssetId,
} from "./video";

export type CloudinaryRetentionResultStatus = "completed" | "skipped" | "failed";

export interface CloudinaryRetentionResult {
  status: CloudinaryRetentionResultStatus;
  reason?: "not_configured" | "cloudinary_failed";
  expired: number;
  claimed: number;
  deleted: number;
  failed: number;
}

interface ClaimedDeletionRow {
  id: unknown;
  public_id: unknown;
  asset_id: unknown;
  deletion_attempt_id: unknown;
  reason: unknown;
}

interface ClaimedDeletion {
  id: string;
  publicId: string;
  assetId?: string;
  attemptId: string;
  reason: CloudinaryDeletionReason;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const DELETION_REASONS = new Set<CloudinaryDeletionReason>([
  "rejected-upload",
  "expired-upload",
  "unattached-completed",
  "detached-completed",
  "delete-retry",
]);

function retentionTimestamp(nowMs: number): string {
  if (!Number.isFinite(nowMs)) {
    throw new Error("The Cloudinary retention clock is invalid.");
  }
  return new Date(nowMs).toISOString();
}

function mapClaimedDeletion(row: ClaimedDeletionRow): ClaimedDeletion {
  const id = String(row.id);
  const publicId = String(row.public_id);
  const attemptId = String(row.deletion_attempt_id);
  const assetId =
    row.asset_id == null ? undefined : normalizeCloudinaryAssetId(row.asset_id);
  const reason = String(row.reason) as CloudinaryDeletionReason;
  if (
    !UUID_PATTERN.test(id) ||
    !UUID_PATTERN.test(attemptId) ||
    !isCloudinaryVideoPublicId(publicId) ||
    (row.asset_id != null && !assetId) ||
    !DELETION_REASONS.has(reason)
  ) {
    throw new Error("The claimed Cloudinary deletion is invalid.");
  }
  return { id, publicId, assetId, attemptId, reason };
}

async function expireAbandonedIntents(now: string): Promise<number> {
  const rows = await db()`
    UPDATE bhashan.cloudinary_video_upload_intents
    SET
      status = 'expired',
      last_error_code = 'UPLOAD_EXPIRED',
      updated_at = ${now}::timestamptz
    WHERE
      (
        status = 'authorized'
        AND upload_expires_at <= ${now}::timestamptz
      )
      OR
      (
        status = 'processing'
        AND expires_at <= ${now}::timestamptz
      )
    RETURNING id
  `;
  return (rows as unknown as Array<{ id: unknown }>).length;
}

/**
 * Claim every asset in PostgreSQL before touching Cloudinary.
 *
 * The status change commits before destroyCloudinaryVideo runs. Attachment
 * mutations require status='completed', so a claimed asset cannot be attached
 * while deletion is in flight. SKIP LOCKED plus a retry lease also keeps
 * overlapping cron invocations from working the same row concurrently.
 */
async function claimEligibleDeletions(now: string): Promise<ClaimedDeletion[]> {
  const attemptId = randomUUID().toLowerCase();
  const completedCutoff = new Date(
    Date.parse(now) - CLOUDINARY_COMPLETED_DELETE_GRACE_MS
  ).toISOString();
  const retryCutoff = new Date(
    Date.parse(now) - CLOUDINARY_DELETE_RETRY_LEASE_MS
  ).toISOString();
  const rows = await db()`
    WITH candidates AS MATERIALIZED (
      SELECT
        intent.id,
        CASE
          WHEN intent.status = 'deleting' THEN 'delete-retry'
          WHEN intent.status = 'rejected' THEN 'rejected-upload'
          WHEN intent.status = 'expired' THEN 'expired-upload'
          WHEN intent.detached_at IS NOT NULL THEN 'detached-completed'
          ELSE 'unattached-completed'
        END AS reason
      FROM bhashan.cloudinary_video_upload_intents AS intent
      WHERE intent.attached_statement_id IS NULL
        AND (
          (
            intent.status = 'rejected'
            AND intent.expires_at <= ${now}::timestamptz
          )
          OR (
            intent.status = 'expired'
            AND intent.expires_at <= ${now}::timestamptz
          )
          OR (
            intent.status = 'completed'
            AND coalesce(intent.detached_at, intent.completed_at)
              <= ${completedCutoff}::timestamptz
          )
          OR (
            intent.status = 'deleting'
            AND intent.updated_at <= ${retryCutoff}::timestamptz
          )
        )
        AND NOT EXISTS (
          SELECT 1
          FROM bhashan.statements AS statement
          WHERE (
            statement.document #>> '{video,platform}' = 'cloudinary'
            AND statement.document #>> '{video,id}' = intent.public_id
          )
          OR (
            statement.document #>> '{verification,embed,platform}' = 'cloudinary'
            AND statement.document #>> '{verification,embed,id}' = intent.public_id
          )
        )
      ORDER BY
        CASE WHEN intent.status = 'deleting' THEN 0 ELSE 1 END,
        coalesce(intent.deletion_started_at, intent.detached_at, intent.completed_at, intent.updated_at),
        intent.id
      FOR UPDATE OF intent SKIP LOCKED
      LIMIT ${CLOUDINARY_DELETE_LIMIT}
    ), claimed AS (
      UPDATE bhashan.cloudinary_video_upload_intents AS intent
      SET
        status = 'deleting',
        deletion_started_at = coalesce(
          intent.deletion_started_at,
          ${now}::timestamptz
        ),
        deleted_at = NULL,
        deletion_attempt_id = ${attemptId}::uuid,
        last_error_code = NULL,
        updated_at = ${now}::timestamptz
      FROM candidates
      WHERE intent.id = candidates.id
      RETURNING
        intent.id,
        intent.public_id,
        intent.asset_id,
        intent.deletion_attempt_id,
        candidates.reason
    )
    SELECT id, public_id, asset_id, deletion_attempt_id, reason
    FROM claimed
  `;
  return (rows as unknown as ClaimedDeletionRow[]).map(mapClaimedDeletion);
}

async function recordDeletionFailure(
  deletion: ClaimedDeletion,
  now: string
): Promise<void> {
  try {
    await db()`
      UPDATE bhashan.cloudinary_video_upload_intents
      SET
        last_error_code = 'CLOUDINARY_DELETE_FAILED',
        updated_at = ${now}::timestamptz
      WHERE id = ${deletion.id}::uuid
        AND public_id = ${deletion.publicId}
        AND status = 'deleting'
        AND deletion_attempt_id = ${deletion.attemptId}::uuid
    `;
  } catch (error) {
    console.error("Could not record Cloudinary deletion failure", {
      intentId: deletion.id,
      error: String(error),
    });
  }
}

/**
 * Finish the state transition and audit entry atomically. If this transaction
 * fails after the provider accepted deletion, the row remains `deleting`; a
 * later retry accepts Cloudinary's `not found` result and safely completes it.
 */
async function completeDeletion(
  deletion: ClaimedDeletion,
  now: string
): Promise<void> {
  const rows = await db()`
    WITH completed AS (
      UPDATE bhashan.cloudinary_video_upload_intents
      SET
        status = 'deleted',
        deleted_at = ${now}::timestamptz,
        last_error_code = NULL,
        updated_at = ${now}::timestamptz
      WHERE id = ${deletion.id}::uuid
        AND public_id = ${deletion.publicId}
        AND status = 'deleting'
        AND deletion_attempt_id = ${deletion.attemptId}::uuid
        AND attached_statement_id IS NULL
      RETURNING
        id,
        public_id,
        asset_id,
        deletion_attempt_id,
        deletion_started_at,
        deleted_at
    ), logged AS (
      INSERT INTO bhashan.audit_events (
        table_schema,
        table_name,
        target_id,
        operation,
        actor,
        action,
        detail,
        after_row
      )
      SELECT
        'cloudinary',
        'authenticated-video',
        completed.id::text,
        'DELETE',
        'System retention job',
        'cloudinary-video-cleanup',
        'Deleted one eligible authenticated Cloudinary video after a durable claim.',
        jsonb_build_object(
          'uploadIntentId', completed.id,
          'publicId', completed.public_id,
          'assetId', completed.asset_id,
          'attemptId', completed.deletion_attempt_id,
          'reason', ${deletion.reason},
          'deletionStartedAt', completed.deletion_started_at,
          'deletedAt', completed.deleted_at
        )
      FROM completed
      RETURNING event_id
    )
    SELECT completed.id
    FROM completed
    CROSS JOIN logged
  `;
  if ((rows as unknown as Array<{ id: unknown }>).length !== 1) {
    throw new Error("The Cloudinary deletion completion could not be audited.");
  }
}

/**
 * Delete only database-tracked, authenticated assets. Provider failures remain
 * monitoring-visible while other eligible rows continue to make progress.
 */
export async function runCloudinaryRetention(
  nowMs = Date.now()
): Promise<CloudinaryRetentionResult> {
  const result: CloudinaryRetentionResult = {
    status: "completed",
    expired: 0,
    claimed: 0,
    deleted: 0,
    failed: 0,
  };

  try {
    const now = retentionTimestamp(nowMs);
    result.expired = await expireAbandonedIntents(now);
    if (!cloudinaryStorageConfigured()) {
      return { ...result, status: "skipped", reason: "not_configured" };
    }

    for (
      let batch = 0;
      batch < CLOUDINARY_DELETE_MAX_BATCHES;
      batch += 1
    ) {
      const deletions = await claimEligibleDeletions(now);
      result.claimed += deletions.length;

      await Promise.all(
        deletions.map(async (deletion) => {
          try {
            await destroyCloudinaryVideo({
              intentId: deletion.id,
              publicId: deletion.publicId,
              assetId: deletion.assetId,
            });
            await completeDeletion(deletion, now);
            result.deleted += 1;
          } catch (error) {
            result.failed += 1;
            await recordDeletionFailure(deletion, now);
            console.error("Cloudinary video deletion failed", {
              intentId: deletion.id,
              error: String(error),
            });
          }
        })
      );

      if (deletions.length < CLOUDINARY_DELETE_LIMIT) {
        break;
      }
    }
  } catch (error) {
    console.error("Cloudinary retention failed", error);
    result.failed += 1;
  }

  if (result.failed > 0) {
    result.status = "failed";
    result.reason = "cloudinary_failed";
  }
  return result;
}
