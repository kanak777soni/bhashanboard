import type {
  CloudinaryStatementVideo,
  StatementVideo,
  VerificationStage,
  YouTubeStatementVideo,
} from "./types";

export const MAX_VIDEO_TIMESTAMP_SECONDS = 24 * 60 * 60;
export const MIN_VIDEO_EXCERPT_SECONDS = 3;
export const MAX_VIDEO_EXCERPT_SECONDS = 3 * 60;
export const MAX_HOSTED_VIDEO_BYTES = 50 * 1024 * 1024;
export const MAX_CLOUDINARY_DERIVED_VIDEO_BYTES = 100 * 1024 * 1024;

const CLOUDINARY_VIDEO_ID_PATTERN =
  /^bhashanboard\/statement-videos\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const CLOUDINARY_ASSET_ID_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

const LEGACY_VERIFICATION_STAGES: Record<string, VerificationStage> = {
  lead: "text_sourced",
  clip_attached: "av_verified",
  verified: "committee_passed",
};

const VERIFICATION_STAGE_SET = new Set<VerificationStage>([
  "text_sourced",
  "av_verified",
  "committee_passed",
]);

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function wholeSecond(value: unknown): number | undefined {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d+$/.test(value)
        ? Number(value)
        : Number.NaN;
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function nonBlank(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isHttpUrl(value: unknown): boolean {
  if (!nonBlank(value)) return false;
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.hostname.length > 0
    );
  } catch {
    return false;
  }
}

export function verificationStageOf(value: unknown): VerificationStage | undefined {
  if (typeof value !== "string") return undefined;
  if (VERIFICATION_STAGE_SET.has(value as VerificationStage)) {
    return value as VerificationStage;
  }
  return LEGACY_VERIFICATION_STAGES[value];
}

/** Unknown persisted values fail safely to the least-verified public state. */
export function normalizeVerificationStage(value: unknown): VerificationStage {
  return verificationStageOf(value) ?? "text_sourced";
}

/** Parse a form value while rejecting typos or values forged by a client. */
export function requireVerificationStage(value: unknown): VerificationStage {
  const stage = verificationStageOf(value);
  if (!stage) throw new Error(`Invalid verification stage "${String(value)}".`);
  return stage;
}

/** Parse seconds or a strict MM:SS / HH:MM:SS timestamp. */
export function parseVideoTimestamp(value: string): number | undefined {
  const input = value.trim();
  if (!input) return undefined;
  if (/^\d+$/.test(input)) {
    const seconds = Number(input);
    return Number.isSafeInteger(seconds) ? seconds : undefined;
  }

  const parts = input.split(":");
  if (parts.length < 2 || parts.length > 3 || parts.some((part) => !/^\d{1,2}$/.test(part))) {
    return undefined;
  }
  const numbers = parts.map(Number);
  if (numbers.slice(1).some((part) => part > 59)) return undefined;
  return numbers.reduce((total, part) => total * 60 + part, 0);
}

/** Parse a YouTube watch, short, embed or youtu.be URL, or a bare video id. */
export function parseYouTubeVideo(
  input: string
): Pick<YouTubeStatementVideo, "platform" | "id"> | undefined {
  const value = input.trim();
  if (!value) return undefined;

  if (/^[A-Za-z0-9_-]{6,20}$/.test(value)) {
    return { platform: "youtube", id: value };
  }

  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    let id: string | undefined;
    if (host === "youtu.be") {
      id = url.pathname.split("/").filter(Boolean)[0];
    } else if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "youtube-nocookie.com"
    ) {
      if (url.pathname === "/watch") id = url.searchParams.get("v") ?? undefined;
      else id = /^\/(?:embed|shorts|live)\/([^/?#]+)/.exec(url.pathname)?.[1];
    }
    return id && /^[A-Za-z0-9_-]{6,20}$/.test(id)
      ? { platform: "youtube", id }
      : undefined;
  } catch {
    return undefined;
  }
}

export function isCloudinaryVideoPublicId(value: unknown): value is string {
  return typeof value === "string" && CLOUDINARY_VIDEO_ID_PATTERN.test(value);
}

