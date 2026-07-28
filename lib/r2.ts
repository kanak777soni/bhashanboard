import "server-only";

import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  type HeadObjectCommandOutput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { db } from "./db";
import { inspectMp4, Mp4ValidationError } from "./mp4";
import { normalizeR2PublicBaseUrl } from "./r2-public-url";
import {
  contentAddressedR2VideoKey,
  isR2QuarantineObjectKey,
  isR2VideoObjectKey,
  type ListedR2Object,
  R2_QUARANTINE_PREFIX,
} from "./r2-retention-policy";
import { r2UploadIntentShouldExpire } from "./r2-upload-policy";
import type { R2StatementVideo } from "./types";
import {
  assertVideoExcerpt,
  MAX_R2_VIDEO_BYTES,
  MAX_VIDEO_EXCERPT_SECONDS,
  MIN_VIDEO_EXCERPT_SECONDS,
  normalizeR2Etag,
  normalizeR2Sha256,
  normalizeStatementVideo,
} from "./video";

const PRESIGN_SECONDS = 5 * 60;
// The URL can start a PUT for only five minutes. The actor-bound completion
// token lasts as long as the durable intent so a lost response can be retried
// after the copy without reopening upload access.
const UPLOAD_TOKEN_SECONDS = 24 * 60 * 60;
const ATTACHMENT_TOKEN_SECONDS = 4 * 60 * 60;
const PROCESSING_LEASE_SECONDS = 2 * 60;
const MP4_INSPECTION_BYTES = 8 * 1024 * 1024;
const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";
const QUARANTINE_CACHE_CONTROL = "no-store";
const MAX_ACTIVE_UPLOADS_PER_ACTOR = 4;
const MAX_DAILY_UPLOADS_PER_ACTOR = 20;
const MAX_DAILY_BYTES_PER_ACTOR = 500 * 1024 * 1024;

interface R2Configuration {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  uploadBucket: string;
  publicBucket: string;
}

interface UploadTokenPayload {
  version: 2;
  purpose: "upload";
  actorId: string;
  intentId: string;
  quarantineKey: string;
  bytes: number;
  expiresAt: number;
}

interface AttachmentTokenPayload {
  version: 2;
  purpose: "attachment";
  actorId: string;
  intentId: string;
  video: R2StatementVideo;
  expiresAt: number;
}

type TokenPayload = UploadTokenPayload | AttachmentTokenPayload;
type UploadIntentStatus = "authorized" | "processing" | "completed" | "rejected" | "expired";

interface UploadIntentRow {
  id: unknown;
  actor_user_id: unknown;
  status: unknown;
  quarantine_key: unknown;
  public_key: unknown;
  expected_bytes: unknown;
  content_type: unknown;
  quarantine_etag: unknown;
  public_etag: unknown;
  sha256: unknown;
  duration_ms: unknown;
  upload_expires_at: unknown;
  expires_at: unknown;
  processing_started_at: unknown;
  completed_at: unknown;
}

interface UploadIntent {
  id: string;
  actorId: string;
  status: UploadIntentStatus;
  quarantineKey: string;
  publicKey?: string;
  expectedBytes: number;
  contentType: "video/mp4";
  quarantineEtag?: string;
  publicEtag?: string;
  sha256?: string;
  durationMs?: number;
  uploadExpiresAt: Date;
  expiresAt: Date;
}

export interface R2UploadAuthorization {
  key: string;
  uploadUrl: string;
  uploadToken: string;
  expiresAt: string;
  requiredHeaders: Record<string, string>;
}

export interface CompletedR2Upload {
  video: R2StatementVideo;
  attachmentToken: string;
  playbackUrl: string;
}

export class R2VideoError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "R2VideoError";
  }
}

let configurationCache: R2Configuration | undefined;
let clientCache: S3Client | undefined;

function bucketName(value: string): boolean {
  return /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(value);
}

export function r2StorageConfigured(): boolean {
  return [
    process.env.R2_ACCOUNT_ID,
    process.env.R2_ACCESS_KEY_ID,
    process.env.R2_SECRET_ACCESS_KEY,
    process.env.R2_UPLOAD_BUCKET_NAME,
    process.env.R2_PUBLIC_BUCKET_NAME,
  ].every((value) => Boolean(value?.trim()));
}

function configuration(): R2Configuration {
  if (configurationCache) return configurationCache;
  const accountId = process.env.R2_ACCOUNT_ID?.trim() ?? "";
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim() ?? "";
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim() ?? "";
  const uploadBucket = process.env.R2_UPLOAD_BUCKET_NAME?.trim() ?? "";
  const publicBucket = process.env.R2_PUBLIC_BUCKET_NAME?.trim() ?? "";
  if (!accountId || !accessKeyId || !secretAccessKey || !uploadBucket || !publicBucket) {
    throw new R2VideoError(
      "R2_NOT_CONFIGURED",
      "Video uploads are not configured on this deployment.",
      503
    );
  }
  if (!/^[a-f0-9]{32}$/i.test(accountId)) {
    throw new R2VideoError("R2_NOT_CONFIGURED", "The R2 account identifier is invalid.", 503);
  }
  if (!bucketName(uploadBucket) || !bucketName(publicBucket) || uploadBucket === publicBucket) {
    throw new R2VideoError(
      "R2_NOT_CONFIGURED",
      "R2 requires separate valid upload and public bucket names.",
      503
    );
  }
  configurationCache = { accountId, accessKeyId, secretAccessKey, uploadBucket, publicBucket };
  return configurationCache;
}

