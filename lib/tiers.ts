import type { TierKey } from "./types";

export interface Tier {
  key: TierKey;
  name: string;
  /** Inclusive lower bound in GP. */
  min: number;
  /** CSS custom property or literal used for the engraved medal. */
  colour: string;
}

/** Ordered high to low. Public bands are fixed and never adjusted to force a
 * preferred distribution. See the current rules page for the scoring model. */
export const TIERS: Tier[] = [
  { key: "kohinoor", name: "Kohinoor Class", min: 1875, colour: "var(--foil)" },
  { key: "diamond", name: "Diamond Gyan", min: 1750, colour: "var(--facet)" },
  { key: "gold", name: "Gold Standard", min: 1600, colour: "var(--foil)" },
  { key: "silver", name: "Silver Tongue", min: 1450, colour: "var(--shade-cool)" },
  { key: "bronze", name: "Bronze Bhashan", min: 1300, colour: "var(--bronze)" },
  { key: "participation", name: "Participation Certificate", min: 0, colour: "var(--ink-25)" },
];

export function tierOf(gp: number): Tier {
  return TIERS.find((t) => gp >= t.min) ?? TIERS[TIERS.length - 1];
}

export function tierByKey(key: TierKey): Tier {
  return TIERS.find((t) => t.key === key) ?? TIERS[TIERS.length - 1];
}

/** Ceremony fires on promotion into these tiers. */
export const CEREMONIAL: TierKey[] = ["diamond", "kohinoor"];
