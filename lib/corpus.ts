import type {
  Axes,
  Neta,
  Party,
  PersistedStatementRatingAggregate,
  Source,
  SourceTier,
  Statement,
  StatementRating,
  StatementVideo,
  VerificationStage,
  VoteDistribution,
} from "./types";
import { RATING_PRIOR_STRENGTH } from "./rating";
import {
  isCommitteePublicationEligible,
  normalizeStatementVideo,
  normalizeVerificationStage,
} from "./video";

/**
 * Pure adapter from persisted corpus documents to the public view model.
 *
 * Keeping this module free of filesystem and database imports lets Server
 * Components, Edge metadata routes, migration tooling and tests share the
 * exact same shaping and ranking rules.
 */

export interface RawVerification {
  stage: string;
  best_source_tier: string;
  needs?: string[];
  sources?: { tier?: string; publisher?: string; title?: string; url?: string }[];
  embed?: {
    platform?: string;
    id?: string;
    start_s?: number;
    end_s?: number;
  } | null;
}

export interface RawStatement {
  id: string;
  status: "published" | "held_parity" | "held_review" | "withdrawn";
  speaker_id: string;
  party_at_time: string;
  office_at_time: string;
  state: string;
  date: string;
  date_precision?: string;
  venue: string;
  language: string;
  category: string;
  neutral_title: string;
  quote: string | null;
  quote_translation?: string;
  quote_note?: string;
  claim: string;
  context?: string;
  counterpoint?: string;
  policy_note?: string;
  hall_of_fame?: boolean;
  video?: { platform?: string; id?: string; start?: number; end?: number };
  axes: Record<string, number>;
  verification: RawVerification;
  /** Runtime-only publication seed stored beside, not inside, the document. */
  rating_seed_gp?: number | null;
}

export interface RawPolitician {
  id: string;
  name: string;
  party: string;
  state: string;
  notes?: string;
}

export interface RawParty {
  id: string;
  name: string;
  scope?: string;
  ink?: string;
  aka?: string[];
}

export interface CorpusStatement extends Statement {
  corpusId: string;
  /** False when the exact wording was never established. Check before quoting. */
  hasVerbatimQuote: boolean;
  neutralTitle: string;
  claim: string;
  counterpoint?: string;
  quoteTranslation?: string;
  quoteNote?: string;
  policyNote?: string;
  contextNote?: string;
  verificationStage: VerificationStage;
  /** True only when the complete server-side publication and voting bar passes. */
  publicationEligible: boolean;
  bestSourceTier: string;
  needs: string[];
  held?: "parity" | "review";
  hallOfFame: boolean;
  office: string;
  /** Party affiliation on the date of the statement, not the speaker's current party. */
  partyAtTime: string;
}

export interface CorpusModel {
  CORPUS: CorpusStatement[];
  ON_LADDER: CorpusStatement[];
  HELD: CorpusStatement[];
  CORPUS_PARTIES: Party[];
  CORPUS_NETAS: Neta[];
  CORPUS_STATS: {
    indexed: number;
    onLadder: number;
    heldParity: number;
    heldReview: number;
    withVerbatimQuote: number;
    representatives: number;
    parties: number;
  };
}

const WEIGHTS: Record<string, number> = {
  logic_damage: 0.3,
  straight_face: 0.2,
  rewatch_value: 0.2,
  crowd_complicity: 0.15,
  consequence: 0.15,
};

const BANDS: [number, number, number][] = [
  [0.025, 1875, 1960],
  [0.08, 1750, 1868],
  [0.16, 1600, 1742],
  [0.21, 1450, 1590],
  [0.24, 1300, 1440],
  [1, 1150, 1290],
];

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72);
}

function weighted(axes: Record<string, number>): number {
  return Object.entries(WEIGHTS).reduce((sum, [key, weight]) => sum + (axes[key] ?? 0) * weight, 0);
}

function scriptOf(language: string): Statement["script"] {
  if (language === "English") return "latin";
  if (["Hindi", "Marathi", "Nepali", "Konkani"].includes(language)) return "deva";
  return "other";
}

