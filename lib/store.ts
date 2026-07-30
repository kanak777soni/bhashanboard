import "server-only";
import { unstable_noStore as noStore } from "next/cache";
import { db } from "./db";
import {
  assertStatementHasNoVotes,
  statementRatingLockKey,
} from "./statement-rating-lock";
import type { SourceRole } from "./types";

export type StatementStatus =
  | "published"
  | "held_parity"
  | "held_review"
  | "private_draft"
  | "withdrawn";

export interface StoredStatement {
  id: string;
  /** Optimistic-concurrency token from bhashan.statements.version. */
  version: number;
  status: StatementStatus;
  speaker_id: string;
  party_at_time: string;
  office_at_time: string;
  state: string;
  date: string;
  date_precision?: string;
  venue: string;
  language: string;
  category: string;
  neutral_title: string;
  quote: string | null;
  quote_translation?: string;
  quote_note?: string;
  claim: string;
  context?: string;
  counterpoint?: string;
  policy_note?: string;
  hall_of_fame?: boolean;
  video?: {
    platform?: string;
    id?: string;
    assetId?: string;
    version?: number;
    bytes?: number;
    derivedBytes?: number;
    durationMs?: number;
    format?: string;
    start?: number;
    end?: number;
  };
  axes: Record<string, number>;
  verification: {
    stage: string;
    best_source_tier: string;
    needs?: string[];
    sources?: {
      tier?: string;
      publisher?: string;
      title?: string;
      url?: string;
      role?: SourceRole;
    }[];
  };
}

export type StatementDocument = Omit<StoredStatement, "id" | "version">;

export interface StoredPolitician {
  id: string;
  version: number;
  name: string;
  party: string;
  state: string;
  notes?: string;
}

export type PoliticianDocument = Omit<StoredPolitician, "id" | "version">;

export interface AuditEntry {
  at: string;
  actor: string;
  action: string;
  target: string;
  detail: string;
}

export interface AuditContext {
  actor: string;
  action: string;
  detail: string;
}

export interface CloudinaryUploadAttachment {
  actorId: string;
  uploadIntentId: string;
}

interface DocumentRow {
  id: unknown;
  document: unknown;
  version: unknown;
}

interface StatementEditRow extends DocumentRow {
  has_votes: unknown;
}

interface AuditRow {
  occurred_at: unknown;
  actor: unknown;
  action: unknown;
  target_id: unknown;
  detail: unknown;
}

