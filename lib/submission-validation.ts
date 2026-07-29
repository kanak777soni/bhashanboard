import { parseMediaSourceUrl } from "./media-source";
import { MIN_VIDEO_EXCERPT_SECONDS } from "./video";

export const SUBMISSION_MAX_EXCERPT_SECONDS = 180;

export type SubmissionPlatform =
  | "youtube"
  | "facebook"
  | "instagram"
  | "other";

export interface PublicSubmissionInput {
  sourceUrl: unknown;
  startTimestamp?: unknown;
  endTimestamp?: unknown;
  speaker: unknown;
  eventContext?: unknown;
  claim: unknown;
  originalLanguage: unknown;
  submitterName?: unknown;
  contactEmail: unknown;
  syntheticDeclaration: unknown;
}

export interface ValidatedPublicSubmission {
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
  syntheticDeclaration: true;
}

export class SubmissionValidationError extends Error {
  readonly status = 400;

  constructor(
    message: string,
    readonly field?: string
  ) {
    super(message);
    this.name = "SubmissionValidationError";
  }
}

function text(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength + 1);
}

function requiredText(
  value: unknown,
  {
    field,
    label,
    minLength,
    maxLength,
  }: {
    field: string;
    label: string;
    minLength: number;
    maxLength: number;
  }
): string {
  const normalized = text(value, maxLength);
  if (normalized.length < minLength) {
    throw new SubmissionValidationError(
      `${label} must contain at least ${minLength} characters.`,
      field
    );
  }
  if (normalized.length > maxLength) {
    throw new SubmissionValidationError(
      `${label} must contain no more than ${maxLength} characters.`,
      field
    );
  }
  return normalized;
}

function domainIs(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function unsafeHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host === "[::1]" ||
    host.startsWith("[") ||
    /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)
  );
}

export function evidencePlatform(url: URL): SubmissionPlatform {
  const hostname = url.hostname.toLowerCase();
  if (
    domainIs(hostname, "youtube.com") ||
    domainIs(hostname, "youtu.be") ||
    domainIs(hostname, "youtube-nocookie.com")
  ) {
    return "youtube";
  }
  if (domainIs(hostname, "facebook.com") || domainIs(hostname, "fb.watch")) {
    return "facebook";
  }
  if (domainIs(hostname, "instagram.com")) return "instagram";
  return "other";
}

export function validateEvidenceUrl(value: unknown): {
  sourceUrl: string;
  sourcePlatform: SubmissionPlatform;
} {
  const candidate = text(value, 2_048);
  if (
    !candidate ||
    candidate.length > 2_048 ||
    /[\u0000-\u001f\u007f\\]/.test(candidate)
  ) {
    throw new SubmissionValidationError(
      "Enter an evidence link no longer than 2,048 characters.",
      "sourceUrl"
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new SubmissionValidationError(
      "Enter a complete evidence link beginning with http:// or https://.",
      "sourceUrl"
    );
  }

  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    !parsed.hostname ||
    parsed.username ||
    parsed.password ||
    parsed.port ||
    unsafeHostname(parsed.hostname)
  ) {
    throw new SubmissionValidationError(
      "Evidence must use a public HTTP(S) link without embedded credentials.",
      "sourceUrl"
    );
  }

  const parsedMedia = parseMediaSourceUrl(candidate);
  if (parsedMedia) {
    return {
      sourceUrl: parsedMedia.canonicalUrl,
      sourcePlatform: parsedMedia.platform,
    };
  }
  if (evidencePlatform(parsed) !== "other") {
    throw new SubmissionValidationError(
      "Enter a direct YouTube video, Facebook video/Reel/share, or Instagram post/Reel link.",
      "sourceUrl"
    );
  }

  return {
    sourceUrl: parsed.toString(),
    sourcePlatform: "other",
  };
}

export function parseSubmissionTimestamp(
  value: unknown,
  field: "startTimestamp" | "endTimestamp"
): number | null {
  const candidate = text(value, 12);
  if (!candidate) return null;
  if (!/^\d{1,3}(?::[0-5]\d){0,2}$/.test(candidate)) {
    throw new SubmissionValidationError(
      "Use seconds, MM:SS, or HH:MM:SS.",
      field
    );
  }

  const parts = candidate.split(":").map(Number);
  const seconds = parts.reduce((total, part) => total * 60 + part, 0);
  if (!Number.isSafeInteger(seconds) || seconds < 0 || seconds > 86_400) {
    throw new SubmissionValidationError(
      "Timestamp is outside the supported range.",
      field
    );
  }
  return seconds;
}

export function validatePublicSubmission(
  value: unknown
): ValidatedPublicSubmission {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new SubmissionValidationError("The submission is not a valid form.");
  }
  const input = value as PublicSubmissionInput;
  const { sourceUrl, sourcePlatform } = validateEvidenceUrl(input.sourceUrl);
  const startSeconds = parseSubmissionTimestamp(
    input.startTimestamp,
    "startTimestamp"
  );
  const endSeconds = parseSubmissionTimestamp(
    input.endTimestamp,
    "endTimestamp"
  );

  if ((startSeconds === null) !== (endSeconds === null)) {
    throw new SubmissionValidationError(
      "Provide both the start and end timestamp, or leave both empty.",
      startSeconds === null ? "startTimestamp" : "endTimestamp"
    );
  }
  if (
    startSeconds !== null &&
    endSeconds !== null &&
    (endSeconds <= startSeconds ||
      endSeconds - startSeconds < MIN_VIDEO_EXCERPT_SECONDS ||
      endSeconds - startSeconds > SUBMISSION_MAX_EXCERPT_SECONDS)
  ) {
    throw new SubmissionValidationError(
      `The excerpt must be between ${MIN_VIDEO_EXCERPT_SECONDS} seconds and ${SUBMISSION_MAX_EXCERPT_SECONDS / 60} minutes.`,
      "endTimestamp"
    );
  }

  const contactEmail = text(input.contactEmail, 254).toLowerCase();
  if (
    contactEmail.length < 3 ||
    contactEmail.length > 254 ||
    /[\r\n\s]/.test(contactEmail) ||
    !/^[^@]+@[^@]+\.[^@]+$/.test(contactEmail)
  ) {
    throw new SubmissionValidationError(
      "Enter a valid email address for the acknowledgement.",
      "contactEmail"
    );
  }

  if (input.syntheticDeclaration !== true) {
    throw new SubmissionValidationError(
      "Confirm that the evidence is not synthetic or deceptively edited.",
      "syntheticDeclaration"
    );
  }

  const eventContext = text(input.eventContext, 500);
  if (eventContext.length > 500) {
    throw new SubmissionValidationError(
      "Event details must contain no more than 500 characters.",
      "eventContext"
    );
  }
  const submitterName = text(input.submitterName, 120);
  if (submitterName.length > 120) {
    throw new SubmissionValidationError(
      "Your name must contain no more than 120 characters.",
      "submitterName"
    );
  }

  return {
    sourceUrl,
    sourcePlatform,
    startSeconds,
    endSeconds,
    speaker: requiredText(input.speaker, {
      field: "speaker",
      label: "Speaker",
      minLength: 2,
      maxLength: 160,
    }),
    eventContext,
    claim: requiredText(input.claim, {
      field: "claim",
      label: "Claim",
      minLength: 10,
      maxLength: 1_200,
    }),
    originalLanguage: requiredText(input.originalLanguage, {
      field: "originalLanguage",
      label: "Original language",
      minLength: 2,
      maxLength: 80,
    }),
    submitterName,
    contactEmail,
    syntheticDeclaration: true,
  };
}
