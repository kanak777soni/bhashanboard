import "server-only";

import { randomUUID } from "node:crypto";
import { db } from "./db";
import { parseRatingAggregate } from "./rating-aggregate";
import {
  calculateRating,
  isVoteValue,
  PUBLIC_EMPTY_PERFORMANCE,
  RATING_MODEL_VERSION,
  RATING_PRIOR_STRENGTH,
  type VoteValue,
} from "./rating";
import { statementRatingLockKey } from "./statement-rating-lock";
import { committeePublicationIssues } from "./video";
import { getVoteEligibleStatement, isUuid } from "./watch-store";

export type VoteStoreErrorCode =
  | "INVALID_VOTE"
  | "INVALID_RECEIPT_ID"
  | "WATCH_REQUIRED"
  | "VIDEO_CHANGED"
  | "STATEMENT_NOT_FOUND"
  | "STATEMENT_NOT_ELIGIBLE"
  | "ALREADY_VOTED"
  | "VOTE_NOT_FOUND"
  | "VOTE_ALREADY_EXCLUDED"
  | "INVALID_EXCLUSION_REASON"
  | "VOTE_REJECTED";

export class VoteStoreError extends Error {
  constructor(
    readonly code: VoteStoreErrorCode,
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "VoteStoreError";
  }
}

export interface StatementRatingAggregate {
  statementId: string;
  priorPerformance: number;
  priorStrength: number;
  validVoteCount: number;
  validVoteSum: number;
  distribution: Record<VoteValue, number>;
  performance: number;
  gp: number;
  modelVersion: number;
  updatedAt: string;
}

export interface StatementVoteRecord {
  id: string;
  userId: string;
  statementId: string;
  value: VoteValue;
  watchReceiptId: string;
  modelVersion: number;
  createdAt: string;
}

export interface SubmitStatementVoteInput {
  userId: string;
  statementId: string;
  value: VoteValue;
  watchReceiptId: string;
}

export interface SubmitStatementVoteResult {
  vote: StatementVoteRecord;
  rating: StatementRatingAggregate;
}

export interface UserVoteHistoryItem {
  voteId: string;
  statementId: string;
  neutralTitle: string;
  value: VoteValue;
  excluded: boolean;
  exclusionReason?: string;
  excludedAt?: string;
  excludedBy?: string;
  createdAt: string;
}

export interface UserVoteHistoryPage {
  items: UserVoteHistoryItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface CurrentUserStatementVote {
  voteId: string;
  value: VoteValue;
  excluded: boolean;
  createdAt: string;
}

export interface StatementVoteState {
  statementId: string;
  currentUserVote: CurrentUserStatementVote | null;
  rating: StatementRatingAggregate | null;
}

interface AggregateRow {
  statement_id: unknown;
  prior_performance: unknown;
  prior_strength: unknown;
  valid_vote_count: unknown;
  valid_vote_sum: unknown;
  vote_0_count: unknown;
  vote_25_count: unknown;
  vote_50_count: unknown;
  vote_75_count: unknown;
  vote_100_count: unknown;
  performance: unknown;
  gp: unknown;
  model_version: unknown;
  updated_at: unknown;
}

interface SubmitRow extends AggregateRow {
  vote_id: unknown;
  user_id: unknown;
  vote_statement_id: unknown;
  value: unknown;
  watch_receipt_id: unknown;
  vote_model_version: unknown;
  vote_created_at: unknown;
}

interface ExistingVoteRow {
  id: unknown;
}

interface ReceiptDiagnosticRow {
  statement_id: unknown;
  video_fingerprint: unknown;
}

interface StatementDiagnosticRow {
  status: unknown;
}

interface HistoryRow {
  vote_id: unknown;
  statement_id: unknown;
  neutral_title: unknown;
  value: unknown;
  excluded: unknown;
  exclusion_reason: unknown;
  excluded_at: unknown;
  excluded_by: unknown;
  created_at: unknown;
  total_count: unknown;
}

interface VoteStateRow extends AggregateRow {
  record_id: unknown;
  record_document: unknown;
  current_vote_id: unknown;
  current_vote_value: unknown;
  current_vote_excluded: unknown;
  current_vote_created_at: unknown;
}

function safeInteger(value: unknown, name: string): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(number)) throw new Error(`Invalid ${name} returned by the database.`);
  return number;
}

