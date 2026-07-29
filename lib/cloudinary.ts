import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { v2 as cloudinary } from "cloudinary";
import { db } from "./db";
import {
  cloudinaryConfigurationIssues,
  cloudinaryCredentialIssues,
  cloudinaryUploadPresetIssues,
} from "./cloudinary-config";
import type { CloudinaryStatementVideo } from "./types";
import {
  assertVideoExcerpt,
  isCloudinaryVideoPublicId,
  MAX_CLOUDINARY_DERIVED_VIDEO_BYTES,
  MAX_HOSTED_VIDEO_BYTES,
  MAX_VIDEO_EXCERPT_SECONDS,
  MIN_VIDEO_EXCERPT_SECONDS,
  normalizeCloudinaryAssetId,
  normalizeStatementVideo,
} from "./video";

const CLOUDINARY_VIDEO_PREFIX = "bhashanboard/statement-videos/";
const CLOUDINARY_INTENT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const CLOUDINARY_VIDEO_TRANSFORMATION = "ac_aac,f_mp4,q_auto:good,vc_h264";
const CLOUDINARY_ADMIN_TIMEOUT_MS = 12_000;
const CLOUDINARY_PRESET_CACHE_MS = 5 * 60 * 1000;
const MAX_CLOUDINARY_VIDEO_DIMENSION = 3_840;
const MAX_CLOUDINARY_VIDEO_PIXELS = 3_840 * 2_160;
const UPLOAD_TOKEN_SECONDS = 24 * 60 * 60;
const ATTACHMENT_TOKEN_SECONDS = 4 * 60 * 60;
// One completion pass can make four bounded provider calls. Keep the reclaim
// lease comfortably above that route workflow so a retry cannot start a second
// eager request while the first worker is still active.
const PROCESSING_LEASE_SECONDS = 90;
const MAX_ACTIVE_UPLOADS_PER_ACTOR = 4;
const MAX_DAILY_UPLOADS_PER_ACTOR = 20;
const MAX_DAILY_BYTES_PER_ACTOR = 500 * 1024 * 1024;

const ALLOWED_UPLOADS = new Map([
  [".mp4", new Set(["", "video/mp4"])],
  [".mov", new Set(["", "video/quicktime"])],
  [".webm", new Set(["", "video/webm"])],
]);

interface CloudinaryCredentials {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

interface CloudinaryConfiguration extends CloudinaryCredentials {
  uploadPreset: string;
}

interface UploadTokenPayload {
  version: 1;
  purpose: "upload";
  actorId: string;
  intentId: string;
  publicId: string;
  bytes: number;
  expiresAt: number;
}

interface AttachmentTokenPayload {
  version: 1;
  purpose: "attachment";
  actorId: string;
  intentId: string;
  video: CloudinaryStatementVideo;
  expiresAt: number;
}

type TokenPayload = UploadTokenPayload | AttachmentTokenPayload;
type UploadIntentStatus =
  | "authorized"
  | "processing"
  | "completed"
  | "rejected"
  | "expired"
  | "deleting"
  | "deleted";

interface UploadIntentRow {
  id: unknown;
  actor_user_id: unknown;
  status: unknown;
  public_id: unknown;
  expected_bytes: unknown;
  actual_bytes: unknown;
  derived_bytes: unknown;
  asset_id: unknown;
  version: unknown;
  format: unknown;
  duration_ms: unknown;
  upload_expires_at: unknown;
  expires_at: unknown;
  processing_started_at: unknown;
  transformation_requested_at: unknown;
  completed_at: unknown;
}

interface UploadIntent {
  id: string;
  actorId: string;
  status: UploadIntentStatus;
  publicId: string;
  expectedBytes: number;
  actualBytes?: number;
  derivedBytes?: number;
  assetId?: string;
  version?: number;
  format?: "mp4";
  durationMs?: number;
  uploadExpiresAt: Date;
  expiresAt: Date;
  transformationRequestedAt?: Date;
}

interface CloudinaryResource {
  publicId: string;
  assetId: string;
  version: number;
  bytes: number;
  durationMs: number;
  originalFormat: string;
  width: number;
  height: number;
}

export interface CloudinaryUploadAuthorization {
  uploadUrl: string;
  uploadToken: string;
  expiresAt: string;
  fields: Record<string, string>;
}

export interface CompletedCloudinaryUpload {
  video: CloudinaryStatementVideo;
  attachmentToken: string;
  playbackUrl: string;
}

export class CloudinaryVideoError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "CloudinaryVideoError";
  }
}

let credentialCache: CloudinaryCredentials | undefined;
let uploadConfigurationCache: CloudinaryConfiguration | undefined;
let validatedPreset:
  | { cacheKey: string; validUntilMs: number }
  | undefined;
let presetValidationPromise: Promise<void> | undefined;

