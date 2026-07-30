"use client";

import { useMemo, useState } from "react";
import { PUBLIC_CLASS_MIN_VALID_VOTES } from "@/lib/rating";
import {
  SARCASM_LENSES,
  provisionalClassFromFivePointScores,
  type SarcasmStorageKey,
} from "@/lib/sarcasm";
import { tierOf } from "@/lib/tiers";

const SCORE_LABELS = [
  "0 · absent",
  "1 · faint",
  "2 · mild",
  "3 · clear",
  "4 · strong",
  "5 · defining",
] as const;

type ScoreState = Record<SarcasmStorageKey, string>;

function initialScores(axes?: Record<string, number>): ScoreState {
  return Object.fromEntries(
    SARCASM_LENSES.map((lens) => {
      const value = axes?.[lens.storageKey];
      return [
        lens.storageKey,
        typeof value === "number" &&
        Number.isInteger(value) &&
        value >= 0 &&
        value <= 5
          ? String(value)
          : "",
      ];
    }),
  ) as ScoreState;
}

export default function SarcasmProfileFields({
  initialAxes,
  validVoteCount = 0,
  publicGp = 1500,
}: {
  initialAxes?: Record<string, number>;
  validVoteCount?: number;
  publicGp?: number;
}) {
  const [scores, setScores] = useState<ScoreState>(() =>
    initialScores(initialAxes),
  );
  const preview = useMemo(
    () =>
      provisionalClassFromFivePointScores(
        Object.fromEntries(
          Object.entries(scores).map(([key, value]) => [
            key,
            value === "" ? null : Number(value),
          ]),
        ),
      ),
    [scores],
  );
  const publicClassActive =
    validVoteCount >= PUBLIC_CLASS_MIN_VALID_VOTES;
  const missing = SARCASM_LENSES.filter(
    (lens) => scores[lens.storageKey] === "",
  );

  return (
    <>
      <div className="axis-editor axis-editor-four">
        {SARCASM_LENSES.map((lens) => {
          const helpId = `axis-help-${lens.storageKey}`;
          return (
            <label className="field sarcasm-axis-field" key={lens.storageKey}>
              <span className="lbl">{lens.label}</span>
              <small className="field-help" id={helpId}>
                {lens.prompt}
              </small>
              <select
                name={lens.storageKey}
                value={scores[lens.storageKey]}
                required
                aria-describedby={helpId}
                onChange={(event) =>
                  setScores((current) => ({
                    ...current,
                    [lens.storageKey]: event.target.value,
                  }))
                }
              >
                <option value="">Choose a mark</option>
                {SCORE_LABELS.map((label, score) => (
                  <option key={score} value={score}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
      </div>

      <div
        className={`sarcasm-class-preview ${
          preview ? "complete" : "incomplete"
        }`}
        aria-live="polite"
      >
        {publicClassActive ? (
          <>
            <span className="lbl">Public class active</span>
            <strong>{tierOf(publicGp).name}</strong>
            <p>
              {publicGp.toLocaleString("en-IN")} GP from{" "}
              {validVoteCount.toLocaleString("en-IN")} valid votes. The profile
              remains visible, but its provisional class no longer controls
              the badge.
              {preview
                ? ` Its private comparison is ${preview.total}/20 · ${preview.tier.name}.`
                : ""}
            </p>
          </>
        ) : preview ? (
          <>
            <span className="lbl">Board provisional class</span>
            <strong>{preview.tier.name}</strong>
            <p>
              {preview.total}/20, with all four marks weighted equally. This
              preview never enters GP, rank, Standings, or the Hall; the public
              class replaces it at {PUBLIC_CLASS_MIN_VALID_VOTES} valid votes.
            </p>
          </>
        ) : (
          <>
            <span className="lbl">Profile incomplete</span>
            <strong>
              {missing.length === 1
                ? `${missing[0].label} is unrated`
                : `${missing.length} marks still need a decision`}
            </strong>
            <p>
              Choose all four marks before the clip goes live. Older clips may
              be missing Reality Gap because it is a new lens.
            </p>
          </>
        )}
      </div>
    </>
  );
}