function isoDate(value: unknown, name: string): string {
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid ${name} returned by the database.`);
  return date.toISOString();
}

function mapAggregate(row: AggregateRow): StatementRatingAggregate {
  return parseRatingAggregate(row);
}

function mapSubmission(row: SubmitRow): SubmitStatementVoteResult {
  const value = safeInteger(row.value, "vote value");
  if (!isVoteValue(value)) throw new Error("The database returned an unsupported vote value.");
  return {
    vote: {
      id: String(row.vote_id),
      userId: String(row.user_id),
      statementId: String(row.vote_statement_id),
      value,
      watchReceiptId: String(row.watch_receipt_id),
      modelVersion: safeInteger(row.vote_model_version, "vote model version"),
      createdAt: isoDate(row.vote_created_at, "vote creation time"),
    },
    rating: mapAggregate(row),
  };
}

function validateSubmission(input: SubmitStatementVoteInput): void {
  if (!isVoteValue(input.value)) {
    throw new VoteStoreError(
      "INVALID_VOTE",
      "Choose one of the five positions on the rating bar.",
      400
    );
  }
  if (!isUuid(input.watchReceiptId)) {
    throw new VoteStoreError(
      "INVALID_RECEIPT_ID",
      "The watch receipt identifier is invalid.",
      400
    );
  }
}

/**
 * Insert the immutable ballot and update its cached aggregate in one SQL
 * statement. The database unique constraint is the final protection against
 * double clicks, multiple tabs and concurrent requests.
 */
export async function submitStatementVote(
  input: SubmitStatementVoteInput
): Promise<SubmitStatementVoteResult> {
  validateSubmission(input);
  // A caller can supply only the immutable statement path, the fixed ballot
  // value and a receipt identifier; eligibility and the current video revision
  // come from server-owned records.
  const eligibleStatement = await getVoteEligibleStatement(input.statementId);
  const currentVideoFingerprint = eligibleStatement.video.fingerprint;
  // Persist a neutral, zero-strength compatibility prior. It has no effect on
  // the public arithmetic mean in rating model v2.
  const priorPerformance = PUBLIC_EMPTY_PERFORMANCE;
  // Reuse the pure calculator's strict range checks before a value reaches SQL.
  calculateRating({
    validVoteCount: 0,
    validVoteSum: 0,
  });
  const voteId = randomUUID();
  const sql = db();
  const transactionRows = await sql.transaction((tx) => [
    // Account anonymization acquires this lock before all statement locks.
    // Keeping the same order prevents a final concurrent ballot from escaping
    // the anonymization transaction.
    tx`SELECT pg_advisory_xact_lock(
      hashtextextended(${`bhashan:user-lifecycle:${input.userId}`}, 0)
    )`,
    // The complete publication policy was evaluated against recordVersion
    // above. Full admin edits use this same lock, and the version predicate in
    // current_statement binds that complete check to the atomic vote insert.
    // If an edit wins the lock first, the version changes and this insert
    // fails closed even when the video fingerprint itself stayed the same.
    tx`SELECT pg_advisory_xact_lock(
      hashtextextended(${statementRatingLockKey(input.statementId)}, 0)
    )`,
    tx`
    WITH current_statement AS (
      SELECT id
      FROM bhashan.statements
      WHERE id = ${input.statementId}
        AND version = ${eligibleStatement.recordVersion}
        AND status = 'published'
    ),
    eligible_receipt AS (
      SELECT receipt.id
      FROM bhashan.statement_watch_receipts AS receipt
      JOIN current_statement AS statement
        ON statement.id = receipt.statement_id
      WHERE receipt.id = ${input.watchReceiptId}::uuid
        AND receipt.user_id = ${input.userId}
        AND receipt.statement_id = ${input.statementId}
        AND receipt.video_fingerprint = ${currentVideoFingerprint}
    ),
    inserted_vote AS (
      INSERT INTO bhashan.statement_votes (
        id,
        user_id,
        statement_id,
        value,
        watch_receipt_id,
        rating_model_version
      )
      SELECT
        ${voteId}::uuid,
        ${input.userId},
        ${input.statementId},
        ${input.value},
        receipt.id,
        ${RATING_MODEL_VERSION}
      FROM eligible_receipt AS receipt
      ON CONFLICT DO NOTHING
      RETURNING *
    ),
    updated_rating AS (
      INSERT INTO bhashan.statement_rating_aggregates AS aggregate (
        statement_id,
        prior_performance,
        prior_strength,
        valid_vote_count,
        valid_vote_sum,
        vote_0_count,
        vote_25_count,
        vote_50_count,
        vote_75_count,
        vote_100_count,
        performance,
        gp,
        model_version,
        updated_at
      )
      SELECT
        vote.statement_id,
        ${priorPerformance},
        ${RATING_PRIOR_STRENGTH},
        1,
        vote.value,
        CASE WHEN vote.value = 0 THEN 1 ELSE 0 END,
        CASE WHEN vote.value = 25 THEN 1 ELSE 0 END,
        CASE WHEN vote.value = 50 THEN 1 ELSE 0 END,
        CASE WHEN vote.value = 75 THEN 1 ELSE 0 END,
        CASE WHEN vote.value = 100 THEN 1 ELSE 0 END,
        vote.value,
        1000 + 10 * vote.value,
        ${RATING_MODEL_VERSION},
        clock_timestamp()
      FROM inserted_vote AS vote
      ON CONFLICT (statement_id) DO UPDATE SET
        prior_performance = ${PUBLIC_EMPTY_PERFORMANCE},
        prior_strength = ${RATING_PRIOR_STRENGTH},
        valid_vote_count = aggregate.valid_vote_count + 1,
        valid_vote_sum = aggregate.valid_vote_sum + EXCLUDED.valid_vote_sum,
        vote_0_count = aggregate.vote_0_count + EXCLUDED.vote_0_count,
        vote_25_count = aggregate.vote_25_count + EXCLUDED.vote_25_count,
        vote_50_count = aggregate.vote_50_count + EXCLUDED.vote_50_count,
        vote_75_count = aggregate.vote_75_count + EXCLUDED.vote_75_count,
        vote_100_count = aggregate.vote_100_count + EXCLUDED.vote_100_count,
        performance = (
          aggregate.valid_vote_sum + EXCLUDED.valid_vote_sum
        )::numeric / (aggregate.valid_vote_count + 1),
        gp = round(1000 + 10 * (
          aggregate.valid_vote_sum + EXCLUDED.valid_vote_sum
        )::numeric / (aggregate.valid_vote_count + 1))::integer,
        model_version = ${RATING_MODEL_VERSION},
        updated_at = clock_timestamp()
      RETURNING *
    )
    SELECT
      vote.id AS vote_id,
      vote.user_id,
      vote.statement_id AS vote_statement_id,
      vote.value,
      vote.watch_receipt_id,
      vote.rating_model_version AS vote_model_version,
      vote.created_at AS vote_created_at,
      rating.*
    FROM inserted_vote AS vote
    CROSS JOIN updated_rating AS rating
  `,
  ]);
  const rows = transactionRows[2];

  const inserted = (rows as unknown as SubmitRow[])[0];
  if (inserted) return mapSubmission(inserted);

  const existingRows = await db()`
    SELECT id
    FROM bhashan.statement_votes
    WHERE user_id = ${input.userId} AND statement_id = ${input.statementId}
    LIMIT 1
  `;
  if ((existingRows as unknown as ExistingVoteRow[])[0]) {
    throw new VoteStoreError(
      "ALREADY_VOTED",
      "Your ruling on this statement is already in the record.",
      409
    );
  }

  const receiptRows = await db()`
    SELECT statement_id, video_fingerprint
    FROM bhashan.statement_watch_receipts
    WHERE id = ${input.watchReceiptId}::uuid AND user_id = ${input.userId}
    LIMIT 1
  `;
  const receipt = (receiptRows as unknown as ReceiptDiagnosticRow[])[0];
  if (!receipt || String(receipt.statement_id) !== input.statementId) {
    throw new VoteStoreError(
      "WATCH_REQUIRED",
      "Watch the clip before voting.",
      403
    );
  }
  if (String(receipt.video_fingerprint) !== currentVideoFingerprint) {
    throw new VoteStoreError(
      "VIDEO_CHANGED",
      "The clip changed. Watch the current version before voting.",
      409
    );
  }

  const statementRows = await db()`
    SELECT status
    FROM bhashan.statements
    WHERE id = ${input.statementId}
    LIMIT 1
  `;
  const statement = (statementRows as unknown as StatementDiagnosticRow[])[0];
  if (
    !statement ||
    statement.status !== "published"
  ) {
    throw new VoteStoreError(
      "STATEMENT_NOT_ELIGIBLE",
      "Voting is not open for this statement.",
      409
    );
  }

  throw new VoteStoreError(
    "VOTE_REJECTED",
    "The ruling could not be entered into the record.",
    409
  );
}

export async function getStatementRating(
  statementId: string
): Promise<StatementRatingAggregate | null> {
  const rows = await db()`
    SELECT *
    FROM bhashan.statement_rating_aggregates
    WHERE statement_id = ${statementId}
    LIMIT 1
  `;
  const row = (rows as unknown as AggregateRow[])[0];
  return row ? mapAggregate(row) : null;
}

/** Public aggregate plus the requesting user's immutable ballot, if any. */
export async function getStatementVoteState({
  statementId,
  userId,
}: {
  statementId: string;
  userId?: string | null;
}): Promise<StatementVoteState> {
  const rows = await db()`
    SELECT
      statement.id AS record_id,
      statement.document AS record_document,
      vote.id AS current_vote_id,
      vote.value AS current_vote_value,
      (exclusion.vote_id IS NOT NULL) AS current_vote_excluded,
      vote.created_at AS current_vote_created_at,
      rating.*
    FROM bhashan.statements AS statement
    LEFT JOIN bhashan.statement_votes AS vote
      ON vote.statement_id = statement.id
     AND vote.user_id = ${userId ?? ""}
    LEFT JOIN bhashan.statement_vote_exclusions AS exclusion
      ON exclusion.vote_id = vote.id
    LEFT JOIN bhashan.statement_rating_aggregates AS rating
      ON rating.statement_id = statement.id
    WHERE statement.id = ${statementId}
      AND statement.status = 'published'
    LIMIT 1
  `;
  const row = (rows as unknown as VoteStateRow[])[0];
  if (!row || committeePublicationIssues(row.record_document).length > 0) {
    throw new VoteStoreError("STATEMENT_NOT_FOUND", "Statement not found.", 404);
  }

  let currentUserVote: CurrentUserStatementVote | null = null;
  if (row.current_vote_id != null) {
    const value = safeInteger(row.current_vote_value, "current vote value");
    if (!isVoteValue(value)) throw new Error("The database returned an unsupported vote value.");
    currentUserVote = {
      voteId: String(row.current_vote_id),
      value,
      excluded:
        row.current_vote_excluded === true || row.current_vote_excluded === "true",
      createdAt: isoDate(row.current_vote_created_at, "current vote creation time"),
    };
  }

  return {
    statementId: String(row.record_id),
    currentUserVote,
    rating: row.statement_id == null ? null : mapAggregate(row),
  };
}

export async function getUserVoteHistory(
  userId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<UserVoteHistoryPage> {
  const limit = Math.min(Math.max(Math.trunc(options.limit ?? 25), 1), 100);
  const offset = Math.max(Math.trunc(options.offset ?? 0), 0);
  const sql = db();
  const [rows, countRows] = await Promise.all([
    sql`
      SELECT
        vote.id AS vote_id,
        vote.statement_id,
        coalesce(statement.document ->> 'neutral_title', vote.statement_id) AS neutral_title,
        vote.value,
        (exclusion.vote_id IS NOT NULL) AS excluded,
        exclusion.reason AS exclusion_reason,
        exclusion.created_at AS excluded_at,
        CASE
          WHEN exclusion.vote_id IS NULL THEN NULL
          ELSE coalesce(
            nullif(btrim(exclusion_actor.name), '') || ' (' || exclusion_actor.email || ')',
            exclusion_actor.email,
            exclusion.actor_user_id
          )
        END AS excluded_by,
        vote.created_at,
        count(*) OVER () AS total_count
      FROM bhashan.statement_votes AS vote
      JOIN bhashan.statements AS statement ON statement.id = vote.statement_id
      LEFT JOIN bhashan.statement_vote_exclusions AS exclusion ON exclusion.vote_id = vote.id
      LEFT JOIN public.auth_user AS exclusion_actor ON exclusion_actor.id = exclusion.actor_user_id
      WHERE vote.user_id = ${userId}
      ORDER BY vote.created_at DESC, vote.id DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `,
    sql`
      SELECT count(*) AS total_count
      FROM bhashan.statement_votes
      WHERE user_id = ${userId}
    `,
  ]);
  const history = rows as unknown as HistoryRow[];
  const total = safeInteger(
    (countRows as unknown as { total_count: unknown }[])[0]?.total_count ?? 0,
    "vote-history count"
  );
  const items = history.map((row) => {
    const value = safeInteger(row.value, "vote value");
    if (!isVoteValue(value)) throw new Error("The database returned an unsupported vote value.");
    return {
      voteId: String(row.vote_id),
      statementId: String(row.statement_id),
      neutralTitle: String(row.neutral_title),
      value,
      excluded: row.excluded === true || row.excluded === "true",
      exclusionReason:
        row.exclusion_reason == null ? undefined : String(row.exclusion_reason),
      excludedAt:
        row.excluded_at == null
          ? undefined
          : isoDate(row.excluded_at, "vote exclusion time"),
      excludedBy:
        row.excluded_by == null ? undefined : String(row.excluded_by),
      createdAt: isoDate(row.created_at, "vote creation time"),
    };
  });
  return {
    items,
    total,
    limit,
    offset,
  };
}

export async function excludeStatementVote({
  voteId,
  actorUserId,
  actorLabel,
  reason,
}: {
  voteId: string;
  actorUserId: string;
  actorLabel: string;
  reason: string;
}): Promise<StatementRatingAggregate> {
  if (!isUuid(voteId)) {
    throw new VoteStoreError("VOTE_NOT_FOUND", "Vote not found.", 404);
  }
  const cleanReason = reason.trim();
  if (!cleanReason) {
    throw new VoteStoreError(
      "INVALID_EXCLUSION_REASON",
      "An exclusion requires a reason for the audit record.",
      400
    );
  }
  if (cleanReason.length > 500) {
    throw new VoteStoreError(
      "INVALID_EXCLUSION_REASON",
      "An exclusion reason cannot exceed 500 characters.",
      400
    );
  }
  const cleanActorLabel = actorLabel.trim();
  if (!cleanActorLabel) {
    throw new VoteStoreError(
      "VOTE_REJECTED",
      "A registered administrator label is required for the audit record.",
      400
    );
  }

  const targetRows = await db()`
    SELECT statement_id
    FROM bhashan.statement_votes
    WHERE id = ${voteId}::uuid
    LIMIT 1
  `;
  const targetStatementId = (
    targetRows as unknown as { statement_id: unknown }[]
  )[0]?.statement_id;
  if (targetStatementId == null) {
    throw new VoteStoreError("VOTE_NOT_FOUND", "Vote not found.", 404);
  }

  const sql = db();
  const transactionRows = await sql.transaction((tx) => [
    tx`SELECT pg_advisory_xact_lock(
      hashtextextended(${statementRatingLockKey(String(targetStatementId))}, 0)
    )`,
    tx`
    WITH target_vote AS (
      SELECT vote.*
      FROM bhashan.statement_votes AS vote
      JOIN bhashan.statement_rating_aggregates AS aggregate
        ON aggregate.statement_id = vote.statement_id
       AND aggregate.valid_vote_count > 0
      LEFT JOIN bhashan.statement_vote_exclusions AS existing
        ON existing.vote_id = vote.id
      WHERE vote.id = ${voteId}::uuid
        AND existing.vote_id IS NULL
    ),
    inserted_exclusion AS (
      INSERT INTO bhashan.statement_vote_exclusions (vote_id, actor_user_id, reason)
      SELECT id, ${actorUserId}, ${cleanReason}
      FROM target_vote
      ON CONFLICT DO NOTHING
      RETURNING *
    ),
    updated_rating AS (
      UPDATE bhashan.statement_rating_aggregates AS aggregate
      SET
        prior_performance = ${PUBLIC_EMPTY_PERFORMANCE},
        prior_strength = ${RATING_PRIOR_STRENGTH},
        valid_vote_count = aggregate.valid_vote_count - 1,
        valid_vote_sum = aggregate.valid_vote_sum - vote.value,
        vote_0_count = aggregate.vote_0_count - CASE WHEN vote.value = 0 THEN 1 ELSE 0 END,
        vote_25_count = aggregate.vote_25_count - CASE WHEN vote.value = 25 THEN 1 ELSE 0 END,
        vote_50_count = aggregate.vote_50_count - CASE WHEN vote.value = 50 THEN 1 ELSE 0 END,
        vote_75_count = aggregate.vote_75_count - CASE WHEN vote.value = 75 THEN 1 ELSE 0 END,
        vote_100_count = aggregate.vote_100_count - CASE WHEN vote.value = 100 THEN 1 ELSE 0 END,
        performance = CASE
          WHEN aggregate.valid_vote_count = 1 THEN ${PUBLIC_EMPTY_PERFORMANCE}
          ELSE (
            aggregate.valid_vote_sum - vote.value
          )::numeric / (aggregate.valid_vote_count - 1)
        END,
        gp = CASE
          WHEN aggregate.valid_vote_count = 1
            THEN ${1000 + PUBLIC_EMPTY_PERFORMANCE * 10}
          ELSE round(1000 + 10 * (
            aggregate.valid_vote_sum - vote.value
          )::numeric / (aggregate.valid_vote_count - 1))::integer
        END,
        model_version = ${RATING_MODEL_VERSION},
        updated_at = clock_timestamp()
      FROM target_vote AS vote
      JOIN inserted_exclusion AS exclusion ON exclusion.vote_id = vote.id
      WHERE aggregate.statement_id = vote.statement_id
      RETURNING aggregate.*
    ),
    logged_exclusion AS (
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
        'bhashan',
        'statement_vote_exclusions',
        exclusion.vote_id::text,
        'INSERT',
        ${cleanActorLabel},
        'exclude-statement-vote',
        ${`Excluded an immutable ballot from the public rating. Reason: ${cleanReason}`},
        to_jsonb(exclusion) || jsonb_build_object(
          'statement_id', vote.statement_id,
          'ballot_user_id', vote.user_id,
          'ballot_value', vote.value,
          'rating_valid_vote_count', rating.valid_vote_count,
          'rating_valid_vote_sum', rating.valid_vote_sum,
          'rating_gp', rating.gp
        )
      FROM inserted_exclusion AS exclusion
      JOIN target_vote AS vote ON vote.id = exclusion.vote_id
      JOIN updated_rating AS rating ON rating.statement_id = vote.statement_id
      RETURNING event_id
    )
    SELECT updated_rating.*
    FROM updated_rating
    CROSS JOIN logged_exclusion
  `,
  ]);
  const rows = transactionRows[1];
  const updated = (rows as unknown as AggregateRow[])[0];
  if (updated) return mapAggregate(updated);

  const voteRows = await db()`
    SELECT vote.id, exclusion.vote_id AS excluded_vote_id
    FROM bhashan.statement_votes AS vote
    LEFT JOIN bhashan.statement_vote_exclusions AS exclusion ON exclusion.vote_id = vote.id
    WHERE vote.id = ${voteId}::uuid
    LIMIT 1
  `;
  const diagnostic = (voteRows as unknown as { id: unknown; excluded_vote_id: unknown }[])[0];
  if (!diagnostic) throw new VoteStoreError("VOTE_NOT_FOUND", "Vote not found.", 404);
  if (diagnostic.excluded_vote_id != null) {
    throw new VoteStoreError(
      "VOTE_ALREADY_EXCLUDED",
      "This vote is already excluded from the rating.",
      409
    );
  }
  throw new VoteStoreError("VOTE_REJECTED", "The vote could not be excluded.", 409);
}

export async function rebuildStatementRating(
  statementId: string
): Promise<StatementRatingAggregate | null> {
  const sql = db();
  const transactionRows = await sql.transaction((tx) => [
    tx`SELECT pg_advisory_xact_lock(
      hashtextextended(${statementRatingLockKey(statementId)}, 0)
    )`,
    tx`
    WITH totals AS (
      SELECT
        count(*)::bigint AS valid_vote_count,
        coalesce(sum(vote.value), 0)::bigint AS valid_vote_sum,
        count(*) FILTER (WHERE vote.value = 0)::bigint AS vote_0_count,
        count(*) FILTER (WHERE vote.value = 25)::bigint AS vote_25_count,
        count(*) FILTER (WHERE vote.value = 50)::bigint AS vote_50_count,
        count(*) FILTER (WHERE vote.value = 75)::bigint AS vote_75_count,
        count(*) FILTER (WHERE vote.value = 100)::bigint AS vote_100_count
      FROM bhashan.statement_votes AS vote
      LEFT JOIN bhashan.statement_vote_exclusions AS exclusion ON exclusion.vote_id = vote.id
      WHERE vote.statement_id = ${statementId}
        AND exclusion.vote_id IS NULL
    )
    UPDATE bhashan.statement_rating_aggregates AS aggregate
    SET
      valid_vote_count = totals.valid_vote_count,
      valid_vote_sum = totals.valid_vote_sum,
      vote_0_count = totals.vote_0_count,
      vote_25_count = totals.vote_25_count,
      vote_50_count = totals.vote_50_count,
      vote_75_count = totals.vote_75_count,
      vote_100_count = totals.vote_100_count,
      prior_performance = ${PUBLIC_EMPTY_PERFORMANCE},
      prior_strength = ${RATING_PRIOR_STRENGTH},
      performance = CASE
        WHEN totals.valid_vote_count = 0 THEN ${PUBLIC_EMPTY_PERFORMANCE}
        ELSE totals.valid_vote_sum::numeric / totals.valid_vote_count
      END,
      gp = CASE
        WHEN totals.valid_vote_count = 0
          THEN ${1000 + PUBLIC_EMPTY_PERFORMANCE * 10}
        ELSE round(
          1000 + 10 * totals.valid_vote_sum::numeric / totals.valid_vote_count
        )::integer
      END,
      model_version = ${RATING_MODEL_VERSION},
      updated_at = clock_timestamp()
    FROM totals
    WHERE aggregate.statement_id = ${statementId}
    RETURNING aggregate.*
  `,
  ]);
  const rows = transactionRows[1];
  const row = (rows as unknown as AggregateRow[])[0];
  return row ? mapAggregate(row) : null;
}
