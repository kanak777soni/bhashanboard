export type TierKey =
  | "participation"
  | "bronze"
  | "silver"
  | "gold"
  | "diamond"
  | "kohinoor";

export type SourceTier = "A" | "B" | "C";

export const SOURCE_ROLES = [
  "footage",
  "reporting",
  "context",
  "fact_check",
] as const;

export type SourceRole = (typeof SOURCE_ROLES)[number];

export function isSourceRole(value: unknown): value is SourceRole {
  return (
    typeof value === "string" &&
    (SOURCE_ROLES as readonly string[]).includes(value)
  );
}

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
  /** What this citation contributes to the record. Legacy sources may omit it. */
  role?: SourceRole;
}

export interface Axes {
  logic: number;
  /** Null on legacy records until an administrator reviews the new lens. */
  realityGap: number | null;
  straightFace: number;
  comicImpact: number;
}

export type VerificationStage = "text_sourced" | "av_verified" | "committee_passed";

export interface YouTubeStatementVideo {
  platform: "youtube";
  id: string;
  /** Inclusive excerpt start, in whole seconds. */
  start: number;
  /** Exclusive excerpt end, in whole seconds. */
  end: number;
}

export interface CloudinaryStatementVideo {
  platform: "cloudinary";
  /** Random, immutable Cloudinary public ID. Never store a delivery URL. */
  id: string;
  /** Cloudinary's immutable identifier for this asset. */
  assetId: string;
  /** Version returned by Cloudinary and embedded in every delivery URL. */
  version: number;
  /** Original uploaded object size in bytes. */
  bytes: number;
  /** Size of the eagerly generated browser-ready MP4 derivative. */
  derivedBytes: number;
  format: "mp4";
  /** Provider-verified media duration rounded to a whole millisecond. */
  durationMs: number;
  /** Hosted evidence files are already-trimmed clips and begin at zero. */
  start: 0;
  /** Exclusive excerpt end, in whole seconds. */
  end: number;
}

export type StatementVideo = YouTubeStatementVideo | CloudinaryStatementVideo;

export interface VoteDistribution {
  0: number;
  25: number;
  50: number;
  75: number;
  100: number;
}

export type StatementRatingSource = "community" | "unrated";

/** Rating details exposed with every public statement. */
export interface StatementRating {
  source: StatementRatingSource;
  performance: number;
  validVoteCount: number;
  validVoteSum: number;
  distribution: VoteDistribution;
  priorPerformance: number;
  priorStrength: number;
  modelVersion: number | null;
  updatedAt: string | null;
}

/** Validated persisted aggregate passed into the pure corpus adapter. */
export interface PersistedStatementRatingAggregate {
  statementId: string;
  priorPerformance: number;
  priorStrength: number;
  validVoteCount: number;
  validVoteSum: number;
  distribution: VoteDistribution;
  performance: number;
  gp: number;
  modelVersion: number;
  updatedAt: string;
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
  /** Public GP, neutral at 1500 until the first valid ruling. */
  gp: number;
  rating: StatementRating;
  duels: number;
  /** A bounded, externally hosted evidence excerpt. */
  video?: StatementVideo;
  sources: Source[];
  axes: Axes;
  reply?: string;
  /** Formal award citation, conferred on Diamond and above. The joke is
   *  that it is written exactly as a real honours citation would be. */
  citation?: string;
  /** The Committee's Note — one sentence of straight-faced assessment. */
  note?: string;
}

export interface LedgerEntry {
  date: string;
  kind: "withdrawal" | "correction" | "reply" | "audit" | "integrity";
  detail: string;
}