export function normalizeCloudinaryAssetId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return CLOUDINARY_ASSET_ID_PATTERN.test(normalized) ? normalized : undefined;
}

export function assertVideoExcerpt(video: StatementVideo): void {
  if (video.platform === "youtube") {
    if (!/^[A-Za-z0-9_-]{6,20}$/.test(video.id)) {
      throw new Error("The YouTube video ID is invalid.");
    }
  } else if (video.platform === "cloudinary") {
    if (!isCloudinaryVideoPublicId(video.id)) {
      throw new Error("The Cloudinary video public ID is invalid.");
    }
    const normalizedAssetId = normalizeCloudinaryAssetId(video.assetId);
    if (!normalizedAssetId || video.assetId !== normalizedAssetId) {
      throw new Error("The Cloudinary asset ID is invalid.");
    }
    if (!Number.isSafeInteger(video.version) || video.version <= 0) {
      throw new Error("The Cloudinary video version is invalid.");
    }
    if (
      !Number.isSafeInteger(video.bytes) ||
      video.bytes <= 0 ||
      video.bytes > MAX_HOSTED_VIDEO_BYTES
    ) {
      throw new Error("The hosted video must be no larger than 50 MiB.");
    }
    if (
      !Number.isSafeInteger(video.derivedBytes) ||
      video.derivedBytes <= 0 ||
      video.derivedBytes > MAX_CLOUDINARY_DERIVED_VIDEO_BYTES
    ) {
      throw new Error("The processed Cloudinary video size is invalid.");
    }
    if (video.format !== "mp4") {
      throw new Error("The Cloudinary delivery format must be MP4.");
    }
    if (
      !Number.isSafeInteger(video.durationMs) ||
      video.durationMs < MIN_VIDEO_EXCERPT_SECONDS * 1000 ||
      video.durationMs > MAX_VIDEO_EXCERPT_SECONDS * 1000
    ) {
      throw new Error("The hosted video duration must be between three seconds and three minutes.");
    }
    if (video.start !== 0) {
      throw new Error("An uploaded Cloudinary excerpt must begin at zero seconds.");
    }
    if (video.end !== Math.ceil(video.durationMs / 1000)) {
      throw new Error("The hosted video end must match its verified duration.");
    }
  } else {
    throw new Error("The video platform is not supported.");
  }
  if (!Number.isSafeInteger(video.start) || video.start < 0) {
    throw new Error("The video start must be a non-negative whole second.");
  }
  if (!Number.isSafeInteger(video.end) || video.end <= video.start) {
    throw new Error("The video end must be a whole second after the start.");
  }
  if (video.end - video.start < MIN_VIDEO_EXCERPT_SECONDS) {
    throw new Error("The voting excerpt must be at least three seconds long.");
  }
  if (video.end > MAX_VIDEO_TIMESTAMP_SECONDS) {
    throw new Error("The video timestamp cannot exceed 24 hours.");
  }
  if (video.end - video.start > MAX_VIDEO_EXCERPT_SECONDS) {
    throw new Error("The voting excerpt cannot be longer than three minutes.");
  }
}

/**
 * Convert canonical root video data or the former verification.embed shape.
 * Invalid or incomplete persisted clips remain non-votable instead of taking
 * down the public page.
 */