function credentials(): CloudinaryCredentials {
  if (credentialCache) return credentialCache;
  const issues = cloudinaryCredentialIssues();
  if (issues.length > 0) {
    throw new CloudinaryVideoError(
      "CLOUDINARY_NOT_CONFIGURED",
      "Cloudinary video storage is not configured on this deployment.",
      503
    );
  }
  const config = {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME!.trim(),
    apiKey: process.env.CLOUDINARY_API_KEY!.trim(),
    apiSecret: process.env.CLOUDINARY_API_SECRET!.trim(),
  };
  cloudinary.config({
    cloud_name: config.cloudName,
    api_key: config.apiKey,
    api_secret: config.apiSecret,
    secure: true,
  });
  credentialCache = config;
  return config;
}

function uploadConfiguration(): CloudinaryConfiguration {
  if (uploadConfigurationCache) return uploadConfigurationCache;
  const issues = cloudinaryConfigurationIssues();
  if (issues.length > 0) {
    throw new CloudinaryVideoError(
      "CLOUDINARY_NOT_CONFIGURED",
      "Cloudinary video uploads are not configured on this deployment.",
      503
    );
  }
  uploadConfigurationCache = {
    ...credentials(),
    uploadPreset: process.env.CLOUDINARY_VIDEO_UPLOAD_PRESET!.trim(),
  };
  return uploadConfigurationCache;
}

export function cloudinaryStorageConfigured(): boolean {
  return cloudinaryCredentialIssues().length === 0;
}

export function cloudinaryUploadsConfigured(): boolean {
  return cloudinaryConfigurationIssues().length === 0;
}

async function verifyUploadPreset(
  config: CloudinaryConfiguration
): Promise<void> {
  const cacheKey = `${config.cloudName}\0${config.uploadPreset}`;
  if (
    validatedPreset?.cacheKey === cacheKey &&
    validatedPreset.validUntilMs > Date.now()
  ) {
    return;
  }
  if (presetValidationPromise) return presetValidationPromise;

  presetValidationPromise = (async () => {
    let preset: unknown;
    try {
      preset = await cloudinary.api.upload_preset(config.uploadPreset, {
        timeout: CLOUDINARY_ADMIN_TIMEOUT_MS,
      });
    } catch {
      throw new CloudinaryVideoError(
        "CLOUDINARY_PRESET_UNAVAILABLE",
        "Cloudinary could not verify the dedicated signed video preset.",
        503
      );
    }
    if (cloudinaryUploadPresetIssues(preset).length > 0) {
      throw new CloudinaryVideoError(
        "CLOUDINARY_PRESET_UNSAFE",
        "The Cloudinary video preset must be signed, authenticated, limited to 50 MiB and MP4/MOV/WebM, and contain no transformations or folder rules.",
        503
      );
    }
    validatedPreset = {
      cacheKey,
      validUntilMs: Date.now() + CLOUDINARY_PRESET_CACHE_MS,
    };
  })();
  try {
    await presetValidationPromise;
  } finally {
    presetValidationPromise = undefined;
  }
}

function objectRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function integerValue(value: unknown, label: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`Invalid ${label} returned by the database.`);
  }
  return parsed;
}

function dateValue(value: unknown, label: string): Date {
  const parsed = value instanceof Date ? value : new Date(String(value));
  if (!Number.isFinite(parsed.getTime())) {
    throw new Error(`Invalid ${label} returned by the database.`);
  }
  return parsed;
}

function mapIntent(row: UploadIntentRow): UploadIntent {
  const status = String(row.status) as UploadIntentStatus;
  if (
    ![
      "authorized",
      "processing",
      "completed",
      "rejected",
      "expired",
      "deleting",
      "deleted",
    ].includes(status)
  ) {
    throw new Error("Invalid Cloudinary upload status returned by the database.");
  }
  const publicId = String(row.public_id);
  if (!isCloudinaryVideoPublicId(publicId)) {
    throw new Error("Invalid Cloudinary public ID returned by the database.");
  }
  const assetId =
    row.asset_id == null ? undefined : normalizeCloudinaryAssetId(row.asset_id);
  if (row.asset_id != null && !assetId) {
    throw new Error("Invalid Cloudinary asset ID returned by the database.");
  }
  const format =
    row.format == null
      ? undefined
      : row.format === "mp4"
        ? "mp4"
        : (() => {
            throw new Error("Invalid Cloudinary format returned by the database.");
          })();
  return {
    id: String(row.id),
    actorId: String(row.actor_user_id),
    status,
    publicId,
    expectedBytes: integerValue(row.expected_bytes, "expected byte count"),
    actualBytes:
      row.actual_bytes == null
        ? undefined
        : integerValue(row.actual_bytes, "actual byte count"),
    derivedBytes:
      row.derived_bytes == null
        ? undefined
        : integerValue(row.derived_bytes, "derived byte count"),
    assetId,
    version:
      row.version == null ? undefined : integerValue(row.version, "Cloudinary version"),
    format,
    durationMs:
      row.duration_ms == null ? undefined : integerValue(row.duration_ms, "duration"),
    uploadExpiresAt: dateValue(row.upload_expires_at, "upload expiry"),
    expiresAt: dateValue(row.expires_at, "intent expiry"),
    transformationRequestedAt:
      row.transformation_requested_at == null
        ? undefined
        : dateValue(
            row.transformation_requested_at,
            "transformation request time"
          ),
  };
}

