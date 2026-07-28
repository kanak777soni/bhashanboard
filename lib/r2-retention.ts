import "server-only";

import { randomUUID } from "node:crypto";
import { db } from "./db";
import {
  deleteR2QuarantineObject,
  listR2QuarantineObjects,
  r2StorageConfigured,
} from "./r2";
import {
  isR2QuarantineObjectKey,
  isR2VideoObjectKey,
  R2_FINAL_ORPHAN_AUDIT_LIMIT,
  R2_FINAL_ORPHAN_GRACE_MS,
  R2_QUARANTINE_DELETE_LIMIT,
  R2_QUARANTINE_SCAN_LIMIT,
  selectR2QuarantineCandidates,
} from "./r2-retention-policy";

export type R2RetentionStatus = "completed" | "skipped" | "failed";

interface R2RetentionPart {
  scanned: number;
  candidates: number;
  deleted: number;
  scanLimitReached: boolean;
}

export interface R2RetentionResult {
  status: R2RetentionStatus;
  reason?: "not_configured" | "r2_failed" | "audit_failed";
  final: R2RetentionPart;
  quarantine: R2RetentionPart;
}

type DeletionBucketRole = "upload";
type DeletionReason =
  | "completed-quarantine"
  | "expired-quarantine"
  | "untracked-quarantine";

interface DeletionIntentRow {
  id: unknown;
  bucket_role: unknown;
  object_key: unknown;
  upload_intent_id: unknown;
  reason: unknown;
  status: unknown;
}

interface DeletionIntent {
  id: string;
  bucketRole: DeletionBucketRole;
  key: string;
  uploadIntentId?: string;
  reason: DeletionReason;
  status: "planned" | "completed" | "cancelled";
}

interface QuarantineIntentRow {
  id: unknown;
  quarantine_key: unknown;
  status: unknown;
}

interface PublicFinalOrphanRow {
  public_key: unknown;
}

const emptyPart = (): R2RetentionPart => ({
  scanned: 0,
  candidates: 0,
  deleted: 0,
  scanLimitReached: false,
});

function mapDeletionIntent(row: DeletionIntentRow): DeletionIntent {
  const bucketRole = String(row.bucket_role) as DeletionBucketRole;
  const reason = String(row.reason) as DeletionReason;
  const status = String(row.status) as DeletionIntent["status"];
  const key = String(row.object_key);
  if (
    bucketRole !== "upload" ||
    !["completed-quarantine", "expired-quarantine", "untracked-quarantine"].includes(reason) ||
    !["planned", "completed", "cancelled"].includes(status) ||
    !isR2QuarantineObjectKey(key)
  ) {
    throw new Error("The R2 deletion intent is invalid.");
  }
  return {
    id: String(row.id),
    bucketRole,
    key,
    uploadIntentId: row.upload_intent_id == null ? undefined : String(row.upload_intent_id),
    reason,
    status,
  };
}

/** Persist the decision before making the external delete call. */
async function planDeletion({
  bucketRole,
  key,
  reason,
  uploadIntentId,
}: {
  bucketRole: DeletionBucketRole;
  key: string;
  reason: DeletionReason;
  uploadIntentId?: string;
}): Promise<DeletionIntent> {
  const id = randomUUID();
  const rows = await db()`
    WITH inserted AS (
      INSERT INTO bhashan.r2_object_deletion_intents (
        id, bucket_role, object_key, upload_intent_id, reason
      ) VALUES (
        ${id}::uuid, ${bucketRole}, ${key},
        ${uploadIntentId ?? null}::uuid, ${reason}
      )
      ON CONFLICT (bucket_role, object_key)
        WHERE status = 'planned'
        DO NOTHING
      RETURNING *
    )
    SELECT * FROM inserted
    UNION ALL
    SELECT existing.*
    FROM bhashan.r2_object_deletion_intents AS existing
    WHERE existing.bucket_role = ${bucketRole}
      AND existing.object_key = ${key}
      AND existing.status = 'planned'
      AND NOT EXISTS (SELECT 1 FROM inserted)
    LIMIT 1
  `;
  const row = (rows as unknown as DeletionIntentRow[])[0];
  if (!row) throw new Error("The R2 deletion intent could not be persisted.");
  const intent = mapDeletionIntent(row);
  if (intent.status !== "planned") throw new Error("The R2 deletion intent is not pending.");
  return intent;
}

async function pendingDeletionIntents(limit: number) {
  const rows = await db()`
    SELECT *
    FROM bhashan.r2_object_deletion_intents
    WHERE bucket_role = 'upload' AND status = 'planned'
    ORDER BY requested_at, id
    LIMIT ${limit}
  `;
  return (rows as unknown as DeletionIntentRow[]).map(mapDeletionIntent);
}

