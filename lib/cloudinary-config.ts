import { MAX_HOSTED_VIDEO_BYTES } from "./video";

const PLACEHOLDER_PATTERN =
  /replace[-_ ]?with|placeholder|example|your[-_ ]?(?:cloud|api|secret|preset)|changeme/i;

export interface CloudinaryEnvironment {
  [name: string]: string | undefined;
  CLOUDINARY_CLOUD_NAME?: string;
  CLOUDINARY_API_KEY?: string;
  CLOUDINARY_API_SECRET?: string;
  CLOUDINARY_VIDEO_UPLOAD_PRESET?: string;
}

function configuredValue(
  source: CloudinaryEnvironment,
  name: keyof CloudinaryEnvironment
): string {
  return source[name]?.trim() ?? "";
}

export function cloudinaryCloudNameIsAcceptable(value: string | undefined): boolean {
  const candidate = value?.trim() ?? "";
  return (
    candidate.length >= 2 &&
    candidate.length <= 128 &&
    /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(candidate) &&
    !PLACEHOLDER_PATTERN.test(candidate)
  );
}

export function cloudinaryApiKeyIsAcceptable(value: string | undefined): boolean {
  const candidate = value?.trim() ?? "";
  return (
    candidate.length >= 6 &&
    candidate.length <= 128 &&
    /^[A-Za-z0-9_-]+$/.test(candidate) &&
    !PLACEHOLDER_PATTERN.test(candidate)
  );
}

export function cloudinaryApiSecretIsAcceptable(value: string | undefined): boolean {
  const candidate = value?.trim() ?? "";
  return (
    candidate.length >= 16 &&
    candidate.length <= 256 &&
    !PLACEHOLDER_PATTERN.test(candidate) &&
    !/^(.)\1+$/.test(candidate)
  );
}

export function cloudinaryPresetIsAcceptable(value: string | undefined): boolean {
  const candidate = value?.trim() ?? "";
  return (
    candidate.length >= 2 &&
    candidate.length <= 255 &&
    /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(candidate) &&
    !PLACEHOLDER_PATTERN.test(candidate)
  );
}

export function cloudinaryCredentialIssues(
  source: CloudinaryEnvironment = process.env
): string[] {
  const issues: string[] = [];
  if (!cloudinaryCloudNameIsAcceptable(configuredValue(source, "CLOUDINARY_CLOUD_NAME"))) {
    issues.push("CLOUDINARY_CLOUD_NAME");
  }
  if (!cloudinaryApiKeyIsAcceptable(configuredValue(source, "CLOUDINARY_API_KEY"))) {
    issues.push("CLOUDINARY_API_KEY");
  }
  if (!cloudinaryApiSecretIsAcceptable(configuredValue(source, "CLOUDINARY_API_SECRET"))) {
    issues.push("CLOUDINARY_API_SECRET");
  }
  return issues;
}

export function cloudinaryConfigurationIssues(
  source: CloudinaryEnvironment = process.env
): string[] {
  const issues = cloudinaryCredentialIssues(source);
  if (
    !cloudinaryPresetIsAcceptable(
      configuredValue(source, "CLOUDINARY_VIDEO_UPLOAD_PRESET")
    )
  ) {
    issues.push("CLOUDINARY_VIDEO_UPLOAD_PRESET");
  }
  return issues;
}

function objectRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function normalizedFormats(value: unknown): string[] {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  return values
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .sort();
}

const UNSAFE_PRESET_SETTINGS = [
  "asset_folder",
  "background_removal",
  "categorization",
  "detection",
  "eager",
  "eager_notification_url",
  "filename_override",
  "folder",
  "format",
  "moderation",
  "notification_url",
  "ocr",
  "public_id",
  "public_id_prefix",
  "raw_convert",
  "transformation",
] as const;

/**
 * Validate the server-returned Admin API representation of the dedicated
 * upload preset. Signed request options override most preset values, but
 * incoming and eager transformations are merged by Cloudinary, so the preset
 * must be independently checked before an authorization is issued.
 */
export function cloudinaryUploadPresetIssues(value: unknown): string[] {
  const preset = objectRecord(value);
  const settings = objectRecord(preset?.settings);
  if (!preset || !settings) return ["invalid_response"];

  const issues: string[] = [];
  if (preset.unsigned !== false) issues.push("must_be_signed");

  if (Number(settings.max_file_size) !== MAX_HOSTED_VIDEO_BYTES) {
    issues.push("max_file_size");
  }
  if (
    normalizedFormats(settings.allowed_formats).join(",") !==
    "mov,mp4,webm"
  ) {
    issues.push("allowed_formats");
  }
  if (settings.type !== "authenticated") {
    issues.push("delivery_type");
  }

  for (const name of UNSAFE_PRESET_SETTINGS) {
    if (settings[name] !== undefined && settings[name] !== null && settings[name] !== "") {
      issues.push(name);
    }
  }
  if (preset.live === true || settings.live === true) issues.push("live");
  if (
    preset.disallow_public_id === true ||
    settings.disallow_public_id === true
  ) {
    issues.push("disallow_public_id");
  }
  if (settings.overwrite === true) issues.push("overwrite");
  if (settings.use_filename === true) issues.push("use_filename");
  if (settings.unique_filename === true) issues.push("unique_filename");

  return [...new Set(issues)];
}