function tokenSignature(encodedPayload: string): Buffer {
  return createHmac("sha256", credentials().apiSecret)
    .update("bhashan-cloudinary-token-v1\0")
    .update(encodedPayload)
    .digest();
}

function signToken(payload: TokenPayload): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encodedPayload}.${tokenSignature(encodedPayload).toString("base64url")}`;
}

function verifyToken(
  token: string,
  purpose: TokenPayload["purpose"],
  actorId: string
): TokenPayload {
  if (!token || token.length > 8_192) {
    throw new CloudinaryVideoError(
      "INVALID_UPLOAD_TOKEN",
      "The video upload token is invalid.",
      400
    );
  }
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new CloudinaryVideoError(
      "INVALID_UPLOAD_TOKEN",
      "The video upload token is invalid.",
      400
    );
  }

  let suppliedSignature: Buffer;
  try {
    suppliedSignature = Buffer.from(parts[1], "base64url");
  } catch {
    throw new CloudinaryVideoError(
      "INVALID_UPLOAD_TOKEN",
      "The video upload token is invalid.",
      400
    );
  }
  const expectedSignature = tokenSignature(parts[0]);
  if (
    suppliedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(suppliedSignature, expectedSignature)
  ) {
    throw new CloudinaryVideoError(
      "INVALID_UPLOAD_TOKEN",
      "The video upload token is invalid.",
      400
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
  } catch {
    throw new CloudinaryVideoError(
      "INVALID_UPLOAD_TOKEN",
      "The video upload token is invalid.",
      400
    );
  }
  const payload = objectRecord(parsed);
  if (
    payload?.version !== 1 ||
    payload.purpose !== purpose ||
    payload.actorId !== actorId ||
    !Number.isSafeInteger(payload.expiresAt) ||
    Number(payload.expiresAt) <= Date.now()
  ) {
    throw new CloudinaryVideoError(
      "EXPIRED_UPLOAD_TOKEN",
      "The video upload authorization expired. Upload the file again.",
      410
    );
  }
  return payload as unknown as TokenPayload;
}

function extensionOf(fileName: string): string {
  const match = /\.[^.]+$/.exec(fileName.toLowerCase());
  return match?.[0] ?? "";
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
  if (!fileName || fileName.length > 255) {
    throw new CloudinaryVideoError(
      "INVALID_VIDEO_FILE",
      "Choose an MP4, MOV or WebM video file.",
      400
    );
  }
  const acceptedTypes = ALLOWED_UPLOADS.get(extensionOf(fileName));
  if (!acceptedTypes || !acceptedTypes.has(contentType)) {
    throw new CloudinaryVideoError(
      "INVALID_VIDEO_TYPE",
      "The uploaded video must be MP4, MOV or WebM.",
      400
    );
  }
  if (
    !Number.isSafeInteger(bytes) ||
    bytes <= 0 ||
    bytes > MAX_HOSTED_VIDEO_BYTES
  ) {
    throw new CloudinaryVideoError(
      "VIDEO_TOO_LARGE",
      "The uploaded video must be 50 MiB or smaller.",
      400
    );
  }
  if (!rightsAttested) {
    throw new CloudinaryVideoError(
      "RIGHTS_ATTESTATION_REQUIRED",
      "Confirm that this footage is rights-cleared and its provenance is documented.",
      400
    );
  }
}

async function createUploadIntent({
  actorId,
  intentId,
  publicId,
  bytes,
}: {
  actorId: string;
  intentId: string;
  publicId: string;
  bytes: number;
}): Promise<{ uploadExpiresAt: Date; expiresAt: Date }> {
  const results = await db().transaction((tx) => [
    tx`SELECT pg_advisory_xact_lock(
      hashtextextended(${`bhashan:cloudinary-upload-quota:${actorId}`}, 0)
    )`,
    tx`
      WITH quota AS MATERIALIZED (
        SELECT
          count(*) FILTER (
            WHERE (
              status = 'authorized'
              AND upload_expires_at > clock_timestamp()
            ) OR (
              status = 'processing'
              AND expires_at > clock_timestamp()
            )
          )::integer AS active_count,
          count(*) FILTER (
            WHERE created_at >= clock_timestamp() - interval '24 hours'
          )::integer AS daily_count,
          count(*) FILTER (
            WHERE created_at >= clock_timestamp() - interval '24 hours'
          )::bigint * ${MAX_HOSTED_VIDEO_BYTES}::bigint AS daily_reserved_bytes
        FROM bhashan.cloudinary_video_upload_intents
        WHERE actor_user_id = ${actorId}
      ), inserted AS (
        INSERT INTO bhashan.cloudinary_video_upload_intents (
          id, actor_user_id, status, public_id, expected_bytes,
          rights_attested_at, upload_expires_at, expires_at
        )
        SELECT
          ${intentId}::uuid, ${actorId}, 'authorized', ${publicId}, ${bytes},
          clock_timestamp(),
          clock_timestamp() + interval '30 minutes',
          clock_timestamp() + interval '24 hours'
        FROM quota
        WHERE active_count < ${MAX_ACTIVE_UPLOADS_PER_ACTOR}
          AND daily_count < ${MAX_DAILY_UPLOADS_PER_ACTOR}
          AND daily_reserved_bytes + ${MAX_HOSTED_VIDEO_BYTES}
            <= ${MAX_DAILY_BYTES_PER_ACTOR}
        RETURNING id, upload_expires_at, expires_at
      )
      SELECT quota.active_count, quota.daily_count, quota.daily_reserved_bytes,
             inserted.id, inserted.upload_expires_at, inserted.expires_at
      FROM quota LEFT JOIN inserted ON true
    `,
  ]);
  const row = (results[1] as unknown as Array<Record<string, unknown>>)[0];
  if (!row?.id) {
    throw new CloudinaryVideoError(
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

export async function createCloudinaryUploadAuthorization({
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
}): Promise<CloudinaryUploadAuthorization> {
  validateUploadInput({ fileName, contentType, bytes, rightsAttested });
  const config = uploadConfiguration();
  await verifyUploadPreset(config);
  const intentId = randomUUID().toLowerCase();
  const publicId = `${CLOUDINARY_VIDEO_PREFIX}${intentId}`;
  const intent = await createUploadIntent({
    actorId,
    intentId,
    publicId,
    bytes,
  });
  const timestamp = Math.floor(Date.now() / 1000);
  const signedFields = {
    allowed_formats: "mp4,mov,webm",
    context: `upload_intent=${intentId}`,
    overwrite: "false",
    public_id: publicId,
    timestamp: String(timestamp),
    type: "authenticated",
    unique_filename: "false",
    upload_preset: config.uploadPreset,
    use_filename: "false",
  };
  const signature = cloudinary.utils.api_sign_request(
    signedFields,
    config.apiSecret
  );
  const tokenExpiresAt = Math.min(
    intent.expiresAt.getTime(),
    Date.now() + UPLOAD_TOKEN_SECONDS * 1000
  );
  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${encodeURIComponent(
      config.cloudName
    )}/video/upload`,
    uploadToken: signToken({
      version: 1,
      purpose: "upload",
      actorId,
      intentId,
      publicId,
      bytes,
      expiresAt: tokenExpiresAt,
    }),
    expiresAt: new Date(
      Math.min(tokenExpiresAt, intent.uploadExpiresAt.getTime())
    ).toISOString(),
    fields: {
      ...signedFields,
      api_key: config.apiKey,
      signature,
    },
  };
}