export function normalizeStatementVideo(value: unknown): StatementVideo | undefined {
  const source = record(value);
  if (!source) return undefined;
  const id = typeof source.id === "string" ? source.id.trim() : "";
  const platform = source.platform === undefined ? "youtube" : source.platform;
  const start = wholeSecond(source.start ?? source.start_s);
  const end = wholeSecond(source.end ?? source.end_s);
  if (!id || start === undefined || end === undefined) return undefined;

  let video: StatementVideo;
  if (platform === "youtube") {
    video = { platform, id, start, end };
  } else if (platform === "cloudinary") {
    const assetId = normalizeCloudinaryAssetId(source.assetId);
    const version = wholeSecond(source.version);
    const bytes = wholeSecond(source.bytes);
    const derivedBytes = wholeSecond(source.derivedBytes);
    const durationMs = wholeSecond(source.durationMs);
    if (
      !assetId ||
      version === undefined ||
      bytes === undefined ||
      derivedBytes === undefined ||
      durationMs === undefined ||
      source.format !== "mp4" ||
      start !== 0
    ) {
      return undefined;
    }
    video = {
      platform,
      id,
      assetId,
      version,
      bytes,
      derivedBytes,
      format: "mp4",
      durationMs,
      start,
      end,
    } satisfies CloudinaryStatementVideo;
  } else {
    return undefined;
  }
  try {
    assertVideoExcerpt(video);
    return video;
  } catch {
    return undefined;
  }
}

/**
 * Resolve the single video that may support publication and voting.
 *
 * Hosted media is canonical only in the root `video` field because that
 * location is governed by the upload-intent attachment invariant. The former
 * `verification.embed` field remains a compatibility fallback for YouTube
 * only; accepting hosted media there would bypass attachment and retention
 * tracking.
 */
export function normalizeStatementEvidenceVideo(
  rawDocument: unknown
): StatementVideo | undefined {
  const document = record(rawDocument);
  if (!document) return undefined;

  const rootVideo = normalizeStatementVideo(document.video);
  if (rootVideo) return rootVideo;

  const verification = record(document.verification);
  const legacyEmbed = normalizeStatementVideo(verification?.embed);
  return legacyEmbed?.platform === "youtube" ? legacyEmbed : undefined;
}

/**
 * One fail-closed publication rule shared by admin writes, corpus projection,
 * UI eligibility and the server-side vote gate.
 */
export function committeePublicationIssues(rawDocument: unknown): string[] {
  const document = record(rawDocument);
  if (!document) return ["The statement document is invalid."];

  const issues: string[] = [];
  const verification = record(document.verification);
  if (document.status !== "published") {
    issues.push("The statement must be published.");
  }
  if (normalizeVerificationStage(verification?.stage) !== "committee_passed") {
    issues.push("The statement must be committee-passed.");
  }
  const outstandingNeeds = Array.isArray(verification?.needs)
    ? verification.needs.filter(nonBlank)
    : [];
  if (outstandingNeeds.length > 0) {
    issues.push("All outstanding verification needs must be resolved.");
  }
  if (!nonBlank(document.date)) {
    issues.push("A confirmed statement date is required.");
  }
  if (!nonBlank(document.venue)) {
    issues.push("A confirmed statement venue is required.");
  }
  if (!nonBlank(document.quote)) {
    issues.push("An original-language verbatim quote is required.");
  }

  const language = nonBlank(document.language) ? document.language.trim() : "";
  if (!language) {
    issues.push("The original language is required.");
  } else if (
    language.toLowerCase() !== "english" &&
    !nonBlank(document.quote_translation)
  ) {
    issues.push("A faithful English translation is required for a non-English quote.");
  }

  if (!nonBlank(document.context)) {
    issues.push("Surrounding context is required.");
  }

  const bestSourceTier = verification?.best_source_tier;
  if (bestSourceTier !== "A" && bestSourceTier !== "B") {
    issues.push("The best source tier must be A or B.");
  }
  const sources = Array.isArray(verification?.sources)
    ? verification.sources
    : [];
  const hasMatchingSource = sources.some((value) => {
    const source = record(value);
    if (!source) return false;
    return (
      source.tier === bestSourceTier &&
      (source.tier === "A" || source.tier === "B") &&
      isHttpUrl(source.url)
    );
  });
  if (!hasMatchingSource) {
    issues.push("A matching Tier A/B HTTP(S) source is required.");
  }

  const video = normalizeStatementEvidenceVideo(document);
  if (!video) {
    issues.push("A valid bounded source-video excerpt is required.");
  }

  return issues;
}

export function isCommitteePublicationEligible(rawDocument: unknown): boolean {
  return committeePublicationIssues(rawDocument).length === 0;
}