async function recordDeletionError(intentId: string): Promise<void> {
  try {
    await db()`
      UPDATE bhashan.r2_object_deletion_intents
      SET last_error_code = 'DELETE_FAILED'
      WHERE id = ${intentId}::uuid AND status = 'planned'
    `;
  } catch (error) {
    console.error("Could not record R2 deletion failure", { intentId, error: String(error) });
  }
}

/**
 * Mark completion and append the per-object audit in one database transaction.
 * If it fails after DeleteObject succeeded, the planned row remains durable;
 * the next cron retries the idempotent delete and this transaction.
 */
async function completeDeletion(intent: DeletionIntent): Promise<void> {
  const rows = await db()`
    WITH completed AS (
      UPDATE bhashan.r2_object_deletion_intents
      SET status = 'completed', completed_at = clock_timestamp(), last_error_code = NULL
      WHERE id = ${intent.id}::uuid AND status = 'planned'
      RETURNING id, upload_intent_id
    ), updated_upload AS (
      UPDATE bhashan.r2_video_upload_intents AS upload
      SET quarantine_deleted_at = coalesce(upload.quarantine_deleted_at, clock_timestamp()),
          updated_at = clock_timestamp()
      FROM completed
      WHERE upload.id = completed.upload_intent_id
      RETURNING upload.id
    ), logged AS (
      INSERT INTO bhashan.audit_events (
        table_schema, table_name, target_id, operation, actor, action, detail, after_row
      )
      SELECT
        'r2',
        'quarantine',
        completed.id::text,
        'DELETE',
        'System retention job',
        'r2-quarantine-cleanup',
        'Completed one durable private R2 quarantine deletion intent.',
        jsonb_build_object(
          'deletionIntentId', completed.id,
          'uploadIntentId', completed.upload_intent_id,
          'key', ${intent.key},
          'reason', ${intent.reason}
        )
      FROM completed
      RETURNING event_id
    )
    SELECT completed.id
    FROM completed
    CROSS JOIN logged
  `;
  if ((rows as unknown as unknown[]).length !== 1) {
    throw new Error("The durable R2 deletion completion could not be audited.");
  }
}

async function executeDeletion(intent: DeletionIntent): Promise<boolean> {
  try {
    await deleteR2QuarantineObject(intent.key);
  } catch (error) {
    await recordDeletionError(intent.id);
    throw error;
  }
  await completeDeletion(intent);
  return true;
}

async function quarantineIntentCandidates(): Promise<Array<{
  id: string;
  key: string;
  reason: "completed-quarantine" | "expired-quarantine";
}>> {
  const rows = await db()`
    WITH expired AS (
      UPDATE bhashan.r2_video_upload_intents
      SET status = 'expired', last_error_code = coalesce(last_error_code, 'UPLOAD_EXPIRED'),
          updated_at = clock_timestamp()
      WHERE status IN ('authorized', 'processing')
        AND expires_at <= clock_timestamp()
      RETURNING id
    )
    SELECT intent.id, intent.quarantine_key, intent.status
    FROM bhashan.r2_video_upload_intents AS intent
    WHERE intent.quarantine_deleted_at IS NULL
      AND intent.status IN ('completed', 'rejected', 'expired')
    ORDER BY intent.updated_at, intent.id
    LIMIT ${R2_QUARANTINE_DELETE_LIMIT}
  `;
  const candidates: Array<{
    id: string;
    key: string;
    reason: "completed-quarantine" | "expired-quarantine";
  }> = [];
  for (const row of rows as unknown as QuarantineIntentRow[]) {
    const key = String(row.quarantine_key);
    if (isR2QuarantineObjectKey(key)) {
      candidates.push({
        id: String(row.id),
        key,
        reason: row.status === "completed" ? "completed-quarantine" : "expired-quarantine",
      });
    }
  }
  return candidates;
}

async function protectedQuarantineKeys(): Promise<Set<string>> {
  const rows = await db()`
    SELECT quarantine_key
    FROM bhashan.r2_video_upload_intents
    WHERE quarantine_deleted_at IS NULL
  `;
  const keys = new Set<string>();
  for (const row of rows as unknown as Array<{ quarantine_key: unknown }>) {
    if (isR2QuarantineObjectKey(row.quarantine_key)) keys.add(row.quarantine_key);
  }
  return keys;
}

