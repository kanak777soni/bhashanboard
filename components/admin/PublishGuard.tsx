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

function publicHttpUrl(input: string): boolean {
  if (!input) return false;
  try {
    const url = new URL(input);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
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

function readChecklist(form: HTMLFormElement): {
  items: ChecklistItem[];
  warnings: string[];
} {
  const language = value(form, "language");
  const quote = value(form, "quote");
  const translation = value(form, "quote_translation");
  const date = value(form, "date");
  const venue = value(form, "venue");
  const context = value(form, "context");
  const bestTier = value(form, "best_source_tier");
  const needs = value(form, "needs")
    .split("\n")
    .map((need) => need.trim())
    .filter(Boolean);
  const platform = value(form, "video_platform");

  let sourceCount = 0;
  let matchingSource = false;
  for (let index = 0; index < 4; index += 1) {
    const publisher = value(form, `src_publisher_${index}`);
    const url = value(form, `src_url_${index}`);
    const tier = value(form, `src_tier_${index}`);
    if (publisher || url) sourceCount += 1;
    if (
      (bestTier === "A" || bestTier === "B") &&
      tier === bestTier &&
      Boolean(publisher) &&
      publicHttpUrl(url)
    ) {
      matchingSource = true;
    }
  }

  const youtubeExcerpt =
    platform === "youtube" && hasBoundedYouTubeExcerpt(form);
  const cloudinaryExcerpt =
    platform === "cloudinary" &&
    Boolean(value(form, "video")) &&
    value(form, "video_admin_ready") === "true";
  const validVideo = youtubeExcerpt || cloudinaryExcerpt;
  const previewApproved =
    platform === "youtube"
      ? value(form, "youtube_playback_attested") === "true"
      : cloudinaryExcerpt;

  const items: ChecklistItem[] = [
    {
      key: "event",
      label: "Confirmed date and venue",
      detail: "Identify when and where the statement was made.",
      complete: Boolean(date) && Boolean(venue),
    },
    {
      key: "quote",
      label: "Original-language quote",
      detail: "Enter the exact sourced wording, not a paraphrase.",
      complete: Boolean(quote),
    },
    {
      key: "translation",
      label: "Faithful English translation",
      detail:
        language.toLowerCase() === "english"
          ? "The original quote is already in English."
          : "Required whenever the original quote is not English.",
      complete:
        Boolean(language) &&
        (language.toLowerCase() === "english" || Boolean(translation)),
    },
    {
      key: "context",
      label: "Surrounding context",
      detail: "Record what happened around the excerpt.",
      complete: Boolean(context),
    },
    {
      key: "source",
      label: "Matching Tier A or B source",
      detail: "The selected best tier must have a publisher and public HTTP(S) URL.",
      complete: matchingSource,
    },
    {
      key: "video",
      label: "Playable bounded video",
      detail: "Use a valid YouTube excerpt or an approved Cloudinary upload.",
      complete: validVideo,
    },
    {
      key: "preview",
      label: "Admin playback approval",
      detail:
        platform === "youtube"
          ? "Play the YouTube preview, then confirm picture, audio and timestamps."
          : "Uploaded clips must pass server checks and full playback approval.",
      complete: validVideo && previewApproved,
    },
    {
      key: "needs",
      label: "No outstanding verification work",
      detail:
        needs.length > 0
          ? `${needs.length} unresolved item${needs.length === 1 ? "" : "s"} remain.`
          : "The outstanding-needs box is clear.",
      complete: needs.length === 0,
    },
    {
      key: "committee",
      label: "Committee sign-off",
      detail: "Select Committee passed only after transcript and context review.",
      complete: value(form, "stage") === "committee_passed",
    },
  ];

  const warnings: string[] = [];
  if (sourceCount < 2 && bestTier !== "A") {
    warnings.push("Below Tier A, add a second independent source for corroboration.");
  }
  if (!value(form, "counterpoint")) {
    warnings.push("Add a counterpoint so the record explains what the evidence establishes.");
  }

  return { items, warnings };
}

/**
 * A live mirror of the fail-closed publication rules. The server action
 * remains authoritative; this component explains blockers before submission
 * and keeps the explicit Publish button unavailable until the form is ready.
 */
export default function PublishGuard() {
  const guardRef = useRef<HTMLDivElement | null>(null);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  const recompute = useCallback(() => {
    const form = guardRef.current?.closest("form");
    if (!form) return;
    const next = readChecklist(form);
    setItems(next.items);
    setWarnings(next.warnings);

    const publishButton = form.querySelector<HTMLButtonElement>(
      "[data-publish-submit]"
    );
    if (publishButton) {
      const ready = next.items.every((item) => item.complete);
      publishButton.disabled = !ready;
      publishButton.setAttribute("aria-disabled", String(!ready));
      publishButton.title = ready
        ? "Publish this video now"
        : "Complete every publication check first";
    }
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
            {ready ? "Ready to publish" : "Publication checklist"}
          </span>
          <p>
            {items.length === 0
              ? "Checking this entry..."
              : `${completeCount} of ${items.length} required checks complete.`}
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
                {item.complete ? "DONE" : "BLOCK"}
              </span>
              <span>
                <strong>{item.label}</strong>
                <small>{item.detail}</small>
              </span>
            </li>
          ))}
        </ul>
      )}

      {warnings.length > 0 && (
        <div className="publication-warnings">
          {warnings.map((warning) => (
            <p key={warning}>
              <span className="guard-pip">NOTE</span>
              {warning}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