function toSources(verification: RawVerification): Source[] {
  return (verification.sources ?? []).map((source) => ({
    tier: (["A", "B", "C"].includes(source.tier ?? "") ? source.tier : "C") as SourceTier,
    outlet: source.publisher ?? source.title ?? "Unattributed",
    url: source.url ?? "#",
  }));
}

function toAxes(axes: Record<string, number>): Axes {
  const pct = (score: number) => Math.round(((score ?? 0) / 5) * 100);
  return {
    logic: pct(axes.logic_damage),
    straightFace: pct(axes.straight_face),
    rewatch: pct(axes.rewatch_value),
    crowd: pct(axes.crowd_complicity),
    consequence: pct(axes.consequence),
  };
}

function daysSince(date: string, referenceTime: number): number {
  const parsed = Date.parse(date.length === 7 ? `${date}-01` : date);
  return Number.isNaN(parsed)
    ? 999
    : Math.max(0, Math.round((referenceTime - parsed) / 86_400_000));
}

function emptyVoteDistribution(): VoteDistribution {
  return { 0: 0, 25: 0, 50: 0, 75: 0, 100: 0 };
}

function seedPerformance(seedGp: number): number {
  return Math.min(100, Math.max(0, (seedGp - 1000) / 10));
}

function publicRating(
  seedGp: number,
  aggregate: PersistedStatementRatingAggregate | undefined
): { gp: number; rating: StatementRating } {
  // An aggregate row freezes the editorial prior at the first ballot. Keep
  // using it even if every ballot is later excluded and the valid count
  // returns to zero; recomputing from today's ladder seed would move the score.
  if (aggregate) {
    return {
      gp: aggregate.gp,
      rating: {
        source: "community",
        performance: aggregate.performance,
        validVoteCount: aggregate.validVoteCount,
        validVoteSum: aggregate.validVoteSum,
        distribution: { ...aggregate.distribution },
        priorPerformance: aggregate.priorPerformance,
        priorStrength: aggregate.priorStrength,
        modelVersion: aggregate.modelVersion,
        updatedAt: aggregate.updatedAt,
      },
    };
  }

  const performance = seedPerformance(seedGp);
  return {
    gp: seedGp,
    rating: {
      source: "seed",
      performance,
      validVoteCount: 0,
      validVoteSum: 0,
      distribution: emptyVoteDistribution(),
      priorPerformance: performance,
      priorStrength: RATING_PRIOR_STRENGTH,
      modelVersion: null,
      updatedAt: null,
    },
  };
}