async function loadIntent(
  intentId: string,
  actorId: string
): Promise<UploadIntent | undefined> {
  const rows = await db()`
    SELECT *
    FROM bhashan.cloudinary_video_upload_intents
    WHERE id = ${intentId}::uuid AND actor_user_id = ${actorId}
    LIMIT 1
  `;
  const row = (rows as unknown as UploadIntentRow[])[0];
  return row ? mapIntent(row) : undefined;
}

async function claimIntent(
  intentId: string,
  actorId: string
): Promise<UploadIntent | undefined> {
  const rows = await db()`
    WITH intent_lock AS (
      SELECT pg_advisory_xact_lock(
        hashtextextended(${`bhashan:cloudinary-upload-intent:${intentId}`}, 0)
      )
    )
    UPDATE bhashan.cloudinary_video_upload_intents AS intent
    SET status = 'processing',
        processing_started_at = clock_timestamp(),
        updated_at = clock_timestamp()
    FROM intent_lock
    WHERE intent.id = ${intentId}::uuid
      AND intent.actor_user_id = ${actorId}
      AND intent.expires_at > clock_timestamp()
      AND (
        (intent.status = 'authorized' AND intent.upload_expires_at > clock_timestamp())
        OR (
          intent.status = 'processing'
          AND intent.processing_started_at
            < clock_timestamp() - ${PROCESSING_LEASE_SECONDS} * interval '1 second'
        )
      )
    RETURNING intent.*
  `;
  const row = (rows as unknown as UploadIntentRow[])[0];
  return row ? mapIntent(row) : undefined;
}

async function markIntentExpired(intentId: string, actorId: string): Promise<void> {
  await db()`
    UPDATE bhashan.cloudinary_video_upload_intents
    SET status = 'expired',
        last_error_code = 'UPLOAD_EXPIRED',
        updated_at = clock_timestamp()
    WHERE id = ${intentId}::uuid
      AND actor_user_id = ${actorId}
      AND status IN ('authorized', 'processing')
      AND (
        (status = 'authorized' AND upload_expires_at <= clock_timestamp())
        OR (status = 'processing' AND expires_at <= clock_timestamp())
      )
  `;
}

async function rejectIntent(
  intentId: string,
  actorId: string,
  code: string
): Promise<void> {
  await db()`
    UPDATE bhashan.cloudinary_video_upload_intents
    SET status = 'rejected',
        last_error_code = ${code},
        updated_at = clock_timestamp()
    WHERE id = ${intentId}::uuid
      AND actor_user_id = ${actorId}
      AND status = 'processing'
  `;
}

