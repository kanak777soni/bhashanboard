import type { Axes } from "./types";

export interface SarcasmLens {
  key: keyof Axes;
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
    label: "Logic Break",
    prompt: "The reasoning folds in on itself.",
  },
  {
    key: "straightFace",
    label: "Full Confidence",
    prompt: "Delivered as if nobody could object.",
  },
  {
    key: "rewatch",
    label: "Replay Value",
    prompt: "It gets funnier the second time.",
  },
  {
    key: "crowd",
    label: "Crowd Effect",
    prompt: "The room makes the moment bigger.",
  },
  {
    key: "consequence",
    label: "No Fallout",
    prompt: "It sails on as if nothing happened.",
  },
];

export function scoreSarcasmAxis(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function sarcasmHighlights(
  axes: Axes,
  limit = 2,
): SarcasmHighlight[] {
  const count = Math.max(0, Math.floor(limit));
  return SARCASM_LENSES.map((lens, index) => ({
    index,
    label: lens.label,
    value: scoreSarcasmAxis(axes[lens.key]),
  }))
    .sort((left, right) => right.value - left.value || left.index - right.index)
    .slice(0, count)
    .map(({ label, value }) => ({ label, value }));
}

export function sarcasmSignature(axes: Axes): SarcasmHighlight {
  return (
    sarcasmHighlights(axes, 1)[0] ?? {
      label: SARCASM_LENSES[0].label,
      value: scoreSarcasmAxis(axes.logic),
    }
  );
}