export function buildCorpus({
  statements,
  politicians,
  parties,
  ratingAggregates = [],
}: {
  statements: RawStatement[];
  politicians: RawPolitician[];
  parties: RawParty[];
  ratingAggregates?: readonly PersistedStatementRatingAggregate[];
}, referenceDate: Date | number | string = Date.now()): CorpusModel {
  const parsedReference = new Date(referenceDate);
  if (Number.isNaN(parsedReference.getTime())) {
    throw new Error("The corpus reference date is invalid.");
  }
  const referenceTime = Date.UTC(
    parsedReference.getUTCFullYear(),
    parsedReference.getUTCMonth(),
    parsedReference.getUTCDate()
  );
  const ladder = statements.filter((statement) => statement.status === "published");
  const visible = statements.filter((statement) => statement.status !== "withdrawn");
  const ordered = [...ladder].sort((a, b) => weighted(b.axes) - weighted(a.axes));
  const gpById = new Map<string, number>();
  const ratingByStatementId = new Map(
    ratingAggregates.map((aggregate) => [aggregate.statementId, aggregate] as const)
  );

  let index = 0;
  for (const [share, low, high] of BANDS) {
    const wanted = Math.max(
      share === 1 ? ordered.length - index : Math.round(ordered.length * share),
      0
    );
    const count = Math.min(wanted, ordered.length - index);
    for (let offset = 0; offset < count; offset++) {
      const gp =
        count === 1
          ? high
          : Math.round(high - ((high - low) * offset) / Math.max(count - 1, 1));
      gpById.set(ordered[index + offset].id, gp);
    }
    index += count;
    if (index >= ordered.length) break;
  }

  const shape = (raw: RawStatement): CorpusStatement => {
    const hasQuote = typeof raw.quote === "string" && raw.quote.trim().length > 0;
    const quoteTranslation =
      typeof raw.quote_translation === "string" && raw.quote_translation.trim().length > 0
        ? raw.quote_translation
        : undefined;
    const video: StatementVideo | undefined =
      normalizeStatementVideo(raw.video) ?? normalizeStatementVideo(raw.verification.embed);
    const persistedSeed = Number(raw.rating_seed_gp);
    const seedGp =
      Number.isSafeInteger(persistedSeed) && persistedSeed >= 1000 && persistedSeed <= 2000
        ? persistedSeed
        : gpById.get(raw.id) ?? 1500;
    const effectiveRating = publicRating(seedGp, ratingByStatementId.get(raw.id));

    return {
      id: Number(raw.id.replace(/\D/g, "")) || 0,
      corpusId: raw.id,
      slug: slugify(`${raw.neutral_title}-${raw.id}`),
      quote: hasQuote ? (raw.quote as string) : raw.neutral_title,
      hasVerbatimQuote: hasQuote,
      neutralTitle: raw.neutral_title,
      claim: raw.claim,
      counterpoint: raw.counterpoint,
      quoteTranslation,
      quoteNote: raw.quote_note,
      policyNote: raw.policy_note,
      contextNote: raw.context,
      originalLines: hasQuote ? [raw.quote as string] : [],
      englishLines: hasQuote
        ? quoteTranslation
          ? [quoteTranslation]
          : raw.language === "English"
            ? [raw.quote as string]
            : []
        : [],
      neta: raw.speaker_id,
      category: raw.category,
      language: raw.language,
      script: scriptOf(raw.language),
      venue: raw.venue,
      daysAgo: daysSince(raw.date, referenceTime),
      gp: effectiveRating.gp,
      seedGp,
      rating: effectiveRating.rating,
      previousRank: 0,
      duels: 0,
      video,
      sources: toSources(raw.verification),
      axes: toAxes(raw.axes),
      verificationStage: normalizeVerificationStage(raw.verification.stage),
      publicationEligible: isCommitteePublicationEligible(raw),
      bestSourceTier: raw.verification.best_source_tier,
      needs: raw.verification.needs ?? [],
      held:
        raw.status === "held_parity"
          ? "parity"
          : raw.status === "held_review"
            ? "review"
            : undefined,
      hallOfFame: raw.hall_of_fame === true,
      office: raw.office_at_time,
      partyAtTime: raw.party_at_time,
    };
  };

  const CORPUS = visible.map(shape);
  const ON_LADDER = CORPUS.filter((statement) => !statement.held).sort((a, b) => b.gp - a.gp);
  const HELD = CORPUS.filter((statement) => statement.held);
  const CORPUS_PARTIES: Party[] = parties.map((party) => ({
    code: party.id,
    name: party.name,
    ink: party.ink ?? "#7C8A86",
  }));
  const CORPUS_NETAS: Neta[] = politicians.map((politician) => {
    const entries = ON_LADDER.filter((statement) => statement.neta === politician.id);
    return {
      slug: politician.id,
      name: politician.name,
      office: CORPUS.find((statement) => statement.neta === politician.id)?.office ?? politician.notes ?? "",
      party: politician.party,
      state: politician.state,
      arc: entries.length
        ? [...entries].sort((a, b) => b.daysAgo - a.daysAgo).map((statement) => statement.gp)
        : [],
      replied: false,
    };
  });

  return {
    CORPUS,
    ON_LADDER,
    HELD,
    CORPUS_PARTIES,
    CORPUS_NETAS,
    CORPUS_STATS: {
      indexed: CORPUS.length,
      onLadder: ON_LADDER.length,
      heldParity: CORPUS.filter((statement) => statement.held === "parity").length,
      heldReview: CORPUS.filter((statement) => statement.held === "review").length,
      withVerbatimQuote: CORPUS.filter((statement) => statement.hasVerbatimQuote).length,
      representatives: new Set(CORPUS.map((statement) => statement.neta)).size,
      parties: new Set(
        CORPUS.map((statement) => statement.partyAtTime).filter(Boolean)
      ).size,
    },
  };
}