async function leaveProcessingForRetry(
  intentId: string,
  actorId: string,
  code: string
): Promise<void> {
  try {
    await db()`
      UPDATE bhashan.cloudinary_video_upload_intents
      SET last_error_code = ${code}, updated_at = clock_timestamp()
      WHERE id = ${intentId}::uuid
        AND actor_user_id = ${actorId}
        AND status = 'processing'
    `;
  } catch (error) {
    console.error("Could not record Cloudinary retry state", {
      intentId,
      error: String(error),
    });
  }
}

function contextUploadIntent(resource: Record<string, unknown>): string | undefined {
  const context = objectRecord(resource.context);
  const custom = objectRecord(context?.custom);
  const value = custom?.upload_intent;
  return typeof value === "string" ? value : undefined;
}

async function loadCloudinaryResource(intent: UploadIntent): Promise<CloudinaryResource> {
  let raw: unknown;
  try {
    raw = await cloudinary.api.resource(intent.publicId, {
      resource_type: "video",
      type: "authenticated",
      context: true,
      timeout: CLOUDINARY_ADMIN_TIMEOUT_MS,
    });
  } catch (error) {
    const record = objectRecord(error);
    const status = Number(record?.http_code);
    if (status === 404) {
      throw new CloudinaryVideoError(
        "VIDEO_UPLOAD_MISSING",
        "Cloudinary has not made the uploaded video available yet.",
        409
      );
    }
    throw new CloudinaryVideoError(
      "CLOUDINARY_LOOKUP_FAILED",
      "Cloudinary could not verify the uploaded video. Try the server check again.",
      503
    );
  }
  const resource = objectRecord(raw);
  const assetId = normalizeCloudinaryAssetId(resource?.asset_id);
  const publicId = typeof resource?.public_id === "string" ? resource.public_id : "";
  const version = Number(resource?.version);
  const bytes = Number(resource?.bytes);
  const durationSeconds = Number(resource?.duration);
  const durationMs = Math.round(durationSeconds * 1000);
  const width = Number(resource?.width);
  const height = Number(resource?.height);
  const originalFormat =
    typeof resource?.format === "string" ? resource.format.toLowerCase() : "";
  if (
    publicId !== intent.publicId ||
    !assetId ||
    resource?.resource_type !== "video" ||
    resource?.type !== "authenticated" ||
    contextUploadIntent(resource ?? {}) !== intent.id
  ) {
    throw new CloudinaryVideoError(
      "VIDEO_UPLOAD_MISMATCH",
      "The Cloudinary asset does not match its upload authorization.",
      422
    );
  }

  await recordObservedAssetIdentity(intent, assetId);

  if (
    !Number.isSafeInteger(version) ||
    version <= 0 ||
    !Number.isSafeInteger(bytes) ||
    bytes !== intent.expectedBytes ||
    bytes <= 0 ||
    bytes > MAX_HOSTED_VIDEO_BYTES ||
    !Number.isSafeInteger(durationMs) ||
    durationMs < MIN_VIDEO_EXCERPT_SECONDS * 1000 ||
    durationMs > MAX_VIDEO_EXCERPT_SECONDS * 1000 ||
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    width > MAX_CLOUDINARY_VIDEO_DIMENSION ||
    height > MAX_CLOUDINARY_VIDEO_DIMENSION ||
    width * height > MAX_CLOUDINARY_VIDEO_PIXELS ||
    !["mp4", "mov", "webm"].includes(originalFormat)
  ) {
    throw new CloudinaryVideoError(
      "VIDEO_UPLOAD_MISMATCH",
      "The Cloudinary asset does not match its upload authorization or limits.",
      422
    );
  }
  return {
    publicId,
    assetId,
    version,
    bytes,
    durationMs,
    originalFormat,
    width,
    height,
  };
}

async function requestCloudinaryDerivative(
  intent: UploadIntent
): Promise<UploadIntent> {
  if (intent.transformationRequestedAt) return intent;

  try {
    await cloudinary.uploader.explicit(intent.publicId, {
      resource_type: "video",
      type: "authenticated",
      eager: [
        {
          audio_codec: "aac",
          fetch_format: "mp4",
          quality: "auto:good",
          video_codec: "h264",
        },
      ],
      eager_async: true,
      timeout: CLOUDINARY_ADMIN_TIMEOUT_MS,
    });
  } catch {
    throw new CloudinaryVideoError(
      "CLOUDINARY_TRANSFORM_REQUEST_FAILED",
      "Cloudinary could not start the browser-ready MP4. Retry the server check.",
      503
    );
  }

  const rows = await db()`
    UPDATE bhashan.cloudinary_video_upload_intents
    SET
      transformation_requested_at = coalesce(
        transformation_requested_at,
        clock_timestamp()
      ),
      updated_at = clock_timestamp()
    WHERE id = ${intent.id}::uuid
      AND actor_user_id = ${intent.actorId}
      AND status = 'processing'
    RETURNING *
  `;
  const row = (rows as unknown as UploadIntentRow[])[0];
  if (!row) {
    throw new CloudinaryVideoError(
      "UPLOAD_STATE_CONFLICT",
      "The upload state changed before processing could be recorded.",
      409
    );
  }
  return mapIntent(row);
}

