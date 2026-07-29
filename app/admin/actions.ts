"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/require-admin";
import { getData } from "@/lib/data";
import {
  createPoliticianRecord,
  createStatementRecord,
  getStatement,
  getStatementVoteCount,
  setStatementHallOfFame,
  setStatementStatus,
  updateStatementRecord,
  type PoliticianDocument,
  type StatementDocument,
  type StatementStatus,
  type StoredStatement,
} from "@/lib/store";
import {
  verifyCloudinaryAttachmentToken,
  verifyExistingCloudinaryVideo,
} from "@/lib/cloudinary";
import { parseMediaSourceUrl } from "@/lib/media-source";
import { isSourceRole, type SourceRole, type StatementVideo } from "@/lib/types";
import {
  assertVideoExcerpt,
  committeePublicationIssues,
  normalizeStatementVideo,
  normalizeVerificationStage,
  parseVideoTimestamp,
  parseYouTubeVideo,
  requireVerificationStage,
} from "@/lib/video";

const STATUSES: readonly StatementStatus[] = [
  "published",
  "held_parity",
  "held_review",
  "private_draft",
  "withdrawn",
];
const SOURCE_TIERS = ["A", "B", "C"] as const;
type SourceTier = (typeof SOURCE_TIERS)[number];
const STATEMENT_WORKFLOW_ACTIONS = [
  "save_draft",
  "publish",
  "restore_live",
] as const;
type StatementWorkflowAction = (typeof STATEMENT_WORKFLOW_ACTIONS)[number];

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

function num(fd: FormData, key: string): number {
  const value = Number(fd.get(key));
  return Number.isFinite(value) ? value : 0;
}

function refresh() {
  revalidatePath("/", "layout");
}

function statementStatus(fd: FormData, fallback?: StatementStatus): StatementStatus {
  const value = str(fd, "status") || fallback;
  if (!value || !STATUSES.includes(value as StatementStatus)) {
    throw new Error(`Invalid statement status "${String(value ?? "")}".`);
  }
  return value as StatementStatus;
}

function statementWorkflowAction(fd: FormData): StatementWorkflowAction {
  const submittedValues = fd
    .getAll("workflow_action")
    .map((value) => String(value).trim())
    .filter(Boolean);
  // The form also carries a final save-draft fallback. Prefer an explicit
  // publish/restore submitter regardless of where the browser or React places
  // that submitter in FormData.
  const value =
    submittedValues.find((item) => item !== "save_draft") ??
    submittedValues[0] ??
    "";
  // Pressing Enter in a form field can submit without a submitter button, so
  // no button name/value reaches FormData. Fail closed to a draft save: an
  // implicit submission must never publish or restore an entry.
  if (!value) return "save_draft";
  if (
    !STATEMENT_WORKFLOW_ACTIONS.includes(value as StatementWorkflowAction)
  ) {
    throw new Error("Choose Save draft, Go live, or Put back live.");
  }
  return value as StatementWorkflowAction;
}

function formVersion(fd: FormData): number {
  const raw = str(fd, "version");
  const version = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(version) || version < 1) {
    throw new Error("This edit has no valid version. Reload the entry and try again.");
  }
  return version;
}

