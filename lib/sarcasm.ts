import type { Axes } from "./types";
import { tierOf, type Tier } from "./tiers";

export interface SarcasmLens {
  key: keyof Axes;
  storageKey:
    | "logic_damage"
    | "reality_gap"
    | "straight_face"
    | "rewatch_value";
  label: string;
  prompt: string;
}

export interface SarcasmHighlight {
  label: string;
  value: number;
}

export const SARCASM_LENSES: ReadonlyArray<SarcasmLens> = [
  {
    key: "logic",
    storageKey: "logic_damage",
    label: "Logic Break",
    prompt: "The reasoning contradicts itself or skips the bridge.",
  },
  {
    key: "realityGap",
    storageKey: "reality_gap",
    label: "Reality Gap",
    prompt: "The claim drifts away from checkable reality.",
  },
  {
    key: "straightFace",
    storageKey: "straight_face",
    label: "Full Confidence",
    prompt: "Delivered as settled truth, with no doubt in sight.",
  },
  {
    key: "comicImpact",
    storageKey: "rewatch_value",
    label: "Comic Impact",
    prompt: "The unedited moment lands and stays funny.",
  },
];

export type SarcasmStorageKey = SarcasmLens["storageKey"];

export interface ProvisionalClassPreview {
  total: number;
  performance: number;
  gp: number;
  tier: Tier;
}

export function scoreSarcasmAxis(
  value: number | null | undefined,
): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

function previewFromPerformance(
  performance: number,
  total: number,
): ProvisionalClassPreview {
  const gp = Math.round(1000 + 10 * performance);
  return {
    total,
    performance,
    gp,
    tier: tierOf(gp),
  };
}

export function provisionalClassFromFivePointScores(
  scores: Partial<Record<SarcasmStorageKey, number | null | undefined>>,
): ProvisionalClassPreview | null {
  const values = SARCASM_LENSES.map((lens) => scores[lens.storageKey]);
  if (
    values.some(
      (value) =>
        !Number.isInteger(value) ||
        (value as number) < 0 ||
        (value as number) > 5,
    )
  ) {
    return null;
  }
  const total = (values as number[]).reduce((sum, value) => sum + value, 0);
  return previewFromPerformance(total * 5, total);
}

export function provisionalClassFromStoredAxes(
  axes: Record<string, unknown> | null | undefined,
): ProvisionalClassPreview | null {
  if (!axes) return null;
  return provisionalClassFromFivePointScores(
    Object.fromEntries(
      SARCASM_LENSES.map((lens) => [
        lens.storageKey,
        axes[lens.storageKey] as number | null | undefined,
      ]),
    ) as Partial<Record<SarcasmStorageKey, number | null | undefined>>,
  );
}

export function provisionalClassFromAxes(
  axes: Axes,
): ProvisionalClassPreview | null {
  const values = SARCASM_LENSES.map((lens) =>
    scoreSarcasmAxis(axes[lens.key]),
  );
  if (values.some((value) => value === null)) return null;
  const performance =
    (values as number[]).reduce((sum, value) => sum + value, 0) /
    SARCASM_LENSES.length;
  return previewFromPerformance(performance, performance / 5);
}

export function sarcasmHighlights(
  axes: Axes,
  limit = 2,
): SarcasmHighlight[] {
  const count = Math.max(0, Math.floor(limit));
  return SARCASM_LENSES.map((lens, index) => {
    const value = scoreSarcasmAxis(axes[lens.key]);
    return {
      index,
      label: lens.label,
      value,
    };
  })
    .filter(
      (
        item,
      ): item is {
        index: number;
        label: string;
        value: number;
      } => item.value !== null,
    )
    .sort((left, right) => right.value - left.value || left.index - right.index)
    .slice(0, count)
    .map(({ label, value }) => ({ label, value }));
}

export function sarcasmSignature(axes: Axes): SarcasmHighlight {
  return (
    sarcasmHighlights(axes, 1)[0] ?? {
      label: SARCASM_LENSES[0].label,
      value: scoreSarcasmAxis(axes.logic) ?? 0,
    }
  );
}
