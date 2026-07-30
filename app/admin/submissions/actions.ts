"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/require-admin";
import {
  acceptPublicSubmissionAsDraft,
  getPublicSubmission,
  rejectPublicSubmission,
} from "@/lib/submission-store";
import {
  getParties,
  getPoliticians,
  type StatementDocument,
} from "@/lib/store";
import { assertVideoExcerpt, parseYouTubeVideo } from "@/lib/video";

const CATEGORIES = [
  "Science & Reason",
  "History",
  "Economics",
  "Whataboutery",
  "Standing Ovation",
] as const;

function value(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function version(formData: FormData): number {
  const raw = value(formData, "version");
  const parsed = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error("Invalid submission version. Reload and try again.");
  }
  return parsed;
}

function sourcePublisher(sourceUrl: string): string {
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./, "");
  } catch {
    return "Reader link";
  }
}

export async function acceptSubmissionToDraft(
  formData: FormData
): Promise<void> {
  const actor = await requireAdmin();
  const id = value(formData, "id");
  const expectedVersion = version(formData);
  const record = await getPublicSubmission(id);
  if (!record) throw new Error("Submission not found.");
  const submission = record.submission;
  if (
    submission.status !== "pending" ||
    submission.version !== expectedVersion
  ) {
    throw new Error(
      "This submission was already reviewed or changed. Reload and try again."
    );
  }

  const speakerId = value(formData, "speaker_id");
  const partyId = value(formData, "party_at_time");
  const category = value(formData, "category");
  const [people, parties] = await Promise.all([
    getPoliticians(),
    getParties(),
  ]);
  if (!people.some((person) => person.id === speakerId)) {
    throw new Error("Select a registered representative.");
  }
  if (!parties.some((party) => party.id === partyId)) {
    throw new Error("Select a registered party.");
  }
  if (!CATEGORIES.includes(category as (typeof CATEGORIES)[number])) {
    throw new Error("Select a valid category.");
  }

  const parsedVideo =
    submission.sourcePlatform === "youtube" &&
    submission.startSeconds !== null &&
    submission.endSeconds !== null
      ? parseYouTubeVideo(submission.sourceUrl)
      : undefined;
  let video:
    | { platform: "youtube"; id: string; start: number; end: number }
    | undefined;
  if (parsedVideo) {
    const candidate = {
      ...parsedVideo,
      start: submission.startSeconds!,
      end: submission.endSeconds!,
    };
    try {
      assertVideoExcerpt(candidate);
      video = candidate;
    } catch {
      // Older queued submissions may predate the current playback bounds.
      // Preserve their source link, but do not attach an invalid voting video.
    }
  }
  const context = [
    submission.eventContext,
    `Submitted speaker description: ${submission.speaker}.`,
  ]
    .filter(Boolean)
    .join("\n\n");
  const needs = [
    "Card: add the exact original quote and an English translation if needed.",
    video
      ? "Clip: check the suggested start and end points."
      : "Clip: add a YouTube excerpt or upload a video.",
    "Optional: add date, venue and background when they help the viewer.",
  ];
  const document: StatementDocument = {
    status: "private_draft",
    speaker_id: speakerId,
    party_at_time: partyId,
    office_at_time: "",
    state: "",
    date: "",
    date_precision: "day",
    venue: "",
    language: submission.originalLanguage,
    category,
    neutral_title: submission.claim.slice(0, 220),
    quote: null,
    quote_note:
      "Created from a reader suggestion; add the original quote before going live.",
    claim: submission.claim,
    context,
    hall_of_fame: false,
    video,
    // The reviewer chooses all four marks. Never make an untouched reader
    // submission silently begin with a class.
    axes: {},
    verification: {
      stage: "text_sourced",
      best_source_tier: "C",
      needs,
      sources: [
        {
          tier: "C",
          publisher: sourcePublisher(submission.sourceUrl),
          title: "Reader-submitted clip suggestion",
          url: submission.sourceUrl,
          role: "footage",
        },
      ],
    },
  };

  const draftId = await acceptPublicSubmissionAsDraft({
    id,
    version: expectedVersion,
    document,
    reviewerId: actor.id,
    actorLabel: actor.label,
  });
  revalidatePath("/admin/submissions");
  revalidatePath("/admin/entries");
  redirect(`/admin/entries/${draftId}?from=submission`);
}

export async function closeSubmission(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  const disposition = value(formData, "disposition");
  if (disposition !== "rejected" && disposition !== "spam") {
    throw new Error("Invalid moderation decision.");
  }
  await rejectPublicSubmission({
    id: value(formData, "id"),
    version: version(formData),
    disposition,
    note: value(formData, "note"),
    reviewerId: actor.id,
    actorLabel: actor.label,
  });
  revalidatePath("/admin/submissions");
  redirect("/admin/submissions?status=pending&notice=reviewed");
}