async function collectVideo(
  fd: FormData,
  fallback: StoredStatement | undefined,
  actorId: string
): Promise<{
  video?: StatementVideo;
  cloudinaryUploadIntentId?: string;
}> {
  const platform = str(fd, "video_platform");
  const input = str(fd, "video");
  const startInput = str(fd, "video_start");
  const endInput = str(fd, "video_end");
  if (platform === "none") return {};

  if (platform === "cloudinary") {
    if (!input) {
      throw new Error(
        "Upload and verify a video before saving the Cloudinary asset."
      );
    }
    const attachmentToken = str(fd, "video_attachment_token");
    if (attachmentToken) {
      const verified = await verifyCloudinaryAttachmentToken({
        actorId,
        attachmentToken,
      });
      if (verified.video.id !== input) {
        throw new Error("The uploaded video does not match this form. Upload it again.");
      }
      return {
        video: verified.video,
        cloudinaryUploadIntentId: verified.intentId,
      };
    }

    const existing = normalizeStatementVideo(fallback?.video);
    if (existing?.platform === "cloudinary" && existing.id === input) {
      return { video: await verifyExistingCloudinaryVideo(existing) };
    }
    throw new Error(
      "The Cloudinary video authorization expired. Upload the file again."
    );
  }

  if (platform && platform !== "youtube") {
    throw new Error(`Invalid video platform "${platform}".`);
  }
  if (!input && !startInput && !endInput) return {};
  if (!input) throw new Error("A YouTube video is required when timestamps are supplied.");

  const parsed = parseYouTubeVideo(input);
  if (!parsed) throw new Error("Enter a valid YouTube URL or video ID.");
  const start = parseVideoTimestamp(startInput);
  const end = parseVideoTimestamp(endInput);
  if (start === undefined || end === undefined) {
    throw new Error("A video requires valid start and end timestamps.");
  }

  const video: StatementVideo = { ...parsed, start, end };
  assertVideoExcerpt(video);
  return { video };
}

function collectAxes(fd: FormData): Record<string, number> {
  const axes = {
    logic_damage: num(fd, "logic_damage"),
    straight_face: num(fd, "straight_face"),
    rewatch_value: num(fd, "rewatch_value"),
    crowd_complicity: num(fd, "crowd_complicity"),
    consequence: num(fd, "consequence"),
  };
  for (const [axis, value] of Object.entries(axes)) {
    if (!Number.isInteger(value) || value < 0 || value > 5) {
      throw new Error(`Axis ${axis} must be an integer from 0 to 5.`);
    }
  }
  return axes;
}

function sourceTier(value: string, label: string): SourceTier {
  const tier = value || "C";
  if (!SOURCE_TIERS.includes(tier as SourceTier)) {
    throw new Error(`${label} has an invalid source tier.`);
  }
  return tier as SourceTier;
}

function sourceUrl(value: string, index: number): string {
  if (value.length > 2_048) {
    throw new Error(`Source ${index + 1} URL is too long.`);
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`Source ${index + 1} must use a valid http(s) URL.`);
  }
  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    !parsed.hostname ||
    parsed.username ||
    parsed.password
  ) {
    throw new Error(
      `Source ${index + 1} must use a public http(s) URL without embedded credentials.`
    );
  }
  return value;
}

function collectSources(
  fd: FormData,
  fallback: StoredStatement["verification"]["sources"] | undefined
) {
  const hasSourceFields = Array.from({ length: 4 }, (_, index) => index).some(
    (index) =>
      fd.has(`src_publisher_${index}`) ||
      fd.has(`src_title_${index}`) ||
      fd.has(`src_url_${index}`) ||
      fd.has(`src_tier_${index}`) ||
      fd.has(`src_role_${index}`)
  );
  if (!hasSourceFields) {
    return (fallback ?? []).map((source) => ({
      tier: sourceTier(String(source.tier ?? "C"), "Saved source"),
      publisher: String(source.publisher ?? ""),
      title: String(source.title ?? ""),
      url: String(source.url ?? ""),
      role: isSourceRole(source.role) ? source.role : "reporting",
    }));
  }

  const sources: {
    tier: SourceTier;
    publisher: string;
    title: string;
    url: string;
    role: SourceRole;
  }[] = [];
  for (let index = 0; index < 4; index++) {
    const publisher = str(fd, `src_publisher_${index}`);
    const title = str(fd, `src_title_${index}`);
    const url = str(fd, `src_url_${index}`);
    if (!publisher && !title && !url) continue;
    if (!publisher) throw new Error(`Source ${index + 1} requires a publisher.`);
    if (!url) throw new Error(`Source ${index + 1} requires a URL.`);
    const roleValue = str(fd, `src_role_${index}`) || "reporting";
    if (!isSourceRole(roleValue)) {
      throw new Error(`Source ${index + 1} has an invalid evidence role.`);
    }
    const validatedUrl = sourceUrl(url, index);
    const recognizedMedia = parseMediaSourceUrl(validatedUrl);
    sources.push({
      tier: sourceTier(str(fd, `src_tier_${index}`), `Source ${index + 1}`),
      publisher,
      title,
      url: recognizedMedia?.canonicalUrl ?? validatedUrl,
      role: roleValue,
    });
  }
  return sources;
}