async function recordObservedAssetIdentity(
  intent: UploadIntent,
  assetId: string
): Promise<UploadIntent> {
  const rows = await db()`
    UPDATE bhashan.cloudinary_video_upload_intents
    SET
      asset_id = ${assetId},
      updated_at = clock_timestamp()
    WHERE id = ${intent.id}::uuid
      AND actor_user_id = ${intent.actorId}
      AND status = 'processing'
      AND (asset_id IS NULL OR asset_id = ${assetId})
    RETURNING *
  `;
  const row = (rows as unknown as UploadIntentRow[])[0];
  if (!row) {
    throw new CloudinaryVideoError(
      "UPLOAD_STATE_CONFLICT",
      "The immutable Cloudinary asset identity changed during verification.",
      409
    );
  }
  return mapIntent(row);
}

function videoDeliveryUrl(publicId: string, version: number): string {
  if (!isCloudinaryVideoPublicId(publicId) || !Number.isSafeInteger(version) || version <= 0) {
    throw new Error("The Cloudinary delivery identity is invalid.");
  }
  credentials();
  return cloudinary.url(publicId, {
    resource_type: "video",
    type: "authenticated",
    secure: true,
    sign_url: true,
    version,
    format: "mp4",
    transformation: [
      {
        audio_codec: "aac",
        fetch_format: "mp4",
        quality: "auto:good",
        video_codec: "h264",
      },
    ],
    analytics: false,
  });
}

function responseVideoBytes(response: Response): number | undefined {
  const contentRange = response.headers.get("content-range");
  const rangeTotal = contentRange ? /\/(\d+)$/.exec(contentRange)?.[1] : undefined;
  const candidate = Number(rangeTotal ?? response.headers.get("content-length"));
  return Number.isSafeInteger(candidate) && candidate > 0 ? candidate : undefined;
}

async function deliveryMetadata(url: string): Promise<{ bytes: number }> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "HEAD",
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    throw new CloudinaryVideoError(
      "CLOUDINARY_DELIVERY_FAILED",
      "The processed video could not be reached. Try the server check again.",
      503
    );
  }
  if (!response.ok) {
    throw new CloudinaryVideoError(
      response.status === 404 || response.status === 423
        ? "CLOUDINARY_PROCESSING"
        : "CLOUDINARY_DELIVERY_FAILED",
      response.status === 404 || response.status === 423
        ? "Cloudinary is still processing this video. Try the server check again shortly."
        : "The processed Cloudinary video is unavailable.",
      response.status === 404 || response.status === 423 ? 409 : 503
    );
  }
  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim();
  const bytes = responseVideoBytes(response);
  if (
    contentType !== "video/mp4" ||
    bytes === undefined ||
    bytes > MAX_CLOUDINARY_DERIVED_VIDEO_BYTES
  ) {
    throw new CloudinaryVideoError(
      "CLOUDINARY_DERIVATIVE_MISMATCH",
      "Cloudinary did not produce the expected browser-ready MP4.",
      422
    );
  }
  return { bytes };
}

async function markIntentCompleted({
  intent,
  resource,
  derivedBytes,
}: {
  intent: UploadIntent;
  resource: CloudinaryResource;
  derivedBytes: number;
}): Promise<UploadIntent> {
  const rows = await db()`
    UPDATE bhashan.cloudinary_video_upload_intents
    SET status = 'completed',
        asset_id = ${resource.assetId},
        version = ${resource.version},
        actual_bytes = ${resource.bytes},
        derived_bytes = ${derivedBytes},
        duration_ms = ${resource.durationMs},
        format = 'mp4',
        completed_at = clock_timestamp(),
        last_error_code = NULL,
        updated_at = clock_timestamp()
    WHERE id = ${intent.id}::uuid
      AND actor_user_id = ${intent.actorId}
      AND status = 'processing'
      AND (asset_id IS NULL OR asset_id = ${resource.assetId})
    RETURNING *
  `;
  const row = (rows as unknown as UploadIntentRow[])[0];
  if (row) return mapIntent(row);
  const current = await loadIntent(intent.id, intent.actorId);
  if (current?.status === "completed") return current;
  throw new CloudinaryVideoError(
    "UPLOAD_STATE_CONFLICT",
    "The upload state changed. Try again.",
    409
  );
}

