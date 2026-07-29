import "server-only";

import { randomUUID } from "node:crypto";
import { unstable_noStore as noStore } from "next/cache";
import { db } from "./db";
import type { StatementDocument } from "./store";
import type {
  SubmissionPlatform,
  ValidatedPublicSubmission,
} from "./submission-validation";

export type PublicSubmissionStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "spam";

export type AcknowledgementStatus =
  | "pending"
  | "sent"
  | "failed"
  | "not_configured";

export interface StoredPublicSubmission {
  id: string;
  status: PublicSubmissionStatus;
  sourceUrl: string;
  sourcePlatform: SubmissionPlatform;
  startSeconds: number | null;
  endSeconds: number | null;
  speaker: string;
  eventContext: string;
  claim: string;
  originalLanguage: string;
  submitterName: string;
  contactEmail: string;
  acknowledgementStatus: AcknowledgementStatus;
  acknowledgementSentAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
  draftStatementId?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface PublicSubmissionEvent {
  event: string;
  actor: string;
  detail: string;
  occurredAt: string;
}

interface SubmissionRow {
  id: unknown;
  status: unknown;
  source_url: unknown;
  source_platform: unknown;
  start_seconds: unknown;
  end_seconds: unknown;
  speaker: unknown;
  event_context: unknown;
  claim: unknown;
  original_language: unknown;
  submitter_name: unknown;
  contact_email: unknown;
  acknowledgement_status: unknown;
  acknowledgement_sent_at: unknown;
  reviewed_by: unknown;
  reviewed_at: unknown;
  review_note: unknown;
  draft_statement_id: unknown;
  version: unknown;
  created_at: unknown;
  updated_at: unknown;
}

interface EventRow {
  event: unknown;
  actor: unknown;
  detail: unknown;
  occurred_at: unknown;
}

function iso(value: unknown, label: string): string {
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Submission has an invalid ${label}.`);
  }
  return date.toISOString();
}

function optionalIso(value: unknown, label: string): string | undefined {
  return value === null || value === undefined ? undefined : iso(value, label);
}

function nullableInteger(value: unknown, label: string): number | null {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new Error(`Submission has an invalid ${label}.`);
  }
  return number;
}

function submissionStatus(value: unknown): PublicSubmissionStatus {
  if (
    value !== "pending" &&
    value !== "accepted" &&
    value !== "rejected" &&
    value !== "spam"
  ) {
    throw new Error("Submission has an invalid status.");
  }
  return value;
}

function platform(value: unknown): SubmissionPlatform {
  if (
    value !== "youtube" &&
    value !== "facebook" &&
    value !== "instagram" &&
    value !== "other"
  ) {
    throw new Error("Submission has an invalid source platform.");
  }
  return value;
}

function acknowledgement(value: unknown): AcknowledgementStatus {
  if (
    value !== "pending" &&
    value !== "sent" &&
    value !== "failed" &&
    value !== "not_configured"
  ) {
    throw new Error("Submission has an invalid acknowledgement status.");
  }
  return value;
}

function mapSubmission(row: SubmissionRow): StoredPublicSubmission {
  const version = Number(row.version);
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new Error("Submission has an invalid version.");
  }
  return {
    id: String(row.id),
    status: submissionStatus(row.status),
    sourceUrl: String(row.source_url),
    sourcePlatform: platform(row.source_platform),
    startSeconds: nullableInteger(row.start_seconds, "start timestamp"),
    endSeconds: nullableInteger(row.end_seconds, "end timestamp"),
    speaker: String(row.speaker),
    eventContext: String(row.event_context),
    claim: String(row.claim),
    originalLanguage: String(row.original_language),
    submitterName: String(row.submitter_name),
    contactEmail: String(row.contact_email),
    acknowledgementStatus: acknowledgement(row.acknowledgement_status),
    acknowledgementSentAt: optionalIso(
      row.acknowledgement_sent_at,
      "acknowledgement time"
    ),
    reviewedBy:
      row.reviewed_by === null || row.reviewed_by === undefined
        ? undefined
        : String(row.reviewed_by),
    reviewedAt: optionalIso(row.reviewed_at, "review time"),
    reviewNote:
      row.review_note === null || row.review_note === undefined
        ? undefined
        : String(row.review_note),
    draftStatementId:
      row.draft_statement_id === null || row.draft_statement_id === undefined
        ? undefined
        : String(row.draft_statement_id),
    version,
    createdAt: iso(row.created_at, "creation time"),
    updatedAt: iso(row.updated_at, "update time"),
  };
}

function assertSubmissionId(id: string): string {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id
    )
  ) {
    throw new Error("Invalid submission identifier.");
  }
  return id;
}

export async function createPublicSubmission(
  input: ValidatedPublicSubmission
): Promise<{ id: string }> {
  const id = randomUUID();
  const result = await db().transaction((tx) => [
    tx`
      INSERT INTO bhashan.public_submissions (
        id, source_url, source_platform, start_seconds, end_seconds,
        speaker, event_context, claim, original_language, submitter_name,
        contact_email, synthetic_declaration
      ) VALUES (
        ${id}::uuid, ${input.sourceUrl}, ${input.sourcePlatform},
        ${input.startSeconds}, ${input.endSeconds}, ${input.speaker},
        ${input.eventContext}, ${input.claim}, ${input.originalLanguage},
        ${input.submitterName}, ${input.contactEmail}, true
      )
      RETURNING id
    `,
    tx`
      INSERT INTO bhashan.public_submission_events (
        submission_id, event, actor, detail
      ) VALUES (
        ${id}::uuid, 'submitted', 'Public submission form',
        'Evidence lead entered the private moderation queue.'
      )
    `,
  ]);
  const rows = result[0] as unknown as { id: unknown }[];
  if (!Array.isArray(rows) || rows.length !== 1) {
    throw new Error("The submission could not be recorded.");
  }
  return { id: String(rows[0].id) };
}

export async function setSubmissionAcknowledgement(
  id: string,
  status: Exclude<AcknowledgementStatus, "pending">
): Promise<void> {
  assertSubmissionId(id);
  const event =
    status === "sent"
      ? "acknowledged"
      : status === "not_configured"
        ? "acknowledgement_skipped"
        : "acknowledgement_failed";
  const detail =
    status === "sent"
      ? "Submission acknowledgement sent."
      : status === "not_configured"
        ? "Acknowledgement skipped because transactional mail is not configured."
        : "Acknowledgement could not be sent; the submission remains queued.";

  await db()`
    WITH updated AS (
      UPDATE bhashan.public_submissions
      SET
        acknowledgement_status = ${status},
        acknowledgement_sent_at = CASE
          WHEN ${status} = 'sent' THEN clock_timestamp()
          ELSE NULL
        END,
        version = version + 1,
        updated_at = clock_timestamp()
      WHERE id = ${id}::uuid
        AND acknowledgement_status = 'pending'
      RETURNING id
    )
    INSERT INTO bhashan.public_submission_events (
      submission_id, event, actor, detail
    )
    SELECT id, ${event}, 'Transactional mail service', ${detail}
    FROM updated
  `;
}

export async function getPublicSubmissions({
  status,
  limit = 200,
}: {
  status?: PublicSubmissionStatus;
  limit?: number;
} = {}): Promise<StoredPublicSubmission[]> {
  noStore();
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 500);
  const rows = status
    ? await db()`
        SELECT *
        FROM bhashan.public_submissions
        WHERE status = ${status}
        ORDER BY created_at DESC
        LIMIT ${safeLimit}
      `
    : await db()`
        SELECT *
        FROM bhashan.public_submissions
        ORDER BY
          CASE status WHEN 'pending' THEN 0 ELSE 1 END,
          created_at DESC
        LIMIT ${safeLimit}
      `;
  return (rows as unknown as SubmissionRow[]).map(mapSubmission);
}

export async function getPublicSubmission(
  id: string
): Promise<
  | {
      submission: StoredPublicSubmission;
      events: PublicSubmissionEvent[];
    }
  | undefined
> {
  noStore();
  assertSubmissionId(id);
  const [submissions, events] = await Promise.all([
    db()`
      SELECT *
      FROM bhashan.public_submissions
      WHERE id = ${id}::uuid
      LIMIT 1
    `,
    db()`
      SELECT event, actor, detail, occurred_at
      FROM bhashan.public_submission_events
      WHERE submission_id = ${id}::uuid
      ORDER BY occurred_at, event_id
    `,
  ]);
  const row = (submissions as unknown as SubmissionRow[])[0];
  if (!row) return undefined;
  return {
    submission: mapSubmission(row),
    events: (events as unknown as EventRow[]).map((event) => ({
      event: String(event.event),
      actor: String(event.actor),
      detail: String(event.detail),
      occurredAt: iso(event.occurred_at, "event time"),
    })),
  };
}

export async function rejectPublicSubmission({
  id,
  version,
  disposition,
  note,
  reviewerId,
  actorLabel,
}: {
  id: string;
  version: number;
  disposition: "rejected" | "spam";
  note: string;
  reviewerId: string;
  actorLabel: string;
}): Promise<void> {
  assertSubmissionId(id);
  const cleanNote = note.replace(/\s+/g, " ").trim();
  if (cleanNote.length < 3 || cleanNote.length > 1_000) {
    throw new Error("A review note between 3 and 1,000 characters is required.");
  }
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new Error("Invalid submission version.");
  }
  const rows = await db()`
    WITH updated AS (
      UPDATE bhashan.public_submissions
      SET
        status = ${disposition},
        reviewed_by = ${reviewerId},
        reviewed_at = clock_timestamp(),
        review_note = ${cleanNote},
        version = version + 1,
        updated_at = clock_timestamp()
      WHERE id = ${id}::uuid
        AND status = 'pending'
        AND version = ${version}
      RETURNING id
    ), logged AS (
      INSERT INTO bhashan.public_submission_events (
        submission_id, event, actor, detail
      )
      SELECT id, ${disposition}, ${actorLabel}, ${cleanNote}
      FROM updated
      RETURNING submission_id
    )
    SELECT id FROM updated
  `;
  if ((rows as unknown as unknown[]).length !== 1) {
    throw new Error(
      "This submission was already reviewed or changed. Reload and try again."
    );
  }
}

export async function acceptPublicSubmissionAsDraft({
  id,
  version,
  document,
  reviewerId,
  actorLabel,
}: {
  id: string;
  version: number;
  document: StatementDocument;
  reviewerId: string;
  actorLabel: string;
}): Promise<string> {
  assertSubmissionId(id);
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new Error("Invalid submission version.");
  }
  if (document.status !== "private_draft") {
    throw new Error("A public submission can only create a private draft.");
  }
  const payload = JSON.stringify(document);
  const detail = `Accepted public submission ${id} into a private draft.`;
  const result = await db().transaction((tx) => [
    tx`SELECT set_config('bhashan.actor', ${actorLabel}, true)`,
    tx`SELECT set_config('bhashan.action', 'submission-accept', true)`,
    tx`SELECT set_config('bhashan.detail', ${detail}, true)`,
    tx`
      WITH target AS MATERIALIZED (
        SELECT id
        FROM bhashan.public_submissions
        WHERE id = ${id}::uuid
          AND status = 'pending'
          AND version = ${version}
        FOR UPDATE
      ), next_statement AS (
        SELECT
          'IN-' || lpad(nextval('bhashan.statement_number_seq')::text, 4, '0') AS id
        FROM target
      ), inserted AS (
        INSERT INTO bhashan.statements (id, document)
        SELECT
          id,
          jsonb_set(${payload}::jsonb, '{id}', to_jsonb(id), true)
        FROM next_statement
        RETURNING id
      ), updated AS (
        UPDATE bhashan.public_submissions AS submission
        SET
          status = 'accepted',
          reviewed_by = ${reviewerId},
          reviewed_at = clock_timestamp(),
          review_note = 'Accepted into a private draft.',
          draft_statement_id = inserted.id,
          version = submission.version + 1,
          updated_at = clock_timestamp()
        FROM inserted
        WHERE submission.id = ${id}::uuid
        RETURNING submission.id, inserted.id AS draft_statement_id
      ), logged AS (
        INSERT INTO bhashan.public_submission_events (
          submission_id, event, actor, detail
        )
        SELECT
          updated.id, 'accepted', ${actorLabel},
          'Created private draft ' || updated.draft_statement_id || '.'
        FROM updated
        RETURNING submission_id
      )
      SELECT updated.draft_statement_id
      FROM updated
      CROSS JOIN logged
    `,
  ]);
  const rows = result[3] as unknown as { draft_statement_id: unknown }[];
  if (!Array.isArray(rows) || rows.length !== 1) {
    throw new Error(
      "This submission was already reviewed or changed. Reload and try again."
    );
  }
  return String(rows[0].draft_statement_id);
}