function assertQuoteIntegrity({
  language,
  quote,
  quoteTranslation,
}: {
  language: string;
  quote: string | null;
  quoteTranslation?: string;
}) {
  const isEnglish = language.trim().toLowerCase() === "english";
  if (quote && !isEnglish && !quoteTranslation?.trim()) {
    throw new Error("A non-English verbatim quote requires a faithful English translation.");
  }
  if (quoteTranslation?.trim() && (!quote || isEnglish)) {
    throw new Error("English translations are only valid alongside a non-English verbatim quote.");
  }
}

function collectQuoteFields(fd: FormData) {
  const language = str(fd, "language") || "Hindi";
  const quote = str(fd, "quote");
  const quoteNote = str(fd, "quote_note");
  const suppliedTranslation = str(fd, "quote_translation");

  assertQuoteIntegrity({
    language,
    quote: quote || null,
    quoteTranslation: suppliedTranslation || undefined,
  });

  return {
    language,
    quote: quote || null,
    quoteTranslation:
      quote && language.toLowerCase() !== "english"
        ? suppliedTranslation || undefined
        : undefined,
    quoteNote: quoteNote || undefined,
  };
}

function collectVerification(
  fd: FormData,
  fallback: StoredStatement["verification"] | undefined,
  video: StatementVideo | undefined
): StoredStatement["verification"] {
  const needs = fd.has("needs")
    ? str(fd, "needs")
      ? str(fd, "needs")
          .split("\n")
          .map((need) => need.trim())
          .filter(Boolean)
      : []
    : [...(fallback?.needs ?? [])];
  const requestedStage = requireVerificationStage(
    str(fd, "stage") || fallback?.stage || "text_sourced"
  );
  const stage = video ? requestedStage : "text_sourced";
  const bestSourceTier = sourceTier(
    str(fd, "best_source_tier") || fallback?.best_source_tier || "C",
    "Best source"
  );
  return {
    stage,
    best_source_tier: bestSourceTier,
    needs,
    sources: collectSources(fd, fallback?.sources),
  };
}

async function statementDocument(
  fd: FormData,
  quoteFields: ReturnType<typeof collectQuoteFields>,
  status: StatementStatus,
  actorId: string,
  fallback?: StoredStatement
): Promise<{
  document: StatementDocument;
  cloudinaryUploadIntentId?: string;
}> {
  const collectedVideo = await collectVideo(fd, fallback, actorId);
  const video = collectedVideo.video;
  const document: StatementDocument = {
    status,
    speaker_id: str(fd, "speaker_id") || fallback?.speaker_id || "",
    party_at_time: str(fd, "party_at_time") || fallback?.party_at_time || "",
    office_at_time: str(fd, "office_at_time"),
    state: str(fd, "state"),
    date: str(fd, "date"),
    date_precision: str(fd, "date_precision") || "day",
    venue: str(fd, "venue"),
    language: quoteFields.language,
    category: str(fd, "category"),
    neutral_title: str(fd, "neutral_title"),
    quote: quoteFields.quote,
    quote_translation: quoteFields.quoteTranslation,
    quote_note: quoteFields.quoteNote,
    claim: str(fd, "claim"),
    context: str(fd, "context") || undefined,
    counterpoint: str(fd, "counterpoint") || undefined,
    policy_note: fallback?.policy_note,
    hall_of_fame: status === "published" ? !!fallback?.hall_of_fame : false,
    video,
    axes: collectAxes(fd),
    verification: collectVerification(fd, fallback?.verification, video),
  };
  const publicationIssues = committeePublicationIssues({
    ...document,
    status: "published",
  });
  if (document.status === "published" && publicationIssues.length > 0) {
    throw new Error(
      `This entry cannot go live: ${publicationIssues.join(" ")}`
    );
  }
  if (
    document.status === "published" &&
    document.video?.platform === "youtube" &&
    str(fd, "youtube_preview_ready") !== "true"
  ) {
    throw new Error(
      "Wait for the automatic YouTube player and timestamp check before going live."
    );
  }
  if (document.hall_of_fame) {
    if (document.status !== "published" || publicationIssues.length > 0) {
      throw new Error(
        "Only a live clip can be added to the Hall of Fame."
      );
    }
  }
  return {
    document,
    cloudinaryUploadIntentId: collectedVideo.cloudinaryUploadIntentId,
  };
}