function videoFromIntent(intent: UploadIntent): CloudinaryStatementVideo {
  if (
    intent.status !== "completed" ||
    !intent.assetId ||
    intent.version === undefined ||
    intent.actualBytes === undefined ||
    intent.derivedBytes === undefined ||
    intent.durationMs === undefined ||
    intent.format !== "mp4"
  ) {
    throw new CloudinaryVideoError(
      "INVALID_UPLOAD_TOKEN",
      "The Cloudinary upload is not complete.",
      409
    );
  }
  const video = normalizeStatementVideo({
    platform: "cloudinary",
    id: intent.publicId,
    assetId: intent.assetId,
    version: intent.version,
    bytes: intent.actualBytes,
    derivedBytes: intent.derivedBytes,
    format: intent.format,
    durationMs: intent.durationMs,
    start: 0,
    end: Math.ceil(intent.durationMs / 1000),
  });
  if (!video || video.platform !== "cloudinary") {
    throw new Error("Completed Cloudinary metadata is invalid.");
  }
  return video;
}

async function assertDeliveryMatches(video: CloudinaryStatementVideo): Promise<void> {
  assertVideoExcerpt(video);
  const metadata = await deliveryMetadata(
    videoDeliveryUrl(video.id, video.version)
  );
  if (metadata.bytes !== video.derivedBytes) {
    throw new CloudinaryVideoError(
      "CLOUDINARY_DERIVATIVE_MISMATCH",
      "The processed Cloudinary video changed after verification.",
      409
    );
  }
}

function completedResponse(intent: UploadIntent): CompletedCloudinaryUpload {
  const video = videoFromIntent(intent);
  return {
    video,
    playbackUrl: videoDeliveryUrl(video.id, video.version),
    attachmentToken: signToken({
      version: 1,
      purpose: "attachment",
      actorId: intent.actorId,
      intentId: intent.id,
      video,
      expiresAt: Date.now() + ATTACHMENT_TOKEN_SECONDS * 1000,
    }),
  };
}

export async function completeCloudinaryUpload({
  actorId,
  uploadToken,
}: {
  actorId: string;
  uploadToken: string;
}): Promise<CompletedCloudinaryUpload> {
  const payload = verifyToken(
    uploadToken,
    "upload",
    actorId
  ) as UploadTokenPayload;
  if (
    !CLOUDINARY_INTENT_ID_PATTERN.test(payload.intentId) ||
    !isCloudinaryVideoPublicId(payload.publicId) ||
    !Number.isSafeInteger(payload.bytes)
  ) {
    throw new CloudinaryVideoError(
      "INVALID_UPLOAD_TOKEN",
      "The video upload token is invalid.",
      400
    );
  }

  let intent = await claimIntent(payload.intentId, actorId);
  if (!intent) {
    const existing = await loadIntent(payload.intentId, actorId);
    if (
      !existing ||
      existing.publicId !== payload.publicId ||
      existing.expectedBytes !== payload.bytes
    ) {
      throw new CloudinaryVideoError(
        "INVALID_UPLOAD_TOKEN",
        "The video upload token is invalid.",
        400
      );
    }
    if (existing.status === "completed") {
      await assertDeliveryMatches(videoFromIntent(existing));
      return completedResponse(existing);
    }
    if (
      existing.status === "processing" &&
      existing.expiresAt.getTime() > Date.now()
    ) {
      throw new CloudinaryVideoError(
        "UPLOAD_PROCESSING",
        "The upload is still being verified. Try completion again shortly.",
        409
      );
    }
    await markIntentExpired(payload.intentId, actorId);
    throw new CloudinaryVideoError(
      "UPLOAD_EXPIRED",
      existing.status === "rejected"
        ? "The uploaded video was rejected. Select the file again."
        : "The upload authorization expired. Select the file again.",
      410
    );
  }
  if (
    intent.publicId !== payload.publicId ||
    intent.expectedBytes !== payload.bytes
  ) {
    await rejectIntent(intent.id, actorId, "TOKEN_METADATA_MISMATCH");
    throw new CloudinaryVideoError(
      "INVALID_UPLOAD_TOKEN",
      "The video upload token is invalid.",
      400
    );
  }

  try {
    const resource = await loadCloudinaryResource(intent);
    intent = {
      ...intent,
      assetId: resource.assetId,
    };
    intent = await requestCloudinaryDerivative(intent);
    const delivery = await deliveryMetadata(
      videoDeliveryUrl(resource.publicId, resource.version)
    );
    intent = await markIntentCompleted({
      intent,
      resource,
      derivedBytes: delivery.bytes,
    });
    const video = videoFromIntent(intent);
    await assertDeliveryMatches(video);
    return completedResponse(intent);
  } catch (error) {
    if (
      error instanceof CloudinaryVideoError &&
      ["VIDEO_UPLOAD_MISMATCH", "CLOUDINARY_DERIVATIVE_MISMATCH"].includes(
        error.code
      )
    ) {
      await rejectIntent(intent.id, actorId, error.code);
    } else {
      await leaveProcessingForRetry(
        intent.id,
        actorId,
        error instanceof CloudinaryVideoError
          ? error.code
          : "CLOUDINARY_VERIFICATION_FAILED"
      );
    }
    throw error;
  }
}