async function cleanQuarantine(nowMs: number): Promise<R2RetentionPart> {
  const part = emptyPart();
  const pending = await pendingDeletionIntents(R2_QUARANTINE_DELETE_LIMIT);
  part.candidates += pending.length;
  for (const intent of pending) {
    if (await executeDeletion(intent)) part.deleted += 1;
  }

  let remaining = R2_QUARANTINE_DELETE_LIMIT - part.deleted;
  if (remaining <= 0) return part;
  const tracked = (await quarantineIntentCandidates()).slice(0, remaining);
  part.candidates += tracked.length;
  for (const candidate of tracked) {
    const intent = await planDeletion({
      bucketRole: "upload",
      key: candidate.key,
      reason: candidate.reason,
      uploadIntentId: candidate.id,
    });
    if (await executeDeletion(intent)) part.deleted += 1;
  }

  remaining = R2_QUARANTINE_DELETE_LIMIT - part.deleted;
  if (remaining <= 0) return part;
  const [listing, protectedKeys] = await Promise.all([
    listR2QuarantineObjects(R2_QUARANTINE_SCAN_LIMIT),
    protectedQuarantineKeys(),
  ]);
  part.scanned = listing.scanned;
  part.scanLimitReached = listing.scanLimitReached;
  const untracked = selectR2QuarantineCandidates({
    objects: listing.objects,
    protectedKeys,
    nowMs,
    limit: remaining,
  });
  part.candidates += untracked.length;
  for (const candidate of untracked) {
    const intent = await planDeletion({
      bucketRole: "upload",
      key: candidate.key,
      reason: "untracked-quarantine",
    });
    if (await executeDeletion(intent)) part.deleted += 1;
  }
  return part;
}

/**
 * Public evidence is not auto-deleted: a content-addressed key can be shared
 * by identical uploads, and deletion must never race a statement save. We do,
 * however, persist and audit every final that remains unattached for a full
 * day so storage drift is visible and can be reviewed safely.
 */
async function auditUnattachedPublicFinals(nowMs: number): Promise<R2RetentionPart> {
  const part = emptyPart();
  if (!Number.isFinite(nowMs)) throw new Error("The R2 retention clock is invalid.");
  const cutoff = new Date(nowMs - R2_FINAL_ORPHAN_GRACE_MS).toISOString();
  const rows = await db()`
    WITH candidate_keys AS MATERIALIZED (
      SELECT upload.public_key
      FROM bhashan.r2_video_upload_intents AS upload
      WHERE upload.status = 'completed'
        AND upload.public_key IS NOT NULL
      GROUP BY upload.public_key
      HAVING max(upload.completed_at) <= ${cutoff}::timestamptz
        AND bool_and(upload.attached_statement_id IS NULL)
        AND bool_or(upload.orphaned_at IS NULL)
        AND NOT EXISTS (
          SELECT 1
          FROM bhashan.statements AS statement
          WHERE statement.document #>> '{video,platform}' = 'r2'
            AND statement.document #>> '{video,id}' = upload.public_key
        )
      ORDER BY min(upload.completed_at), upload.public_key
      LIMIT ${R2_FINAL_ORPHAN_AUDIT_LIMIT}
    ), flagged AS (
      UPDATE bhashan.r2_video_upload_intents AS upload
      SET orphaned_at = clock_timestamp(), updated_at = clock_timestamp()
      FROM candidate_keys AS candidate
      WHERE upload.public_key = candidate.public_key
        AND upload.status = 'completed'
        AND upload.attached_statement_id IS NULL
        AND upload.orphaned_at IS NULL
      RETURNING upload.public_key
    ), flagged_keys AS (
      SELECT DISTINCT flagged.public_key
      FROM flagged
    ), logged AS (
      INSERT INTO bhashan.audit_events (
        table_schema, table_name, target_id, operation, actor, action, detail, after_row
      )
      SELECT
        'r2',
        'public-final',
        flagged_keys.public_key,
        'UPDATE',
        'System retention job',
        'r2-public-orphan-audit',
        'Flagged an unattached public R2 final after the 24-hour attachment grace period.',
        jsonb_build_object(
          'key', flagged_keys.public_key,
          'automaticDeletion', false,
          'reason', 'unattached-final'
        )
      FROM flagged_keys
      RETURNING target_id
    )
    SELECT public_key
    FROM flagged_keys
  `;
  const keys = (rows as unknown as PublicFinalOrphanRow[])
    .map((row) => String(row.public_key))
    .filter(isR2VideoObjectKey);
  if (keys.length !== (rows as unknown as unknown[]).length) {
    throw new Error("The R2 public-final orphan audit returned an invalid key.");
  }
  part.scanned = keys.length;
  part.candidates = keys.length;
  return part;
}

/**
 * Clean only private quarantine. Content-addressed public evidence is never
 * deleted automatically: doing so could race a statement save or an identical
 * re-upload. Any failed R2 operation or durable completion audit is reported
 * as failed so the cron route returns a monitoring-visible non-2xx response.
 */
export async function runR2Retention(nowMs = Date.now()): Promise<R2RetentionResult> {
  let quarantine = emptyPart();
  let final = emptyPart();
  if (!r2StorageConfigured()) {
    return { status: "skipped", reason: "not_configured", quarantine, final };
  }
  try {
    final = await auditUnattachedPublicFinals(nowMs);
    quarantine = await cleanQuarantine(nowMs);
  } catch (error) {
    console.error("R2 retention failed", error);
    const reason = String(error).includes("audited") ? "audit_failed" : "r2_failed";
    return { status: "failed", reason, quarantine, final };
  }
  return { status: "completed", quarantine, final };
}
