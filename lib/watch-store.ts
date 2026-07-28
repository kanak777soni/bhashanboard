import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { db } from "./db";
import {
  calculateWatchProgress,
  requiredWatchMilliseconds,
  watchHeartbeatWriteIsDue,
  type WatchHeartbeatSample,
} from "./rating";
import {
  committeePublicationIssues,
  MAX_VIDEO_EXCERPT_SECONDS,
  MIN_VIDEO_EXCERPT_SECONDS,
  normalizeStatementVideo,
  normalizeVerificationStage,
} from "./video";

export const WATCH_SESSION_MINUTES = 30;
export const MIN_VOTE_CLIP_SECONDS = MIN_VIDEO_EXCERPT_SECONDS;
export const MAX_VOTE_CLIP_SECONDS = MAX_VIDEO_EXCERPT_SECONDS;

export type WatchPlayerState = "playing" | "paused" | "ended";

export type WatchStoreErrorCode =
  | "INVALID_STATEMENT_ID"
  | "STATEMENT_NOT_FOUND"
  | "STATEMENT_NOT_ELIGIBLE"
  | "VIDEO_NOT_ELIGIBLE"
  | "VIDEO_CHANGED"
  | "INVALID_SESSION_ID"
  | "WATCH_SESSION_NOT_FOUND"
  | "WATCH_SESSION_EXPIRED"
  | "INVALID_HEARTBEAT"
  | "WATCH_SESSION_CONFLICT";

export class WatchStoreError extends Error {
  constructor(
    readonly code: WatchStoreErrorCode,
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "WatchStoreError";
  }
}

export interface VoteEligibleVideo {
  platform: "youtube";
  id: string;
  startSeconds: number;
  endSeconds: number;
  fingerprint: string;
}

export interface VoteEligibleStatement {
  statementId: string;
  verificationStage: "committee_passed";
  video: VoteEligibleVideo;
}

export interface PersistedVoteEligibleStatement extends VoteEligibleStatement {
  /** Optimistic snapshot bound to the complete publication-policy check. */
  recordVersion: number;
  /** Editorial Bayesian prior frozen when this version became vote-eligible. */
  seedGp: number;
}

export interface WatchSessionView {
  id: string;
  statementId: string;
  video: VoteEligibleVideo;
  creditedWatchMs: number;
  requiredWatchMs: number;
  watchedShare: number;
  qualificationProgress: number;
  reachedEnd: boolean;
  qualified: boolean;
  watchReceiptId: string | null;
  expiresAt: string;
}

export interface WatchHeartbeatInput {
  positionSeconds: number;
  playerState: WatchPlayerState;
  visible: boolean;
}

interface DocumentRow {
  id: unknown;
  document: unknown;
  version: unknown;
  rating_seed_gp: unknown;
}

interface WatchSessionRow {
  id: unknown;
  user_id: unknown;
  statement_id: unknown;
  video_platform: unknown;
  video_id: unknown;
  video_fingerprint: unknown;
  clip_start_ms: unknown;
  clip_end_ms: unknown;
  required_watch_ms: unknown;
  contiguous_through_ms: unknown;
  credited_watch_ms: unknown;
  last_position_ms: unknown;
  last_heartbeat_at: unknown;
  reached_end: unknown;
  qualified_at: unknown;
  expires_at: unknown;
  version: unknown;
  server_now?: unknown;
}

interface WatchReceiptRow {
  id: unknown;
}

function objectValue(value: unknown): Record<string, unknown> | undefined {
  let parsed = value;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return undefined;
    }
  }
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : undefined;
}

function nestedObject(
  value: Record<string, unknown> | undefined,
  key: string
): Record<string, unknown> | undefined {
  return objectValue(value?.[key]);
}

function integer(value: unknown): number | undefined {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(number) ? number : undefined;
}

function requiredInteger(value: unknown, name: string): number {
  const parsed = integer(value);
  if (parsed === undefined) throw new Error(`Invalid ${name} returned by the database.`);
  return parsed;
}