export async function verifyCloudinaryAttachmentToken({
  actorId,
  attachmentToken,
  playbackAttested,
}: {
  actorId: string;
  attachmentToken: string;
  playbackAttested: boolean;
}): Promise<{ video: CloudinaryStatementVideo; intentId: string }> {
  if (!playbackAttested) {
    throw new CloudinaryVideoError(
      "PLAYBACK_ATTESTATION_REQUIRED",
      "Play the processed clip through to the end and confirm its picture and audio before saving.",
      400
    );
  }
  const payload = verifyToken(
    attachmentToken,
    "attachment",
    actorId
  ) as AttachmentTokenPayload;
  const video = normalizeStatementVideo(payload.video);
  if (
    !video ||
    video.platform !== "cloudinary" ||
    typeof payload.intentId !== "string"
  ) {
    throw new CloudinaryVideoError(
      "INVALID_UPLOAD_TOKEN",
      "The video attachment token is invalid.",
      400
    );
  }
  const intent = await loadIntent(payload.intentId, actorId);
  if (!intent || intent.status !== "completed") {
    throw new CloudinaryVideoError(
      "INVALID_UPLOAD_TOKEN",
      "The video upload is no longer attachable.",
      409
    );
  }
  const storedVideo = videoFromIntent(intent);
  if (JSON.stringify(storedVideo) !== JSON.stringify(video)) {
    throw new CloudinaryVideoError(
      "INVALID_UPLOAD_TOKEN",
      "The video attachment metadata changed.",
      409
    );
  }
  await assertDeliveryMatches(video);
  const rows = await db()`
    UPDATE bhashan.cloudinary_video_upload_intents
    SET playback_attested_at = coalesce(
          playback_attested_at,
          clock_timestamp()
        ),
        updated_at = clock_timestamp()
    WHERE id = ${intent.id}::uuid
      AND actor_user_id = ${actorId}
      AND status = 'completed'
      AND public_id = ${video.id}
    RETURNING id
  `;
  if (!(rows as unknown as Array<{ id: unknown }>)[0]?.id) {
    throw new CloudinaryVideoError(
      "UPLOAD_STATE_CONFLICT",
      "The playback approval could not be recorded. Reload and try again.",
      409
    );
  }
  return { video, intentId: intent.id };
}

export async function verifyExistingCloudinaryVideo(
  video: CloudinaryStatementVideo
): Promise<CloudinaryStatementVideo> {
  await assertDeliveryMatches(video);
  return video;
}

export function cloudinaryVideoUrl(video: CloudinaryStatementVideo): string {
  assertVideoExcerpt(video);
  return videoDeliveryUrl(video.id, video.version);
}

export async function destroyCloudinaryVideo({
  intentId,
  publicId,
  assetId: storedAssetId,
}: {
  intentId: string;
  publicId: string;
  assetId?: string;
}): Promise<void> {
  if (
    !CLOUDINARY_INTENT_ID_PATTERN.test(intentId) ||
    !isCloudinaryVideoPublicId(publicId)
  ) {
    throw new Error("The Cloudinary deletion identity is invalid.");
  }
  credentials();

  let assetId = normalizeCloudinaryAssetId(storedAssetId);
  if (storedAssetId && !assetId) {
    throw new Error("The tracked Cloudinary asset ID is invalid.");
  }

  if (!assetId) {
    let raw: unknown;
    try {
      raw = await cloudinary.api.resource(publicId, {
        resource_type: "video",
        type: "authenticated",
        context: true,
        timeout: CLOUDINARY_ADMIN_TIMEOUT_MS,
      });
    } catch (error) {
      const failure = objectRecord(error);
      if (Number(failure?.http_code) === 404) return;
      throw new Error("Cloudinary could not resolve the video before deletion.");
    }
    const resource = objectRecord(raw);
    assetId = normalizeCloudinaryAssetId(resource?.asset_id);
    if (
      !assetId ||
      resource?.public_id !== publicId ||
      resource?.resource_type !== "video" ||
      resource?.type !== "authenticated" ||
      contextUploadIntent(resource ?? {}) !== intentId
    ) {
      throw new Error(
        "The current Cloudinary public ID does not belong to this upload intent."
      );
    }
  }

  const result = await cloudinary.api.delete_resources_by_asset_ids(
    [assetId],
    {
      invalidate: true,
      timeout: CLOUDINARY_ADMIN_TIMEOUT_MS,
    }
  );
  const deleted = objectRecord(objectRecord(result)?.deleted);
  const outcome = String(deleted?.[assetId] ?? "")
    .toLowerCase()
    .replaceAll(" ", "_");
  if (outcome !== "deleted" && outcome !== "not_found") {
    throw new Error("Cloudinary did not confirm immutable asset deletion.");
  }
}

export const cloudinaryVideoPolicy = {
  allowedFormats: ["mp4", "mov", "webm"] as const,
  deliveryType: "authenticated" as const,
  eagerTransformation: CLOUDINARY_VIDEO_TRANSFORMATION,
  maxBytes: MAX_HOSTED_VIDEO_BYTES,
  maxDimension: MAX_CLOUDINARY_VIDEO_DIMENSION,
  maxPixels: MAX_CLOUDINARY_VIDEO_PIXELS,
};
