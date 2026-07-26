export type TierKey =
  | "participation"
  | "bronze"
  | "silver"
  | "gold"
  | "diamond"
  | "kohinoor";

export type SourceTier = "A" | "B" | "C";

export interface Party {
  code: string;
  name: string;
  ink: string;
}

export interface Neta {
  slug: string;
  name: string;
  office: string;
  party: string;
  state: string;
  /** Ratings over time, oldest first — drives the career arc. */
  arc: number[];
  replied: boolean;
}

export interface Source {
  tier: SourceTier;
  outlet: string;
  url: string;
}

export interface Axes {
  logic: number;
  straightFace: number;
  rewatch: number;
  crowd: number;
  consequence: number;
}

export interface Statement {
  id: number;
  slug: string;
  quote: string;
  /** Original-language transcript lines. */
  originalLines: string[];
  /** English translation, line-for-line with originalLines. */
  englishLines: string[];
  neta: string; // Neta.slug
  category: string;
  language: string;
  /** Script of the original, so Devanagari gets its own line-height. */
  script: "deva" | "latin" | "other";
  venue: string;
  /** Days before "today" that this was said. */
  daysAgo: number;
  gp: number;
  /** Rank at the previous recompute, for the movement column. */
  previousRank: number;
  duels: number;
  sources: Source[];
  axes: Axes;
  reply?: string;
  /** Formal award citation, conferred on Diamond and above. The joke is
   *  that it is written exactly as a real honours citation would be. */
  citation?: string;
  /** The Committee's Note — one sentence of straight-faced assessment. */
  note?: string;
  /** Provisional entries are still in placement and are not ranked yet. */
  placement?: number;
  projected?: TierKey;
}

export interface LedgerEntry {
  date: string;
  kind: "withdrawal" | "correction" | "reply" | "audit" | "integrity";
  detail: string;
}