function dateValue(value: unknown, name: string): Date {
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid ${name} returned by the database.`);
  return date;
}

function booleanValue(value: unknown): boolean {
  return value === true || value === "true";
}

function validStatementId(statementId: string): boolean {
  return /^IN-[0-9]{4,}$/.test(statementId);
}

export function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

export function videoFingerprint({
  platform,
  id,
  startSeconds,
  endSeconds,
}: Omit<VoteEligibleVideo, "fingerprint">): string {
  // This is a stable version marker, not a cryptographic authorization token.
  // PostgreSQL has the same built-in md5() function, allowing the vote insert
  // to re-check the current statement document atomically.
  return createHash("md5")
    .update(["v1", platform, id, startSeconds, endSeconds].join("|"))
    .digest("hex");
}

export function parseVoteEligibleStatement(
  statementId: string,
  rawDocument: unknown
): VoteEligibleStatement {
  const document = objectValue(rawDocument);
  if (!document) {
    throw new WatchStoreError(
      "STATEMENT_NOT_ELIGIBLE",
      "The statement record is not valid.",
      409
    );
  }
  const publicationIssues = committeePublicationIssues(rawDocument);

  if (document.status !== "published") {
    throw new WatchStoreError(
      "STATEMENT_NOT_ELIGIBLE",
      "Voting is available only for published statements.",
      409
    );
  }

  const verification = nestedObject(document, "verification");
  const stage = normalizeVerificationStage(verification?.stage);
  if (stage !== "committee_passed") {
    throw new WatchStoreError(
      "STATEMENT_NOT_ELIGIBLE",
      "Voting opens after the statement and its footage are fully verified.",
      409
    );
  }

  const normalizedVideo =
    normalizeStatementVideo(document.video) ?? normalizeStatementVideo(verification?.embed);
  const platform = normalizedVideo?.platform;
  const id = normalizedVideo?.id ?? "";
  const startSeconds = normalizedVideo?.start;
  const endSeconds = normalizedVideo?.end;

  if (
    platform !== "youtube" ||
    startSeconds === undefined ||
    endSeconds === undefined ||
    startSeconds < 0 ||
    endSeconds <= startSeconds ||
    endSeconds - startSeconds < MIN_VOTE_CLIP_SECONDS ||
    endSeconds - startSeconds > MAX_VOTE_CLIP_SECONDS
  ) {
    throw new WatchStoreError(
      "VIDEO_NOT_ELIGIBLE",
      "Voting requires a verified YouTube excerpt with valid start and end times.",
      409
    );
  }
  if (publicationIssues.length > 0) {
    throw new WatchStoreError(
      "STATEMENT_NOT_ELIGIBLE",
      `Voting is locked: ${publicationIssues.join(" ")}`,
      409
    );
  }

  const baseVideo = {
    platform: "youtube" as const,
    id,
    startSeconds,
    endSeconds,
  };
  return {
    statementId,
    verificationStage: stage,
    video: { ...baseVideo, fingerprint: videoFingerprint(baseVideo) },
  };
}

export async function getVoteEligibleStatement(
  statementId: string
): Promise<PersistedVoteEligibleStatement> {
  if (!validStatementId(statementId)) {
    throw new WatchStoreError(
      "INVALID_STATEMENT_ID",
      "The statement identifier is invalid.",
      400
    );
  }
  const rows = await db()`
    SELECT id, document, version, rating_seed_gp
    FROM bhashan.statements
    WHERE id = ${statementId}
    LIMIT 1
  `;
  const row = (rows as unknown as DocumentRow[])[0];
  if (!row) {
    throw new WatchStoreError("STATEMENT_NOT_FOUND", "Statement not found.", 404);
  }
  const seedGp = requiredInteger(row.rating_seed_gp, "statement rating seed");
  if (seedGp < 1000 || seedGp > 2000) {
    throw new WatchStoreError(
      "STATEMENT_NOT_ELIGIBLE",
      "Voting is locked until the editorial rating seed is frozen.",
      409
    );
  }
  return {
    ...parseVoteEligibleStatement(String(row.id), row.document),
    recordVersion: requiredInteger(row.version, "statement version"),
    seedGp,
  };
}

function mapSession(row: WatchSessionRow, receiptId: string | null): WatchSessionView {
  const clipStartMs = requiredInteger(row.clip_start_ms, "clip start");
  const clipEndMs = requiredInteger(row.clip_end_ms, "clip end");
  const creditedWatchMs = requiredInteger(row.credited_watch_ms, "credited watch time");
  const requiredWatchMs = requiredInteger(row.required_watch_ms, "required watch time");
  const durationMs = clipEndMs - clipStartMs;
  return {
    id: String(row.id),
    statementId: String(row.statement_id),
    video: {
      platform: "youtube",
      id: String(row.video_id),
      startSeconds: clipStartMs / 1000,
      endSeconds: clipEndMs / 1000,
      fingerprint: String(row.video_fingerprint),
    },
    creditedWatchMs,
    requiredWatchMs,
    watchedShare: durationMs > 0 ? Math.min(1, creditedWatchMs / durationMs) : 0,
    qualificationProgress:
      requiredWatchMs > 0 ? Math.min(1, creditedWatchMs / requiredWatchMs) : 0,
    reachedEnd: booleanValue(row.reached_end),
    qualified: row.qualified_at != null,
    watchReceiptId: receiptId,
    expiresAt: dateValue(row.expires_at, "watch-session expiry").toISOString(),
  };
}

async function receiptForSession(
  sessionId: string,
  userId: string
): Promise<string | null> {
  const rows = await db()`
    SELECT receipt.id
    FROM bhashan.statement_watch_sessions AS session
    JOIN bhashan.statement_watch_receipts AS receipt
      ON receipt.user_id = session.user_id
     AND receipt.statement_id = session.statement_id
     AND receipt.video_fingerprint = session.video_fingerprint
    WHERE session.id = ${sessionId}::uuid
      AND session.user_id = ${userId}
    ORDER BY (receipt.watch_session_id = session.id) DESC
    LIMIT 1
  `;
  const row = (rows as unknown as WatchReceiptRow[])[0];
  return row ? String(row.id) : null;
}

async function ensureReceipt(row: WatchSessionRow, userId: string): Promise<string> {
  if (row.qualified_at == null) {
    throw new WatchStoreError(
      "WATCH_SESSION_CONFLICT",
      "The watch session has not qualified.",
      409
    );
  }

  const receiptId = randomUUID();
  await db()`
    INSERT INTO bhashan.statement_watch_receipts (
      id,
      watch_session_id,
      user_id,
      statement_id,
      video_fingerprint,
      watched_ms,
      required_watch_ms,
      qualified_at
    ) VALUES (
      ${receiptId}::uuid,
      ${String(row.id)}::uuid,
      ${userId},
      ${String(row.statement_id)},
      ${String(row.video_fingerprint)},
      ${requiredInteger(row.credited_watch_ms, "credited watch time")},
      ${requiredInteger(row.required_watch_ms, "required watch time")},
      ${dateValue(row.qualified_at, "qualification time").toISOString()}::timestamptz
    )
    ON CONFLICT DO NOTHING
  `;

  const stored = await db()`
    SELECT id
    FROM bhashan.statement_watch_receipts
    WHERE user_id = ${userId}
      AND statement_id = ${String(row.statement_id)}
      AND video_fingerprint = ${String(row.video_fingerprint)}
    LIMIT 1
  `;
  const receipt = (stored as unknown as WatchReceiptRow[])[0];
  if (!receipt) throw new Error("A qualified watch receipt could not be persisted.");
  return String(receipt.id);
}

export async function createWatchSession({
  userId,
  statementId,
}: {
  userId: string;
  statementId: string;
}): Promise<WatchSessionView> {
  const statement = await getVoteEligibleStatement(statementId);
  const sessionId = randomUUID();
  const clipStartMs = statement.video.startSeconds * 1000;
  const clipEndMs = statement.video.endSeconds * 1000;
  const requiredWatchMs = requiredWatchMilliseconds(clipStartMs, clipEndMs);
  const sql = db();
  const startLockKey = `bhashan:watch-session:${userId}:${statementId}`;
  const transactionRows = await sql.transaction((tx) => [
    // This must be a separate statement from the lookup. Under READ COMMITTED,
    // the lookup then receives a fresh snapshot after a concurrent starter
    // releases the lock and can see the session that request inserted.
    tx.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [startLockKey]
    ),
    tx.query(
      `
        WITH existing_session AS (
          SELECT session.*
          FROM bhashan.statement_watch_sessions AS session
          WHERE session.user_id = $1
            AND session.statement_id = $2
            AND session.video_fingerprint = $3
            AND (
              session.qualified_at IS NOT NULL
              OR session.expires_at > clock_timestamp()
            )
          ORDER BY
            (session.qualified_at IS NOT NULL) DESC,
            session.created_at DESC
          LIMIT 1
        ),
        inserted_session AS (
          INSERT INTO bhashan.statement_watch_sessions (
            id,
            user_id,
            statement_id,
            video_platform,
            video_id,
            video_fingerprint,
            clip_start_ms,
            clip_end_ms,
            required_watch_ms,
            contiguous_through_ms,
            credited_watch_ms,
            last_position_ms,
            last_heartbeat_at,
            expires_at
          )
          SELECT
            $4::uuid,
            $1,
            $2,
            $5,
            $6,
            $3,
            $7,
            $8,
            $9,
            $7,
            0,
            $7,
            clock_timestamp(),
            clock_timestamp() + interval '30 minutes'
          WHERE NOT EXISTS (SELECT 1 FROM existing_session)
          RETURNING *
        ),
        chosen_session AS (
          SELECT * FROM existing_session
          UNION ALL
          SELECT * FROM inserted_session
        )
        SELECT chosen_session.*, clock_timestamp() AS server_now
        FROM chosen_session
        LIMIT 1
      `,
      [
        userId,
        statementId,
        statement.video.fingerprint,
        sessionId,
        statement.video.platform,
        statement.video.id,
        clipStartMs,
        clipEndMs,
        requiredWatchMs,
      ]
    ),
  ]);
  const row = (transactionRows[1] as unknown as WatchSessionRow[])[0];
  if (!row) throw new Error("The watch session could not be created.");
  const receiptId =
    row.qualified_at != null
      ? (await receiptForSession(String(row.id), userId)) ??
        (await ensureReceipt(row, userId))
      : null;
  return mapSession(row, receiptId);
}

async function loadWatchSession(
  sessionId: string,
  userId: string
): Promise<WatchSessionRow> {
  const rows = await db()`
    SELECT *, clock_timestamp() AS server_now
    FROM bhashan.statement_watch_sessions
    WHERE id = ${sessionId}::uuid AND user_id = ${userId}
    LIMIT 1
  `;
  const row = (rows as unknown as WatchSessionRow[])[0];
  if (!row) {
    throw new WatchStoreError(
      "WATCH_SESSION_NOT_FOUND",
      "Watch session not found.",
      404
    );
  }
  return row;
}

function validateHeartbeat(input: WatchHeartbeatInput): void {
  if (
    !Number.isFinite(input.positionSeconds) ||
    input.positionSeconds < 0 ||
    !["playing", "paused", "ended"].includes(input.playerState) ||
    typeof input.visible !== "boolean"
  ) {
    throw new WatchStoreError(
      "INVALID_HEARTBEAT",
      "The playback heartbeat is invalid.",
      400
    );
  }
}

export async function recordWatchHeartbeat({
  sessionId,
  userId,
  heartbeat,
}: {
  sessionId: string;
  userId: string;
  heartbeat: WatchHeartbeatInput;
}): Promise<WatchSessionView> {
  if (!isUuid(sessionId)) {
    throw new WatchStoreError("INVALID_SESSION_ID", "The watch session identifier is invalid.", 400);
  }
  validateHeartbeat(heartbeat);

  for (let attempt = 0; attempt < 3; attempt++) {
    const current = await loadWatchSession(sessionId, userId);
    const serverNow = dateValue(current.server_now, "server time");

    if (current.qualified_at != null) {
      const receiptId =
        (await receiptForSession(sessionId, userId)) ??
        (await ensureReceipt(current, userId));
      return mapSession(current, receiptId);
    }

    if (dateValue(current.expires_at, "watch-session expiry") <= serverNow) {
      throw new WatchStoreError(
        "WATCH_SESSION_EXPIRED",
        "This watch session expired. Start the clip again to vote.",
        410
      );
    }

    const previousHeartbeatAt = dateValue(
      current.last_heartbeat_at,
      "last heartbeat"
    );
    if (
      !watchHeartbeatWriteIsDue(
        previousHeartbeatAt.getTime(),
        serverNow.getTime()
      )
    ) {
      // Return the current snapshot without updating a row. This keeps rapid
      // scripted PATCHes from turning into a stream of Neon writes.
      return mapSession(current, null);
    }

    const sample: WatchHeartbeatSample = {
      positionMs: Math.round(heartbeat.positionSeconds * 1000),
      heartbeatAtMs: serverNow.getTime(),
      // An `ended` event closes an interval that was playing; credit only the
      // wall-clock-bounded final advance, never the client-reported duration.
      playing: heartbeat.playerState !== "paused",
      visible: heartbeat.visible,
    };
    const progress = calculateWatchProgress(
      {
        clipStartMs: requiredInteger(current.clip_start_ms, "clip start"),
        clipEndMs: requiredInteger(current.clip_end_ms, "clip end"),
        contiguousThroughMs: requiredInteger(
          current.contiguous_through_ms,
          "contiguous watch position"
        ),
        creditedWatchMs: requiredInteger(current.credited_watch_ms, "credited watch time"),
        lastPositionMs: requiredInteger(current.last_position_ms, "last playback position"),
        lastHeartbeatAtMs: previousHeartbeatAt.getTime(),
        reachedEnd: booleanValue(current.reached_end),
      },
      sample
    );
    const qualifies =
      progress.creditedWatchMs >= requiredInteger(current.required_watch_ms, "required watch time") &&
      progress.reachedEnd;

    if (qualifies) {
      const statement = await getVoteEligibleStatement(String(current.statement_id));
      if (statement.video.fingerprint !== String(current.video_fingerprint)) {
        throw new WatchStoreError(
          "VIDEO_CHANGED",
          "The verified excerpt changed. Watch the current footage before voting.",
          409
        );
      }
    }

    const updatedRows = await db()`
      UPDATE bhashan.statement_watch_sessions
      SET
        contiguous_through_ms = ${progress.contiguousThroughMs},
        credited_watch_ms = ${progress.creditedWatchMs},
        last_position_ms = ${progress.lastPositionMs},
        -- Persist the exact server sample time used by calculateWatchProgress.
        -- Using a later UPDATE timestamp would subtract database latency from
        -- every following interval and eventually make honest 1x playback look
        -- like a forward seek.
        last_heartbeat_at = ${serverNow.toISOString()}::timestamptz,
        last_player_state = ${heartbeat.playerState},
        last_visible = ${heartbeat.visible},
        reached_end = ${progress.reachedEnd},
        qualified_at = CASE
          WHEN ${qualifies} THEN coalesce(qualified_at, clock_timestamp())
          ELSE qualified_at
        END,
        version = version + 1,
        updated_at = clock_timestamp()
      WHERE id = ${sessionId}::uuid
        AND user_id = ${userId}
        AND version = ${requiredInteger(current.version, "watch-session version")}
        AND expires_at > clock_timestamp()
        AND qualified_at IS NULL
      RETURNING *, clock_timestamp() AS server_now
    `;
    const updated = (updatedRows as unknown as WatchSessionRow[])[0];
    if (!updated) continue;

    const receiptId = updated.qualified_at != null
      ? await ensureReceipt(updated, userId)
      : null;
    return mapSession(updated, receiptId);
  }

  throw new WatchStoreError(
    "WATCH_SESSION_CONFLICT",
    "Playback progress changed in another tab. Please try again.",
    409
  );
}