function publicBaseUrl(): string {
  const base = normalizeR2PublicBaseUrl(process.env.R2_PUBLIC_BASE_URL);
  if (!base) {
    throw new R2VideoError(
      "R2_PUBLIC_URL_NOT_CONFIGURED",
      "Public video delivery requires a clean HTTPS origin.",
      503
    );
  }
  return base;
}

function client(): S3Client {
  if (clientCache) return clientCache;
  const config = configuration();
  clientCache = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  return clientCache;
}

function quarantineObjectKey(intentId: string): string {
  return `${R2_QUARANTINE_PREFIX}${intentId.slice(0, 2)}/${intentId}.mp4`;
}

function tokenSignature(encodedPayload: string): Buffer {
  return createHmac("sha256", configuration().secretAccessKey)
    .update("bhashan-r2-token-v2\0")
    .update(encodedPayload)
    .digest();
}

function signToken(payload: TokenPayload): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encodedPayload}.${tokenSignature(encodedPayload).toString("base64url")}`;
}

function objectRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function verifyToken(token: string, purpose: TokenPayload["purpose"], actorId: string): TokenPayload {
  if (!token || token.length > 8_192) {
    throw new R2VideoError("INVALID_UPLOAD_TOKEN", "The video upload token is invalid.", 400);
  }
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new R2VideoError("INVALID_UPLOAD_TOKEN", "The video upload token is invalid.", 400);
  }
  let suppliedSignature: Buffer;
  try {
    suppliedSignature = Buffer.from(parts[1], "base64url");
  } catch {
    throw new R2VideoError("INVALID_UPLOAD_TOKEN", "The video upload token is invalid.", 400);
  }
  const expectedSignature = tokenSignature(parts[0]);
  if (
    suppliedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(suppliedSignature, expectedSignature)
  ) {
    throw new R2VideoError("INVALID_UPLOAD_TOKEN", "The video upload token is invalid.", 400);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
  } catch {
    throw new R2VideoError("INVALID_UPLOAD_TOKEN", "The video upload token is invalid.", 400);
  }
  const payload = objectRecord(parsed);
  if (
    payload?.version !== 2 ||
    payload.purpose !== purpose ||
    payload.actorId !== actorId ||
    !Number.isSafeInteger(payload.expiresAt) ||
    Number(payload.expiresAt) <= Date.now()
  ) {
    throw new R2VideoError(
      "EXPIRED_UPLOAD_TOKEN",
      "The video upload authorization expired. Upload the file again.",
      410
    );
  }
  return payload as unknown as TokenPayload;
}

function validateUploadInput({
  fileName,
  contentType,
  bytes,
  rightsAttested,
}: {
  fileName: string;
  contentType: string;
  bytes: number;
  rightsAttested: boolean;
}): void {
  if (!fileName || fileName.length > 255 || !/\.mp4$/i.test(fileName)) {
    throw new R2VideoError("INVALID_VIDEO_FILE", "Choose an MP4 video file.", 400);
  }
  if (contentType !== "video/mp4") {
    throw new R2VideoError("INVALID_VIDEO_TYPE", "The uploaded video must use video/mp4.", 400);
  }
  if (!Number.isSafeInteger(bytes) || bytes <= 0 || bytes > MAX_R2_VIDEO_BYTES) {
    throw new R2VideoError("VIDEO_TOO_LARGE", "The uploaded video must be 50 MiB or smaller.", 400);
  }
  if (!rightsAttested) {
    throw new R2VideoError(
      "RIGHTS_ATTESTATION_REQUIRED",
      "Confirm that this footage is rights-cleared and its provenance is documented.",
      400
    );
  }
}

function dateValue(value: unknown, label: string): Date {
  const date = value instanceof Date ? value : new Date(String(value));
  if (!Number.isFinite(date.getTime())) throw new Error(`Invalid ${label} returned by the database.`);
  return date;
}

function integerValue(value: unknown, label: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(`Invalid ${label} returned by the database.`);
  return parsed;
}

function mapIntent(row: UploadIntentRow): UploadIntent {
  const status = String(row.status) as UploadIntentStatus;
  if (!["authorized", "processing", "completed", "rejected", "expired"].includes(status)) {
    throw new Error("Invalid upload-intent status returned by the database.");
  }
  const quarantineKey = String(row.quarantine_key);
  if (!isR2QuarantineObjectKey(quarantineKey)) {
    throw new Error("Invalid quarantine key returned by the database.");
  }
  const publicKey = row.public_key == null ? undefined : String(row.public_key);
  if (publicKey !== undefined && !isR2VideoObjectKey(publicKey)) {
    throw new Error("Invalid public key returned by the database.");
  }
  const quarantineEtag = row.quarantine_etag == null
    ? undefined
    : normalizeR2Etag(row.quarantine_etag);
  const publicEtag = row.public_etag == null ? undefined : normalizeR2Etag(row.public_etag);
  const sha256 = row.sha256 == null ? undefined : normalizeR2Sha256(row.sha256);
  if (row.quarantine_etag != null && !quarantineEtag) throw new Error("Invalid quarantine ETag.");
  if (row.public_etag != null && !publicEtag) throw new Error("Invalid public ETag.");
  if (row.sha256 != null && !sha256) throw new Error("Invalid video SHA-256.");
  return {
    id: String(row.id),
    actorId: String(row.actor_user_id),
    status,
    quarantineKey,
    publicKey,
    expectedBytes: integerValue(row.expected_bytes, "expected byte count"),
    contentType: row.content_type === "video/mp4" ? "video/mp4" : (() => { throw new Error("Invalid upload content type."); })(),
    quarantineEtag,
    publicEtag,
    sha256,
    durationMs: row.duration_ms == null ? undefined : integerValue(row.duration_ms, "duration"),
    uploadExpiresAt: dateValue(row.upload_expires_at, "upload expiry"),
    expiresAt: dateValue(row.expires_at, "intent expiry"),
  };
}

async function createUploadIntent({
  actorId,
  intentId,
  quarantineKey,
  bytes,
}: {
  actorId: string;
  intentId: string;
  quarantineKey: string;
  bytes: number;
}): Promise<{ uploadExpiresAt: Date; expiresAt: Date }> {
  const sql = db();
  const results = await sql.transaction((tx) => [
    tx`SELECT pg_advisory_xact_lock(hashtextextended(${`bhashan:r2-upload-quota:${actorId}`}, 0))`,
    tx`
      WITH quota AS MATERIALIZED (
        SELECT
          count(*) FILTER (
            WHERE status IN ('authorized', 'processing')
              AND upload_expires_at > clock_timestamp()
          )::integer AS active_count,
          count(*) FILTER (
            WHERE created_at >= clock_timestamp() - interval '24 hours'
          )::integer AS daily_count,
          coalesce(sum(expected_bytes) FILTER (
            WHERE created_at >= clock_timestamp() - interval '24 hours'
          ), 0)::bigint AS daily_bytes
        FROM bhashan.r2_video_upload_intents
        WHERE actor_user_id = ${actorId}
      ), inserted AS (
        INSERT INTO bhashan.r2_video_upload_intents (
          id, actor_user_id, status, quarantine_key, expected_bytes,
          content_type, rights_attested_at, upload_expires_at, expires_at
        )
        SELECT
          ${intentId}::uuid, ${actorId}, 'authorized', ${quarantineKey}, ${bytes},
          'video/mp4', clock_timestamp(),
          clock_timestamp() + interval '30 minutes',
          clock_timestamp() + interval '24 hours'
        FROM quota
        WHERE active_count < ${MAX_ACTIVE_UPLOADS_PER_ACTOR}
          AND daily_count < ${MAX_DAILY_UPLOADS_PER_ACTOR}
          AND daily_bytes + ${bytes} <= ${MAX_DAILY_BYTES_PER_ACTOR}
        RETURNING id, upload_expires_at, expires_at
      )
      SELECT quota.active_count, quota.daily_count, quota.daily_bytes,
             inserted.id, inserted.upload_expires_at, inserted.expires_at
      FROM quota LEFT JOIN inserted ON true
    `,
  ]);
  const row = (results[1] as unknown as Array<Record<string, unknown>>)[0];
  if (!row?.id) {
    throw new R2VideoError(
      "UPLOAD_QUOTA_EXCEEDED",
      "This administrator has reached the hosted-video upload quota. Try again later.",
      429
    );
  }
  return {
    uploadExpiresAt: dateValue(row.upload_expires_at, "upload expiry"),
    expiresAt: dateValue(row.expires_at, "intent expiry"),
  };
}

async function markAuthorizationFailed(intentId: string, actorId: string): Promise<void> {
  try {
    await db()`
      UPDATE bhashan.r2_video_upload_intents
      SET status = 'rejected', last_error_code = 'PRESIGN_FAILED', updated_at = clock_timestamp()
      WHERE id = ${intentId}::uuid AND actor_user_id = ${actorId} AND status = 'authorized'
    `;
  } catch (error) {
    console.error("Could not record failed R2 presign", { intentId, error: String(error) });
  }
}

export async function createR2UploadAuthorization({
  actorId,
  fileName,
  contentType,
  bytes,
  rightsAttested,
}: {
  actorId: string;
  fileName: string;
  contentType: string;
  bytes: number;
  rightsAttested: boolean;
}): Promise<R2UploadAuthorization> {
  validateUploadInput({ fileName, contentType, bytes, rightsAttested });
  // Fail before reserving quota or creating a durable intent. A completed
  // upload is unusable unless its public delivery origin is already valid.
  publicBaseUrl();
  const intentId = randomUUID().toLowerCase();
  const key = quarantineObjectKey(intentId);
  const config = configuration();
  const intent = await createUploadIntent({ actorId, intentId, quarantineKey: key, bytes });
  const requiredHeaders = {
    "Content-Type": "video/mp4",
    "If-None-Match": "*",
    "Cache-Control": QUARANTINE_CACHE_CONTROL,
    "x-amz-meta-upload-intent": intentId,
  };
  try {
    const uploadUrl = await getSignedUrl(
      client(),
      new PutObjectCommand({
        Bucket: config.uploadBucket,
        Key: key,
        ContentLength: bytes,
        ContentType: "video/mp4",
        CacheControl: QUARANTINE_CACHE_CONTROL,
        IfNoneMatch: "*",
        Metadata: { "upload-intent": intentId },
      }),
      {
        expiresIn: PRESIGN_SECONDS,
        signableHeaders: new Set([
          "cache-control",
          // The browser supplies Content-Length from the File body (scripts
          // cannot set this forbidden header). Signing it binds the presigned
          // PUT to expected_bytes and prevents quota/cost bypass in quarantine.
          "content-length",
          "content-type",
          "if-none-match",
          "x-amz-meta-upload-intent",
        ]),
      }
    );
    const tokenExpiresAt = Math.min(
      intent.expiresAt.getTime(),
      Date.now() + UPLOAD_TOKEN_SECONDS * 1000
    );
    return {
      key,
      uploadUrl,
      uploadToken: signToken({
        version: 2,
        purpose: "upload",
        actorId,
        intentId,
        quarantineKey: key,
        bytes,
        expiresAt: tokenExpiresAt,
      }),
      expiresAt: new Date(Math.min(tokenExpiresAt, Date.now() + PRESIGN_SECONDS * 1000)).toISOString(),
      requiredHeaders,
    };
  } catch (error) {
    await markAuthorizationFailed(intentId, actorId);
    if (error instanceof R2VideoError) throw error;
    throw new R2VideoError("R2_PRESIGN_FAILED", "The video upload could not be authorized.", 503);
  }
}

function isNotFound(error: unknown): boolean {
  const value = objectRecord(error);
  const metadata = objectRecord(value?.$metadata);
  return value?.name === "NotFound" || value?.name === "NoSuchKey" || metadata?.httpStatusCode === 404;
}

function isPreconditionFailed(error: unknown): boolean {
  const value = objectRecord(error);
  const metadata = objectRecord(value?.$metadata);
  return value?.name === "PreconditionFailed" || metadata?.httpStatusCode === 412;
}

function headObject(
  bucket: string,
  key: string,
  options: { allowMissing: true }
): Promise<HeadObjectCommandOutput | undefined>;
function headObject(
  bucket: string,
  key: string,
  options?: { allowMissing?: false }
): Promise<HeadObjectCommandOutput>;
async function headObject(
  bucket: string,
  key: string,
  { allowMissing = false }: { allowMissing?: boolean } = {}
): Promise<HeadObjectCommandOutput | undefined> {
  try {
    return await client().send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  } catch (error) {
    if (allowMissing && isNotFound(error)) return undefined;
    console.error("R2 HEAD failed", { bucket, key, error: String(error) });
    throw new R2VideoError(
      "VIDEO_UPLOAD_MISSING",
      "The stored video could not be found or verified.",
      409
    );
  }
}

function canonicalHead(
  head: NonNullable<Awaited<ReturnType<typeof headObject>>>,
  expectedBytes?: number
): { bytes: number; etag: string; contentType: "video/mp4" } {
  const bytes = Number(head.ContentLength);
  const etag = normalizeR2Etag(head.ETag);
  if (
    !Number.isSafeInteger(bytes) ||
    bytes <= 0 ||
    bytes > MAX_R2_VIDEO_BYTES ||
    (expectedBytes !== undefined && bytes !== expectedBytes) ||
    head.ContentType !== "video/mp4" ||
    !etag
  ) {
    throw new R2VideoError(
      "VIDEO_UPLOAD_MISMATCH",
      "The stored video does not match its upload authorization.",
      409
    );
  }
  return { bytes, etag, contentType: "video/mp4" };
}

async function hashQuarantineObject(
  bucket: string,
  key: string,
  expected: { bytes: number; etag: string; contentType: "video/mp4" },
  rawEtag: string
): Promise<{ prefix: Uint8Array; sha256: string }> {
  try {
    const response = await client().send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
        // Bind the complete read to the exact object seen by HEAD. The ETag is
        // conditional-transfer metadata only; SHA-256 is computed below from
        // every byte returned by this request.
        IfMatch: rawEtag,
      })
    );
    const responseBytes = Number(response.ContentLength);
    const responseEtag = normalizeR2Etag(response.ETag);
    if (
      responseBytes !== expected.bytes ||
      responseEtag !== expected.etag ||
      response.ContentType !== expected.contentType
    ) {
      throw new R2VideoError(
        "VIDEO_UPLOAD_MISMATCH",
        "The stored video changed while it was being verified.",
        409
      );
    }
    if (!response.Body || !(Symbol.asyncIterator in response.Body)) {
      throw new Error("R2 returned a non-streaming object body.");
    }

    const prefix = new Uint8Array(Math.min(expected.bytes, MP4_INSPECTION_BYTES));
    const hash = createHash("sha256");
    let prefixBytes = 0;
    let totalBytes = 0;
    for await (const rawChunk of response.Body as AsyncIterable<Uint8Array>) {
      if (!(rawChunk instanceof Uint8Array)) {
        throw new Error("R2 returned an invalid object-body chunk.");
      }
      totalBytes += rawChunk.byteLength;
      if (totalBytes > expected.bytes) {
        throw new R2VideoError(
          "VIDEO_UPLOAD_MISMATCH",
          "The stored video byte count changed while it was being verified.",
          409
        );
      }
      hash.update(rawChunk);
      if (prefixBytes < prefix.byteLength) {
        const copyLength = Math.min(rawChunk.byteLength, prefix.byteLength - prefixBytes);
        prefix.set(rawChunk.subarray(0, copyLength), prefixBytes);
        prefixBytes += copyLength;
      }
    }
    if (totalBytes !== expected.bytes || prefixBytes !== prefix.byteLength) {
      throw new R2VideoError(
        "VIDEO_UPLOAD_MISMATCH",
        "The stored video byte count changed while it was being verified.",
        409
      );
    }
    return { prefix, sha256: hash.digest("hex") };
  } catch (error) {
    if (error instanceof R2VideoError) throw error;
    console.error("R2 full-object validation failed", { bucket, key, error: String(error) });
    throw new R2VideoError(
      "VIDEO_INSPECTION_FAILED",
      "The uploaded video could not be inspected. Upload it again.",
      409
    );
  }
}

async function loadIntent(intentId: string, actorId: string): Promise<UploadIntent | undefined> {
  const rows = await db()`
    SELECT * FROM bhashan.r2_video_upload_intents
    WHERE id = ${intentId}::uuid AND actor_user_id = ${actorId}
    LIMIT 1
  `;
  const row = (rows as unknown as UploadIntentRow[])[0];
  return row ? mapIntent(row) : undefined;
}

async function claimIntent(intentId: string, actorId: string): Promise<UploadIntent | undefined> {
  const rows = await db()`
    WITH intent_lock AS (
      SELECT pg_advisory_xact_lock(hashtextextended(${`bhashan:r2-upload-intent:${intentId}`}, 0))
    )
    UPDATE bhashan.r2_video_upload_intents AS intent
    SET status = 'processing', processing_started_at = clock_timestamp(), updated_at = clock_timestamp()
    FROM intent_lock
    WHERE intent.id = ${intentId}::uuid
      AND intent.actor_user_id = ${actorId}
      AND intent.expires_at > clock_timestamp()
      AND (
        (intent.status = 'authorized' AND intent.upload_expires_at > clock_timestamp())
        OR (
          intent.status = 'processing'
          AND intent.processing_started_at < clock_timestamp() - ${PROCESSING_LEASE_SECONDS} * interval '1 second'
        )
      )
    RETURNING intent.*
  `;
  const row = (rows as unknown as UploadIntentRow[])[0];
  return row ? mapIntent(row) : undefined;
}

async function markIntentExpired(intentId: string, actorId: string): Promise<void> {
  await db()`
    UPDATE bhashan.r2_video_upload_intents
    SET status = 'expired', last_error_code = 'UPLOAD_EXPIRED', updated_at = clock_timestamp()
    WHERE id = ${intentId}::uuid
      AND actor_user_id = ${actorId}
      AND (
        -- The short upload deadline applies only before processing starts. A
        -- completion that already owns the processing lease must not be
        -- expired underneath by a concurrent retry crossing that boundary.
        (status = 'authorized' AND upload_expires_at <= clock_timestamp())
        OR (status = 'processing' AND expires_at <= clock_timestamp())
      )
  `;
}

async function rejectIntent(intentId: string, actorId: string, code: string): Promise<void> {
  await db()`
    UPDATE bhashan.r2_video_upload_intents
    SET status = 'rejected', last_error_code = ${code}, updated_at = clock_timestamp()
    WHERE id = ${intentId}::uuid AND actor_user_id = ${actorId} AND status = 'processing'
  `;
}

async function leaveProcessingForIdempotentRetry(
  intentId: string,
  actorId: string,
  code: string
): Promise<void> {
  try {
    await db()`
      UPDATE bhashan.r2_video_upload_intents
      SET last_error_code = ${code}, updated_at = clock_timestamp()
      WHERE id = ${intentId}::uuid AND actor_user_id = ${actorId} AND status = 'processing'
    `;
  } catch (error) {
    console.error("Could not record R2 promotion retry state", { intentId, error: String(error) });
  }
}

function videoFromIntent(intent: UploadIntent): R2StatementVideo {
  if (
    intent.status !== "completed" ||
    !intent.publicKey ||
    !intent.publicEtag ||
    !intent.sha256 ||
    intent.durationMs === undefined
  ) {
    throw new R2VideoError("INVALID_UPLOAD_TOKEN", "The video upload is not complete.", 409);
  }
  const video = normalizeStatementVideo({
    platform: "r2",
    id: intent.publicKey,
    start: 0,
    end: Math.ceil(intent.durationMs / 1000),
    sha256: intent.sha256,
    etag: intent.publicEtag,
    bytes: intent.expectedBytes,
    contentType: intent.contentType,
    durationMs: intent.durationMs,
  });
  if (!video || video.platform !== "r2") {
    throw new Error("Completed R2 upload metadata is invalid.");
  }
  return video;
}

async function deleteQuarantineBestEffort(intent: UploadIntent): Promise<void> {
  try {
    await deleteR2QuarantineObject(intent.quarantineKey);
    await db()`
      UPDATE bhashan.r2_video_upload_intents
      SET quarantine_deleted_at = coalesce(quarantine_deleted_at, clock_timestamp()),
          updated_at = clock_timestamp()
      WHERE id = ${intent.id}::uuid
    `;
  } catch (error) {
    console.error("R2 quarantine cleanup deferred", { intentId: intent.id, error: String(error) });
  }
}

async function assertPublicObjectMatches(video: R2StatementVideo): Promise<void> {
  assertVideoExcerpt(video);
  const config = configuration();
  const expectedKey = contentAddressedR2VideoKey(video.sha256);
  if (!expectedKey || expectedKey !== video.id) {
    throw new R2VideoError(
      "VIDEO_UPLOAD_MISMATCH",
      "The public video key does not match its verified content address.",
      409
    );
  }
  const storedHead = await headObject(config.publicBucket, video.id);
  const head = canonicalHead(storedHead, video.bytes);
  if (
    head.etag !== video.etag ||
    head.contentType !== video.contentType ||
    storedHead.CacheControl !== IMMUTABLE_CACHE_CONTROL ||
    storedHead.Metadata?.["validated-sha256"] !== video.sha256
  ) {
    throw new R2VideoError(
      "VIDEO_UPLOAD_MISMATCH",
      "The public video has changed since it was verified.",
      409
    );
  }
}

async function ensurePromoted({
  intent,
  sourceHead,
  source,
  publicKey,
}: {
  intent: UploadIntent;
  sourceHead: NonNullable<Awaited<ReturnType<typeof headObject>>>;
  source: { bytes: number; etag: string; sha256: string; contentType: "video/mp4" };
  publicKey: string;
}): Promise<{ bytes: number; etag: string; contentType: "video/mp4" }> {
  const config = configuration();
  let finalHead = await headObject(config.publicBucket, publicKey, { allowMissing: true });
  if (!finalHead) {
    const copySource = `/${encodeURIComponent(config.uploadBucket)}/${intent.quarantineKey
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`;
    const copyCommand = new CopyObjectCommand({
      Bucket: config.publicBucket,
      Key: publicKey,
      CopySource: copySource,
      CopySourceIfMatch: sourceHead.ETag,
      MetadataDirective: "REPLACE",
      ContentType: "video/mp4",
      CacheControl: IMMUTABLE_CACHE_CONTROL,
      Metadata: {
        "validated-upload-intent": intent.id,
        "validated-sha256": source.sha256,
      },
    });
    // R2 exposes this conditional destination extension for CopyObject. It
    // makes content-addressed publication atomic when identical uploads race.
    copyCommand.middlewareStack.add(
      (next) => async (args) => {
        const request = args.request as { headers?: Record<string, string> };
        if (!request.headers) throw new Error("The R2 copy request has no headers.");
        request.headers["cf-copy-destination-if-none-match"] = "*";
        return next(args);
      },
      { step: "build", name: "r2CopyDestinationIfNoneMatch" }
    );
    try {
      await client().send(copyCommand);
    } catch (error) {
      // Another request can win the same SHA-256 key. Verify that object below;
      // every other failure remains retryable through the processing lease.
      if (!isPreconditionFailed(error)) throw error;
    }
    finalHead = await headObject(config.publicBucket, publicKey);
  }
  const final = canonicalHead(finalHead, source.bytes);
  if (
    final.etag !== source.etag ||
    final.contentType !== source.contentType ||
    finalHead.CacheControl !== IMMUTABLE_CACHE_CONTROL ||
    finalHead.Metadata?.["validated-sha256"] !== source.sha256
  ) {
    throw new R2VideoError(
      "R2_FINAL_CONFLICT",
      "The immutable public video key already contains different bytes.",
      409
    );
  }
  return final;
}

async function markIntentCompleted({
  intent,
  publicKey,
  sourceEtag,
  publicEtag,
  sha256,
  durationMs,
}: {
  intent: UploadIntent;
  publicKey: string;
  sourceEtag: string;
  publicEtag: string;
  sha256: string;
  durationMs: number;
}): Promise<UploadIntent> {
  const rows = await db()`
    UPDATE bhashan.r2_video_upload_intents
    SET status = 'completed', public_key = ${publicKey},
        quarantine_etag = ${sourceEtag}, public_etag = ${publicEtag},
        sha256 = ${sha256},
        duration_ms = ${durationMs}, completed_at = clock_timestamp(),
        last_error_code = NULL, updated_at = clock_timestamp()
    WHERE id = ${intent.id}::uuid
      AND actor_user_id = ${intent.actorId}
      AND status = 'processing'
    RETURNING *
  `;
  const row = (rows as unknown as UploadIntentRow[])[0];
  if (row) return mapIntent(row);
  const current = await loadIntent(intent.id, intent.actorId);
  if (current?.status === "completed") return current;
  throw new R2VideoError("UPLOAD_STATE_CONFLICT", "The upload state changed. Try again.", 409);
}

function completedResponse(intent: UploadIntent): CompletedR2Upload {
  const video = videoFromIntent(intent);
  const playbackUrl = r2PublicVideoUrl(video.id);
  return {
    video,
    playbackUrl,
    attachmentToken: signToken({
      version: 2,
      purpose: "attachment",
      actorId: intent.actorId,
      intentId: intent.id,
      video,
      expiresAt: Date.now() + ATTACHMENT_TOKEN_SECONDS * 1000,
    }),
  };
}

export async function completeR2Upload({
  actorId,
  uploadToken,
}: {
  actorId: string;
  uploadToken: string;
}): Promise<CompletedR2Upload> {
  const payload = verifyToken(uploadToken, "upload", actorId) as UploadTokenPayload;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(payload.intentId) ||
    !isR2QuarantineObjectKey(payload.quarantineKey) ||
    !Number.isSafeInteger(payload.bytes)
  ) {
    throw new R2VideoError("INVALID_UPLOAD_TOKEN", "The video upload token is invalid.", 400);
  }

  let intent = await claimIntent(payload.intentId, actorId);
  if (!intent) {
    const existing = await loadIntent(payload.intentId, actorId);
    if (!existing || existing.quarantineKey !== payload.quarantineKey || existing.expectedBytes !== payload.bytes) {
      throw new R2VideoError("INVALID_UPLOAD_TOKEN", "The video upload token is invalid.", 400);
    }
    if (existing.status === "completed") {
      const video = videoFromIntent(existing);
      await assertPublicObjectMatches(video);
      await deleteQuarantineBestEffort(existing);
      return completedResponse(existing);
    }
    if (
      existing.status === "processing" &&
      !r2UploadIntentShouldExpire({
        status: "processing",
        uploadExpiresAtMs: existing.uploadExpiresAt.getTime(),
        intentExpiresAtMs: existing.expiresAt.getTime(),
        nowMs: Date.now(),
      })
    ) {
      // Do this before any expiry mutation. Another completion owns a live
      // lease even when the shorter browser-upload deadline has just passed.
      throw new R2VideoError(
        "UPLOAD_PROCESSING",
        "The upload is still being verified. Try completion again shortly.",
        409
      );
    }
    await markIntentExpired(payload.intentId, actorId);
    throw new R2VideoError(
      "UPLOAD_EXPIRED",
      existing.status === "rejected"
        ? "The uploaded video was rejected. Select the file again."
        : "The upload authorization expired. Select the file again.",
      410
    );
  }
  if (intent.quarantineKey !== payload.quarantineKey || intent.expectedBytes !== payload.bytes) {
    await rejectIntent(intent.id, actorId, "TOKEN_METADATA_MISMATCH");
    throw new R2VideoError("INVALID_UPLOAD_TOKEN", "The video upload token is invalid.", 400);
  }

  const config = configuration();
  let sourceHead: NonNullable<Awaited<ReturnType<typeof headObject>>>;
  let source: { bytes: number; etag: string; sha256: string; contentType: "video/mp4" };
  let durationMs: number;
  try {
    sourceHead = await headObject(config.uploadBucket, intent.quarantineKey);
    if (
      sourceHead.CacheControl !== QUARANTINE_CACHE_CONTROL ||
      sourceHead.Metadata?.["upload-intent"] !== intent.id
    ) {
      throw new R2VideoError(
        "VIDEO_UPLOAD_MISMATCH",
        "The quarantine object is not bound to this upload intent.",
        409
      );
    }
    const canonicalSource = canonicalHead(sourceHead, intent.expectedBytes);
    if (!sourceHead.ETag) {
      throw new R2VideoError(
        "VIDEO_UPLOAD_MISMATCH",
        "The stored video is missing its transport ETag.",
        409
      );
    }
    const hashed = await hashQuarantineObject(
      config.uploadBucket,
      intent.quarantineKey,
      canonicalSource,
      sourceHead.ETag
    );
    source = { ...canonicalSource, sha256: hashed.sha256 };
    const inspected = inspectMp4(hashed.prefix, source.bytes);
    durationMs = inspected.durationMs;
    if (
      durationMs < MIN_VIDEO_EXCERPT_SECONDS * 1000 ||
      durationMs > MAX_VIDEO_EXCERPT_SECONDS * 1000
    ) {
      throw new Mp4ValidationError("The MP4 duration must be between three seconds and three minutes.");
    }
  } catch (error) {
    if (error instanceof Mp4ValidationError ||
        (error instanceof R2VideoError && error.code === "VIDEO_UPLOAD_MISMATCH")) {
      const code = error instanceof Mp4ValidationError ? "INVALID_MP4" : error.code;
      await rejectIntent(intent.id, actorId, code);
      await deleteQuarantineBestEffort(intent);
      if (error instanceof Mp4ValidationError) {
        throw new R2VideoError("INVALID_MP4", error.message, 422);
      }
      throw error;
    }
    // A failed read may have crossed the short browser PUT deadline after
    // processing already began. Keep the durable processing lease so a retry
    // can inspect the same immutable quarantine object for up to 24 hours.
    await leaveProcessingForIdempotentRetry(intent.id, actorId, "QUARANTINE_READ_FAILED");
    throw error;
  }

  const publicKey = contentAddressedR2VideoKey(source.sha256);
  if (!publicKey) {
    await rejectIntent(intent.id, actorId, "INVALID_SHA256");
    await deleteQuarantineBestEffort(intent);
    throw new R2VideoError(
      "VIDEO_UPLOAD_MISMATCH",
      "The upload did not produce a valid SHA-256 content address.",
      409
    );
  }

  let final: { bytes: number; etag: string; contentType: "video/mp4" };
  try {
    final = await ensurePromoted({ intent, sourceHead, source, publicKey });
  } catch (error) {
    if (error instanceof R2VideoError && error.code === "R2_FINAL_CONFLICT") {
      await rejectIntent(intent.id, actorId, error.code);
    } else {
      // CopyObject may have succeeded even if its response or the following
      // HEAD was lost. Keep the intent in processing so the stale-lease retry
      // checks the deterministic final key instead of authorizing another PUT.
      await leaveProcessingForIdempotentRetry(intent.id, actorId, "PUBLIC_PROMOTION_FAILED");
    }
    throw error;
  }

  intent = await markIntentCompleted({
    intent,
    publicKey,
    sourceEtag: source.etag,
    publicEtag: final.etag,
    sha256: source.sha256,
    durationMs,
  });
  const video = videoFromIntent(intent);
  assertVideoExcerpt(video);
  await assertPublicObjectMatches(video);
  await deleteQuarantineBestEffort(intent);
  return completedResponse(intent);
}

export async function verifyR2AttachmentToken({
  actorId,
  attachmentToken,
  playbackAttested,
}: {
  actorId: string;
  attachmentToken: string;
  playbackAttested: boolean;
}): Promise<{ video: R2StatementVideo; intentId: string }> {
  if (!playbackAttested) {
    throw new R2VideoError(
      "PLAYBACK_ATTESTATION_REQUIRED",
      "Play the promoted clip through to the end and confirm its picture and audio before saving.",
      400
    );
  }
  const payload = verifyToken(attachmentToken, "attachment", actorId) as AttachmentTokenPayload;
  const video = normalizeStatementVideo(payload.video);
  if (!video || video.platform !== "r2" || typeof payload.intentId !== "string") {
    throw new R2VideoError("INVALID_UPLOAD_TOKEN", "The video attachment token is invalid.", 400);
  }
  const intent = await loadIntent(payload.intentId, actorId);
  if (!intent || intent.status !== "completed") {
    throw new R2VideoError("INVALID_UPLOAD_TOKEN", "The video upload is no longer attachable.", 409);
  }
  const storedVideo = videoFromIntent(intent);
  if (JSON.stringify(storedVideo) !== JSON.stringify(video)) {
    throw new R2VideoError("INVALID_UPLOAD_TOKEN", "The video attachment metadata changed.", 409);
  }
  r2PublicVideoUrl(video.id);
  await assertPublicObjectMatches(video);
  const rows = await db()`
    UPDATE bhashan.r2_video_upload_intents
    SET playback_attested_at = coalesce(playback_attested_at, clock_timestamp()),
        updated_at = clock_timestamp()
    WHERE id = ${intent.id}::uuid
      AND actor_user_id = ${actorId}
      AND status = 'completed'
      AND public_key = ${video.id}
    RETURNING id
  `;
  if (!(rows as unknown as Array<{ id: unknown }>)[0]?.id) {
    throw new R2VideoError(
      "UPLOAD_STATE_CONFLICT",
      "The playback approval could not be recorded. Reload and try again.",
      409
    );
  }
  return { video, intentId: intent.id };
}

export async function verifyExistingR2Video(video: R2StatementVideo): Promise<R2StatementVideo> {
  r2PublicVideoUrl(video.id);
  await assertPublicObjectMatches(video);
  return video;
}

export async function verifiedR2PublicVideoUrl(video: R2StatementVideo): Promise<string> {
  await assertPublicObjectMatches(video);
  return r2PublicVideoUrl(video.id);
}

export function r2PublicVideoUrl(key: string): string {
  if (!isR2VideoObjectKey(key)) throw new Error("The R2 video object key is invalid.");
  const base = publicBaseUrl();
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  return `${base}/${encodedKey}`;
}

export interface ListedR2Objects {
  objects: ListedR2Object[];
  scanned: number;
  scanLimitReached: boolean;
}

async function listObjects({
  bucket,
  prefix,
  maxScanned,
  validKey,
}: {
  bucket: string;
  prefix: string;
  maxScanned: number;
  validKey: (value: unknown) => value is string;
}): Promise<ListedR2Objects> {
  const safeMax = Number.isSafeInteger(maxScanned)
    ? Math.min(Math.max(maxScanned, 1), 5_000)
    : 1;
  const objects: ListedR2Object[] = [];
  let scanned = 0;
  let continuationToken: string | undefined;
  let scanLimitReached = false;
  const seenContinuationTokens = new Set<string>();
  let pages = 0;

  do {
    pages += 1;
    const response = await client().send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
        MaxKeys: Math.min(1_000, safeMax - scanned),
      })
    );
    const page = response.Contents ?? [];
    scanned += page.length;
    for (const item of page) {
      const key = item.Key;
      const bytes = Number(item.Size);
      if (
        validKey(key) &&
        item.LastModified instanceof Date &&
        Number.isSafeInteger(bytes) &&
        bytes >= 0
      ) {
        objects.push({ key, lastModified: item.LastModified, bytes });
      }
    }

    if (!response.IsTruncated) break;
    const nextToken = response.NextContinuationToken;
    if (
      scanned >= safeMax ||
      pages >= 100 ||
      !nextToken ||
      seenContinuationTokens.has(nextToken)
    ) {
      scanLimitReached = true;
      break;
    }
    seenContinuationTokens.add(nextToken);
    continuationToken = nextToken;
  } while (scanned < safeMax);

  return { objects, scanned, scanLimitReached };
}

export async function listR2QuarantineObjects(maxScanned: number): Promise<ListedR2Objects> {
  const config = configuration();
  return listObjects({
    bucket: config.uploadBucket,
    prefix: R2_QUARANTINE_PREFIX,
    maxScanned,
    validKey: isR2QuarantineObjectKey,
  });
}

/** Delete exactly one private quarantine key. */
export async function deleteR2QuarantineObject(key: string): Promise<void> {
  if (!isR2QuarantineObjectKey(key)) throw new Error("The R2 quarantine key is invalid.");
  const config = configuration();
  await client().send(new DeleteObjectCommand({ Bucket: config.uploadBucket, Key: key }));
}
