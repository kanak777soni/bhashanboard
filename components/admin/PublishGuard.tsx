"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  assertVideoExcerpt,
  parseVideoTimestamp,
  parseYouTubeVideo,
} from "@/lib/video";

interface ChecklistItem {
  key: string;
  label: string;
  detail: string;
  complete: boolean;
}

function value(form: HTMLFormElement, name: string): string {
  const field = form.elements.namedItem(name);
  if (field instanceof RadioNodeList) {
    return String(field.value).trim();
  }
  if (
    field instanceof HTMLInputElement ||
    field instanceof HTMLTextAreaElement ||
    field instanceof HTMLSelectElement
  ) {
    return field.value.trim();
  }
  return "";
}

function hasBoundedYouTubeExcerpt(form: HTMLFormElement): boolean {
  const parsed = parseYouTubeVideo(value(form, "video"));
  const start = parseVideoTimestamp(value(form, "video_start"));
  const end = parseVideoTimestamp(value(form, "video_end"));
  if (!parsed || start === undefined || end === undefined) return false;
  try {
    assertVideoExcerpt({ ...parsed, start, end });
    return true;
  } catch {
    return false;
  }
}

function readChecklist(form: HTMLFormElement): ChecklistItem[] {
  const language = value(form, "language");
  const quote = value(form, "quote");
  const translation = value(form, "quote_translation");
  const platform = value(form, "video_platform");

  const youtubeExcerpt =
    platform === "youtube" && hasBoundedYouTubeExcerpt(form);
  const youtubePlayerReady =
    youtubeExcerpt && value(form, "youtube_preview_ready") === "true";
  const cloudinaryExcerpt =
    platform === "cloudinary" &&
    Boolean(value(form, "video")) &&
    value(form, "video_admin_ready") === "true";
  const validVideo = youtubePlayerReady || cloudinaryExcerpt;
  const provenanceReady =
    youtubeExcerpt ||
    (cloudinaryExcerpt && value(form, "video_rights_attested") === "true");

  return [
    {
      key: "speaker",
      label: "Speaker and party",
      detail: "Choose who appears in the clip and their party at the time.",
      complete:
        Boolean(value(form, "speaker_id")) &&
        Boolean(value(form, "party_at_time")),
    },
    {
      key: "card",
      label: "Title and original quote",
      detail: "Give the moment a short title and write the words as spoken.",
      complete: Boolean(value(form, "neutral_title")) && Boolean(quote),
    },
    {
      key: "language",
      label: "Language",
      detail:
        language.toLowerCase() === "english"
          ? "The original quote is already in English."
          : "Add an English translation for a non-English quote.",
      complete:
        Boolean(language) &&
        (language.toLowerCase() === "english" || Boolean(translation)),
    },
    {
      key: "category",
      label: "Category",
      detail: "Choose where this moment belongs in the standings.",
      complete: Boolean(value(form, "category")),
    },
    {
      key: "video",
      label: "Clip ready",
      detail:
        platform === "cloudinary"
          ? "Finish the upload and provider processing."
          : youtubeExcerpt
            ? "Wait for the automatic player and timestamp check."
            : "Use a valid YouTube link with start and end points.",
      complete: validVideo,
    },
    {
      key: "provenance",
      label: "Source covered",
      detail:
        platform === "cloudinary"
          ? "Rights confirmation is stored with the signed upload."
          : "The pasted YouTube URL identifies the source.",
      complete: provenanceReady,
    },
  ];
}

/**
 * Mirrors the small publishing contract in the form. The server remains
 * authoritative, while this client-side view makes the remaining essentials
 * obvious and keeps the explicit Go live action deliberate.
 */
export default function PublishGuard({
  workflowAction,
  submitLabel,
  submitAction,
}: {
  workflowAction?: "publish" | "restore_live";
  submitLabel?: string;
  submitAction?: (formData: FormData) => void | Promise<void>;
}) {
  const guardRef = useRef<HTMLDivElement | null>(null);
  const [items, setItems] = useState<ChecklistItem[]>([]);

  const recompute = useCallback(() => {
    const form = guardRef.current?.closest("form");
    if (!form) return;
    const nextItems = readChecklist(form);
    setItems(nextItems);
  }, []);

  useEffect(() => {
    const form = guardRef.current?.closest("form");
    if (!form) return;
    recompute();
    form.addEventListener("input", recompute);
    form.addEventListener("change", recompute);
    form.addEventListener("admin-video-change", recompute);
    return () => {
      form.removeEventListener("input", recompute);
      form.removeEventListener("change", recompute);
      form.removeEventListener("admin-video-change", recompute);
    };
  }, [recompute]);

  const completeCount = items.filter((item) => item.complete).length;
  const ready = items.length > 0 && completeCount === items.length;

  return (
    <div
      className={`guard publication-checklist${ready ? " clear" : ""}`}
      ref={guardRef}
      aria-live="polite"
    >
      <div className="publication-checklist-head">
        <div>
          <span className="lbl">
            {ready ? "Ready to go live" : "Before it goes live"}
          </span>
          <p>
            {items.length === 0
              ? "Reading the card..."
              : ready
                ? "Everything essential is in place. Go live when you are happy with the preview."
                : `${completeCount} of ${items.length} essentials are ready.`}
          </p>
        </div>
        {items.length > 0 && (
          <strong className="num">
            {completeCount}/{items.length}
          </strong>
        )}
      </div>

      {items.length > 0 && (
        <ul>
          {items.map((item) => (
            <li key={item.key} className={item.complete ? "complete" : "block"}>
              <span className="guard-pip">
                {item.complete ? "READY" : "ADD"}
              </span>
              <span>
                <strong>{item.label}</strong>
                <small>{item.detail}</small>
              </span>
            </li>
          ))}
        </ul>
      )}

      {workflowAction && submitAction && (
        <div className="publication-checklist-action">
          <button
            className="btn seal"
            type="submit"
            formAction={submitAction}
            name="workflow_action"
            value={workflowAction}
            data-publish-submit
            disabled={!ready}
            aria-disabled={!ready}
            title={
              ready
                ? "Put this clip live"
                : "Add the remaining essentials first"
            }
          >
            {submitLabel ??
              (workflowAction === "restore_live"
                ? "Put unchanged clip back live"
                : "Go live")}
          </button>
        </div>
      )}
    </div>
  );
}