function objectDocument(value: unknown, table: string, id: string): Record<string, unknown> {
  let parsed = value;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      throw new Error(`${table} ${id} has invalid JSON in document.`);
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${table} ${id} has a non-object document.`);
  }
  return parsed as Record<string, unknown>;
}

function rowVersion(value: unknown, table: string, id: string): number {
  const version = Number(value);
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new Error(`${table} ${id} has invalid version ${String(value)}.`);
  }
  return version;
}

function mapStatement(row: DocumentRow): StoredStatement {
  const id = String(row.id);
  const document = objectDocument(row.document, "Statement", id);
  return {
    ...(document as unknown as StatementDocument),
    id,
    version: rowVersion(row.version, "Statement", id),
  };
}

function mapPolitician(row: DocumentRow): StoredPolitician {
  const id = String(row.id);
  const document = objectDocument(row.document, "Politician", id);
  return {
    ...(document as unknown as PoliticianDocument),
    id,
    version: rowVersion(row.version, "Politician", id),
  };
}

function statementJson(document: StatementDocument): string {
  return JSON.stringify(document);
}

function politicianJson(document: PoliticianDocument): string {
  return JSON.stringify(document);
}

function mutationRow(rows: unknown, table: string, id: string): DocumentRow {
  const list = rows as DocumentRow[];
  if (!Array.isArray(list) || list.length !== 1) {
    throw new Error(`${table} ${id} is missing or was changed by another admin. Reload and try again.`);
  }
  return list[0];
}

function auditValues(audit: AuditContext): [string, string, string] {
  const actor = audit.actor.trim();
  const action = audit.action.trim();
  const detail = audit.detail.trim();
  if (!actor || !action || !detail) {
    throw new Error("Audited mutations require actor, action, and detail.");
  }
  return [actor, action, detail];
}

// ── reads ────────────────────────────────────────────────────────────

export async function getStatements(): Promise<StoredStatement[]> {
  noStore();
  const rows = await db()`
    SELECT id, document, version
    FROM bhashan.statements
    ORDER BY id
  `;
  return (rows as unknown as DocumentRow[]).map(mapStatement);
}

export async function getStatement(id: string): Promise<StoredStatement | undefined> {
  noStore();
  const rows = await db()`
    SELECT id, document, version
    FROM bhashan.statements
    WHERE id = ${id}
    LIMIT 1
  `;
  const row = (rows as unknown as DocumentRow[])[0];
  return row ? mapStatement(row) : undefined;
}

export async function getStatementVoteCounts(): Promise<Map<string, number>> {
  noStore();
  const rows = await db()`
    SELECT
      statement.id,
      count(vote.id)::integer AS vote_count
    FROM bhashan.statements AS statement
    LEFT JOIN bhashan.statement_votes AS vote
      ON vote.statement_id = statement.id
    GROUP BY statement.id
  `;
  return new Map(
    (
      rows as unknown as Array<{ id: unknown; vote_count: unknown }>
    ).map((row) => {
      const count = Number(row.vote_count);
      if (!Number.isSafeInteger(count) || count < 0) {
        throw new Error(`Statement ${String(row.id)} has an invalid vote count.`);
      }
      return [String(row.id), count] as const;
    })
  );
}

export async function getStatementVoteCount(id: string): Promise<number> {
  noStore();
  const rows = await db()`
    SELECT count(*)::integer AS vote_count
    FROM bhashan.statement_votes
    WHERE statement_id = ${id}
  `;
  const count = Number(
    (rows as unknown as Array<{ vote_count: unknown }>)[0]?.vote_count ?? 0
  );
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error(`Statement ${id} has an invalid vote count.`);
  }
  return count;
}

export async function getPoliticians(): Promise<StoredPolitician[]> {
  noStore();
  const rows = await db()`
    SELECT id, document, version
    FROM bhashan.politicians
    ORDER BY id
  `;
  return (rows as unknown as DocumentRow[]).map(mapPolitician);
}

export async function getParties(): Promise<{ id: string; name: string; ink?: string }[]> {
  noStore();
  const rows = await db()`
    SELECT id, document
    FROM bhashan.parties
    ORDER BY id
  `;
  return (rows as unknown as Pick<DocumentRow, "id" | "document">[]).map((row) => {
    const id = String(row.id);
    const document = objectDocument(row.document, "Party", id);
    return {
      id,
      name: String(document.name ?? id),
      ink: typeof document.ink === "string" ? document.ink : undefined,
    };
  });
}

export async function getAudit(limit = 1000): Promise<AuditEntry[]> {
  noStore();
  const requestedLimit = Number.isFinite(limit) ? Math.trunc(limit) : 1000;
  const safeLimit = Math.min(Math.max(requestedLimit, 1), 1000);
  const rows = await db()`
    SELECT occurred_at, actor, action, target_id, detail
    FROM bhashan.audit_events
    ORDER BY occurred_at DESC, event_id DESC
    LIMIT ${safeLimit}
  `;
  return (rows as unknown as AuditRow[]).map((row) => {
    const date = row.occurred_at instanceof Date ? row.occurred_at : new Date(String(row.occurred_at));
    if (Number.isNaN(date.getTime())) throw new Error("Audit event has an invalid occurred_at timestamp.");
    return {
      at: date.toISOString(),
      actor: String(row.actor),
      action: String(row.action),
      target: String(row.target_id),
      detail: String(row.detail),
    };
  });
}

// ── audited row mutations ───────────────────────────────────────────

export async function createStatementRecord(
  document: StatementDocument,
  audit: AuditContext,
  cloudinaryAttachment?: CloudinaryUploadAttachment
): Promise<StoredStatement> {
  const [actor, action, detail] = auditValues(audit);
  const payload = statementJson(document);
  const result = await db().transaction((tx) => [
    tx`SELECT set_config('bhashan.actor', ${actor}, true)`,
    tx`SELECT set_config('bhashan.action', ${action}, true)`,
    tx`SELECT set_config('bhashan.detail', ${detail}, true)`,
    tx`
      WITH next_statement AS (
        SELECT
          'IN-' || lpad(nextval('bhashan.statement_number_seq')::text, 4, '0') AS id
      ), inserted AS (
        INSERT INTO bhashan.statements (id, document)
        SELECT
          id,
          jsonb_set(${payload}::jsonb, '{id}', to_jsonb(id), true)
        FROM next_statement
        RETURNING id, document, version
      ), attached AS (
        UPDATE bhashan.cloudinary_video_upload_intents AS upload
        SET
          attached_statement_id = inserted.id,
          attached_at = coalesce(upload.attached_at, clock_timestamp()),
          detached_at = NULL,
          updated_at = clock_timestamp()
        FROM inserted
        WHERE upload.id = ${cloudinaryAttachment?.uploadIntentId ?? null}::uuid
          AND upload.actor_user_id = ${cloudinaryAttachment?.actorId ?? null}
          AND upload.status = 'completed'
          AND upload.rights_attested_at IS NOT NULL
          AND upload.public_id = inserted.document #>> '{video,id}'
          AND upload.asset_id = inserted.document #>> '{video,assetId}'
          AND upload.version::text = inserted.document #>> '{video,version}'
          AND upload.actual_bytes::text = inserted.document #>> '{video,bytes}'
          AND upload.derived_bytes::text = inserted.document #>> '{video,derivedBytes}'
          AND upload.duration_ms::text = inserted.document #>> '{video,durationMs}'
          AND upload.format = inserted.document #>> '{video,format}'
          AND inserted.document #>> '{video,start}' = '0'
          AND ((upload.duration_ms + 999) / 1000)::text
            = inserted.document #>> '{video,end}'
          AND inserted.document #>> '{video,platform}' = 'cloudinary'
          AND upload.attached_statement_id IS NULL
        RETURNING upload.id
      ), attachment_assertion AS (
        SELECT
          1 / CASE
            WHEN (
              (inserted.document #>> '{video,platform}' = 'cloudinary')
              = (${cloudinaryAttachment?.uploadIntentId ?? null}::uuid IS NOT NULL)
            )
            AND (
              ${cloudinaryAttachment?.uploadIntentId ?? null}::uuid IS NULL
              OR EXISTS (SELECT 1 FROM attached)
            )
            THEN 1
            ELSE 0
          END AS ok
        FROM inserted
      )
      SELECT
        inserted.id,
        inserted.document,
        inserted.version,
        attachment_assertion.ok AS attachment_ok
      FROM inserted
      CROSS JOIN attachment_assertion
    `,
  ]);
  return mapStatement(mutationRow(result[3], "Statement", "new"));
}

export async function updateStatementRecord(
  id: string,
  document: StatementDocument,
  expectedVersion: number,
  audit: AuditContext,
  cloudinaryAttachment?: CloudinaryUploadAttachment
): Promise<StoredStatement> {
  const [actor, action, detail] = auditValues(audit);
  const payload = statementJson(document);
  const result = await db().transaction((tx) => [
    tx`SELECT set_config('bhashan.actor', ${actor}, true)`,
    tx`SELECT set_config('bhashan.action', ${action}, true)`,
    tx`SELECT set_config('bhashan.detail', ${detail}, true)`,
    tx`SELECT pg_advisory_xact_lock(hashtextextended('bhashan:seed-ladder', 0))`,
    tx`SELECT pg_advisory_xact_lock(
      hashtextextended(${statementRatingLockKey(id)}, 0)
    )`,
    tx`
      WITH edit_state AS MATERIALIZED (
        SELECT EXISTS (
          SELECT 1
          FROM bhashan.statement_votes AS vote
          WHERE vote.statement_id = ${id}
        ) AS has_votes
      ),
      updated AS (
        UPDATE bhashan.statements AS statement
        SET
          document = jsonb_set(
            ${payload}::jsonb,
            '{id}',
            to_jsonb(statement.id),
            true
          ),
          version = statement.version + 1,
          updated_at = now()
        FROM edit_state
        WHERE statement.id = ${id}
          AND statement.version = ${expectedVersion}
          AND NOT edit_state.has_votes
        RETURNING statement.id, statement.document, statement.version
      ), detached AS (
        UPDATE bhashan.cloudinary_video_upload_intents AS upload
        SET
          attached_statement_id = NULL,
          attached_at = NULL,
          detached_at = clock_timestamp(),
          updated_at = clock_timestamp()
        FROM updated
        WHERE upload.attached_statement_id = updated.id
          AND (
            updated.document #>> '{video,platform}' IS DISTINCT FROM 'cloudinary'
            OR upload.public_id IS DISTINCT FROM updated.document #>> '{video,id}'
          )
        RETURNING upload.id
      ), attached AS (
        UPDATE bhashan.cloudinary_video_upload_intents AS upload
        SET
          attached_statement_id = updated.id,
          attached_at = coalesce(upload.attached_at, clock_timestamp()),
          detached_at = NULL,
          updated_at = clock_timestamp()
        FROM updated
        WHERE upload.id = ${cloudinaryAttachment?.uploadIntentId ?? null}::uuid
          AND upload.actor_user_id = ${cloudinaryAttachment?.actorId ?? null}
          AND upload.status = 'completed'
          AND upload.rights_attested_at IS NOT NULL
          AND upload.public_id = updated.document #>> '{video,id}'
          AND upload.asset_id = updated.document #>> '{video,assetId}'
          AND upload.version::text = updated.document #>> '{video,version}'
          AND upload.actual_bytes::text = updated.document #>> '{video,bytes}'
          AND upload.derived_bytes::text = updated.document #>> '{video,derivedBytes}'
          AND upload.duration_ms::text = updated.document #>> '{video,durationMs}'
          AND upload.format = updated.document #>> '{video,format}'
          AND updated.document #>> '{video,start}' = '0'
          AND ((upload.duration_ms + 999) / 1000)::text
            = updated.document #>> '{video,end}'
          AND updated.document #>> '{video,platform}' = 'cloudinary'
          AND (
            upload.attached_statement_id IS NULL
            OR upload.attached_statement_id = updated.id
          )
        RETURNING upload.id
      ), retained_attachment AS (
        SELECT upload.id
        FROM bhashan.cloudinary_video_upload_intents AS upload
        JOIN updated ON upload.attached_statement_id = updated.id
        WHERE upload.status = 'completed'
          AND upload.rights_attested_at IS NOT NULL
          AND upload.public_id = updated.document #>> '{video,id}'
          AND upload.asset_id = updated.document #>> '{video,assetId}'
          AND upload.version::text = updated.document #>> '{video,version}'
          AND upload.actual_bytes::text = updated.document #>> '{video,bytes}'
          AND upload.derived_bytes::text = updated.document #>> '{video,derivedBytes}'
          AND upload.duration_ms::text = updated.document #>> '{video,durationMs}'
          AND upload.format = updated.document #>> '{video,format}'
          AND updated.document #>> '{video,start}' = '0'
          AND ((upload.duration_ms + 999) / 1000)::text
            = updated.document #>> '{video,end}'
          AND updated.document #>> '{video,platform}' = 'cloudinary'
      ), attachment_assertion AS (
        SELECT
          1 / CASE
            WHEN (
              updated.document #>> '{video,platform}' = 'cloudinary'
              AND (
                EXISTS (SELECT 1 FROM attached)
                OR EXISTS (SELECT 1 FROM retained_attachment)
              )
            )
            OR (
              updated.document #>> '{video,platform}' IS DISTINCT FROM 'cloudinary'
              AND ${cloudinaryAttachment?.uploadIntentId ?? null}::uuid IS NULL
            )
            THEN 1
            ELSE 0
          END AS ok
        FROM updated
      )
      SELECT
        updated.id,
        updated.document,
        updated.version,
        edit_state.has_votes,
        attachment_assertion.ok AS attachment_ok,
        detached_state.detached_count
      FROM edit_state
      LEFT JOIN updated ON true
      LEFT JOIN attachment_assertion ON true
      LEFT JOIN LATERAL (SELECT count(*) AS detached_count FROM detached) AS detached_state ON true
    `,
  ]);
  const outcome = (result[5] as unknown as StatementEditRow[])[0];
  assertStatementHasNoVotes(id, outcome?.has_votes);
  return mapStatement(
    mutationRow(outcome?.id == null ? [] : [outcome], "Statement", id)
  );
}

/**
 * Editorial profile marks are deliberately separate from public rating
 * inputs. This narrow mutation remains available after voting starts, while
 * the clip, wording, attribution, and every ballot stay immutable.
 */
export async function updateStatementAxes(
  id: string,
  axes: Record<string, number>,
  expectedVersion: number,
  audit: AuditContext
): Promise<StoredStatement> {
  const [actor, action, detail] = auditValues(audit);
  const payload = JSON.stringify(axes);
  const result = await db().transaction((tx) => [
    tx`SELECT set_config('bhashan.actor', ${actor}, true)`,
    tx`SELECT set_config('bhashan.action', ${action}, true)`,
    tx`SELECT set_config('bhashan.detail', ${detail}, true)`,
    tx`SELECT pg_advisory_xact_lock(
      hashtextextended(${statementRatingLockKey(id)}, 0)
    )`,
    tx`
      UPDATE bhashan.statements
      SET
        document = jsonb_set(
          document,
          '{axes}',
          ${payload}::jsonb,
          true
        ),
        version = version + 1,
        updated_at = now()
      WHERE id = ${id} AND version = ${expectedVersion}
      RETURNING id, document, version
    `,
  ]);
  return mapStatement(mutationRow(result[4], "Statement", id));
}

export async function setStatementStatus(
  id: string,
  status: StatementStatus,
  expectedVersion: number,
  audit: AuditContext
): Promise<StoredStatement> {
  const [actor, action, detail] = auditValues(audit);
  const result = await db().transaction((tx) => [
    tx`SELECT set_config('bhashan.actor', ${actor}, true)`,
    tx`SELECT set_config('bhashan.action', ${action}, true)`,
    tx`SELECT set_config('bhashan.detail', ${detail}, true)`,
    tx`SELECT pg_advisory_xact_lock(hashtextextended('bhashan:seed-ladder', 0))`,
    tx`SELECT pg_advisory_xact_lock(
      hashtextextended(${statementRatingLockKey(id)}, 0)
    )`,
    tx`
      UPDATE bhashan.statements
      SET
        document = jsonb_set(
          CASE
            WHEN ${status}::text = 'published' THEN document
            ELSE jsonb_set(document, '{hall_of_fame}', 'false'::jsonb, true)
          END,
          '{status}',
          to_jsonb(${status}::text),
          true
        ),
        version = version + 1,
        updated_at = now()
      WHERE id = ${id} AND version = ${expectedVersion}
      RETURNING id, document, version
    `,
  ]);
  return mapStatement(mutationRow(result[5], "Statement", id));
}

export async function setStatementHallOfFame(
  id: string,
  value: boolean,
  expectedVersion: number,
  audit: AuditContext
): Promise<StoredStatement> {
  const [actor, action, detail] = auditValues(audit);
  const result = await db().transaction((tx) => [
    tx`SELECT set_config('bhashan.actor', ${actor}, true)`,
    tx`SELECT set_config('bhashan.action', ${action}, true)`,
    tx`SELECT set_config('bhashan.detail', ${detail}, true)`,
    tx`SELECT pg_advisory_xact_lock(
      hashtextextended(${statementRatingLockKey(id)}, 0)
    )`,
    tx`
      UPDATE bhashan.statements
      SET
        document = jsonb_set(document, '{hall_of_fame}', to_jsonb(${value}::boolean), true),
        version = version + 1,
        updated_at = now()
      WHERE id = ${id} AND version = ${expectedVersion}
      RETURNING id, document, version
    `,
  ]);
  return mapStatement(mutationRow(result[4], "Statement", id));
}

export async function createPoliticianRecord(
  id: string,
  document: PoliticianDocument,
  audit: AuditContext
): Promise<StoredPolitician> {
  const [actor, action, detail] = auditValues(audit);
  const payload = politicianJson(document);
  const result = await db().transaction((tx) => [
    tx`SELECT set_config('bhashan.actor', ${actor}, true)`,
    tx`SELECT set_config('bhashan.action', ${action}, true)`,
    tx`SELECT set_config('bhashan.detail', ${detail}, true)`,
    tx`
      INSERT INTO bhashan.politicians (id, document)
      VALUES (
        ${id},
        jsonb_set(${payload}::jsonb, '{id}', to_jsonb(${id}::text), true)
      )
      RETURNING id, document, version
    `,
  ]);
  return mapPolitician(mutationRow(result[3], "Politician", id));
}

// ── derived ranking ─────────────────────────────────────────────────

export function coverage(statements: StoredStatement[]): { party: string; count: number; pct: number }[] {
  const live = statements.filter((statement) => statement.status === "published");
  const counts = new Map<string, number>();
  live.forEach((statement) =>
    counts.set(statement.party_at_time, (counts.get(statement.party_at_time) ?? 0) + 1)
  );
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([party, count]) => ({
      party,
      count,
      pct: Math.round((count / (live.length || 1)) * 100),
    }));
}