// ── statements ──────────────────────────────────────────────────────

export async function createStatement(fd: FormData) {
  const actor = await requireAdmin();
  const workflowAction = statementWorkflowAction(fd);
  if (workflowAction === "restore_live") {
    throw new Error("A new entry cannot be restored.");
  }
  const quoteFields = collectQuoteFields(fd);
  const status: StatementStatus =
    workflowAction === "publish" ? "published" : "held_review";
  const collected = await statementDocument(fd, quoteFields, status, actor.id);
  const entry = collected.document;

  const created = await createStatementRecord(entry, {
    actor: actor.label,
    action: "create",
    detail: `Added "${entry.neutral_title}" — ${entry.party_at_time}, status ${entry.status}${
      entry.quote ? "" : ", no verbatim quote established"
    }.`,
  }, collected.cloudinaryUploadIntentId
    ? { actorId: actor.id, uploadIntentId: collected.cloudinaryUploadIntentId }
    : undefined);

  refresh();
  redirect(`/admin/entries/${created.id}`);
}

export async function updateStatement(fd: FormData) {
  const actor = await requireAdmin();
  const id = str(fd, "id");
  const expectedVersion = formVersion(fd);
  const before = await getStatement(id);
  if (!before) throw new Error(`Statement ${id} no longer exists.`);
  if (before.version !== expectedVersion) {
    throw new Error(`Statement ${id} was changed by another admin. Reload and try again.`);
  }

  const workflowAction = statementWorkflowAction(fd);
  if (workflowAction === "restore_live") {
    if (!before.status.startsWith("held")) {
      throw new Error("Only an unchanged offline clip can be put back live.");
    }
    const voteCount = await getStatementVoteCount(id);
    if (voteCount < 1) {
      throw new Error("Use Go live for a clip that has no votes yet.");
    }
    const publicationIssues = committeePublicationIssues({
      ...before,
      status: "published",
    });
    if (publicationIssues.length > 0) {
      throw new Error(
        `This clip cannot be put back live: ${publicationIssues.join(" ")}`
      );
    }
    const existingVideo = normalizeStatementVideo(before.video);
    if (
      existingVideo?.platform === "youtube" &&
      str(fd, "youtube_preview_ready") !== "true"
    ) {
      throw new Error(
        "Wait for the automatic YouTube player and timestamp check before putting this clip back live."
      );
    }
    if (existingVideo?.platform === "cloudinary") {
      await verifyExistingCloudinaryVideo(existingVideo);
    }
    await setStatementStatus(id, "published", expectedVersion, {
      actor: actor.label,
      action: "status",
      detail: `"${before.neutral_title}" — put the unchanged voted clip back live.`,
    });
    refresh();
    return;
  }

  const quoteFields = collectQuoteFields(fd);
  const status: StatementStatus =
    workflowAction === "publish"
      ? "published"
      : before.status === "published"
        ? "held_review"
        : before.status;
  const collected = await statementDocument(fd, quoteFields, status, actor.id, before);
  const entry = collected.document;
  const axes = entry.axes;

  const axesChanged = Object.keys(axes).filter((key) => axes[key] !== before.axes[key]);
  const notes: string[] = [];
  if (status !== before.status) notes.push(`status ${before.status} → ${status}`);
  if (axesChanged.length) {
    notes.push(
      "axes " +
        axesChanged.map((key) => `${key} ${before.axes[key]}→${axes[key]}`).join(", ") +
        " — rating recomputed"
    );
  }
  if (!!before.hall_of_fame !== !!entry.hall_of_fame) {
    notes.push(entry.hall_of_fame ? "inducted into the Hall of Fame" : "removed from the Hall of Fame");
  }
  const beforeVideo = normalizeStatementVideo(before.video);
  if (JSON.stringify(beforeVideo) !== JSON.stringify(entry.video)) {
    notes.push(
      entry.video
        ? `video changed to ${
            entry.video.platform === "cloudinary"
              ? "hosted Cloudinary MP4"
              : "YouTube"
          }`
        : "video removed"
    );
  }

  await updateStatementRecord(id, entry, expectedVersion, {
    actor: actor.label,
    action: "update",
    detail: notes.length ? `${notes.join("; ")}.` : `Edited "${entry.neutral_title}".`,
  }, collected.cloudinaryUploadIntentId
    ? { actorId: actor.id, uploadIntentId: collected.cloudinaryUploadIntentId }
    : undefined);
  refresh();
}

export async function setStatus(fd: FormData) {
  const actor = await requireAdmin();
  const id = str(fd, "id");
  const status = statementStatus(fd);
  const before = await getStatement(id);
  if (!before) throw new Error(`Statement ${id} no longer exists.`);
  if (status === before.status) return;

  if (status === "published") {
    throw new Error(
      "Open the entry and use Go live or Put back live after the automatic clip preview is ready."
    );
  }
  await setStatementStatus(id, status, before.version, {
    actor: actor.label,
    action: status === "withdrawn" ? "withdraw" : "status",
    detail: `"${before.neutral_title}" — status ${before.status} → ${status}.`,
  });
  refresh();
}

export async function toggleHallOfFame(fd: FormData) {
  const actor = await requireAdmin();
  const id = str(fd, "id");
  const before = await getStatement(id);
  if (!before) throw new Error(`Statement ${id} no longer exists.`);

  const requested = str(fd, "value");
  if (requested && requested !== "true" && requested !== "false") {
    throw new Error("Invalid Hall of Fame value.");
  }
  const desired = requested ? requested === "true" : !before.hall_of_fame;
  const publicationIssues = desired
    ? committeePublicationIssues({ ...before, status: "published" })
    : [];
  if (desired && (before.status !== "published" || publicationIssues.length > 0)) {
    throw new Error(
      `Only a live clip can enter the Hall of Fame.${
        publicationIssues.length > 0 ? ` ${publicationIssues.join(" ")}` : ""
      }`
    );
  }
  if (desired) {
    const publicData = await getData();
    const publicStatement = publicData.CORPUS.find(
      (statement) => statement.corpusId === before.id
    );
    if (
      !publicStatement ||
      publicData.publicRankOf(publicStatement.slug) <= 0
    ) {
      throw new Error(
        "A clip must be live and have at least ten user votes before it can enter the Hall of Fame."
      );
    }
    const storedVideo = normalizeStatementVideo(before.video);
    if (storedVideo?.platform === "cloudinary") {
      await verifyExistingCloudinaryVideo(storedVideo);
    }
  }
  if (desired === !!before.hall_of_fame) return;

  await setStatementHallOfFame(id, desired, before.version, {
    actor: actor.label,
    action: "hall-of-fame",
    detail: `"${before.neutral_title}" ${
      desired ? "inducted into" : "removed from"
    } the Hall of Fame.`,
  });
  refresh();
}

// ── politicians ─────────────────────────────────────────────────────

export async function createPolitician(fd: FormData) {
  const actor = await requireAdmin();
  const name = str(fd, "name");
  const id =
    str(fd, "id") ||
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  if (!id || !name) throw new Error("Representative name and identifier are required.");

  const politician: PoliticianDocument = {
    name,
    party: str(fd, "party"),
    state: str(fd, "state"),
    notes: str(fd, "notes") || undefined,
  };
  await createPoliticianRecord(id, politician, {
    actor: actor.label,
    action: "create",
    detail: `Added representative ${name} (${politician.party}).`,
  });
  refresh();
}
