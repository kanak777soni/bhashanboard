import { cache } from "react";
import { unstable_noStore as noStore } from "next/cache";
import { buildCorpus, type CorpusStatement, type RawParty, type RawPolitician, type RawStatement } from "./corpus";
import { db } from "./db";
import {
  parseRatingAggregate,
  type RatingAggregateRecord,
} from "./rating-aggregate";
import {
  buildPublicInventory,
  type PublicInventory,
} from "./public-inventory";
import type { LedgerEntry, Neta, Party } from "./types";

export const CATEGORIES = [
  "Science & Reason",
  "History",
  "Economics",
  "Whataboutery",
  "Standing Ovation",
] as const;

export const EDITION = { number: "I", date: "26 July 2026" };

interface RawRejection {
  descriptor: string;
  attributed_to?: string;
  date?: string;
  rule?: string;
  ruling?: string;
  reasoning?: string;
  sources?: { publisher?: string; url?: string }[];
}

interface AuditRow {
  occurred_at: string | Date;
  action: string;
  detail: string;
}

export interface Rejection {
  descriptor: string;
  attributedTo: string;
  date: string;
  rule: string;
  reasoning: string;
}

export interface PublicData {
  CORPUS: CorpusStatement[];
  PARTIES: Party[];
  NETAS: Neta[];
  STATEMENTS: CorpusStatement[];
  IN_PLACEMENT: CorpusStatement[];
  STATS: {
    indexed: number;
    onLadder: number;
    heldParity: number;
    heldReview: number;
    withVerbatimQuote: number;
    representatives: number;
    parties: number;
  };
  REJECTED: Rejection[];
  REJECTION_RULES: Record<string, string>;
  LEDGER: LedgerEntry[];
  allStatements(): CorpusStatement[];
  /** Backward-compatible alias for the mature public video standings. */
  rankedStatements(): CorpusStatement[];
  /** Inventory-aware public views used by Watch, Standings and the Front Page. */
  publicInventory(): PublicInventory;
  liveVideoStatements(): CorpusStatement[];
  videoUnderReviewStatements(): CorpusStatement[];
  researchOnlyStatements(): CorpusStatement[];
  publicRankedStatements(): CorpusStatement[];
  publicRankOf(slug: string): number;
  rankOf(slug: string): number;
  statementBySlug(slug: string): CorpusStatement | undefined;
  netaBySlug(slug: string): Neta | undefined;
  partyByCode(code: string): Party | undefined;
  statementsByNeta(slug: string): CorpusStatement[];
  netasWithEntries(): Neta[];
  states(): string[];
  languages(): string[];
  parity(): { code: string; pct: number; ink: string }[];
}

const getDataCached = cache(async (): Promise<PublicData> => {
  // The database is the live source of truth. React cache deduplicates this
  // snapshot within one render, while noStore prevents a deployment build or
  // a previous request from freezing it indefinitely.
  noStore();
  const sql = db();
  const rows = await sql.transaction(
      (tx) => [
        tx.query("select document from bhashan.parties order by id"),
        tx.query("select document from bhashan.politicians order by id"),
        tx.query("select document from bhashan.statements order by id"),
        tx.query("select document from bhashan.rejections order by position, id"),
        tx.query("select key, document from bhashan.settings"),
        tx.query(
          "select occurred_at, action, detail from bhashan.audit_events where action <> 'seed' order by occurred_at desc, event_id desc limit 100"
        ),
        tx.query(`
          select
            statement_id, prior_performance, prior_strength,
            valid_vote_count, valid_vote_sum,
            vote_0_count, vote_25_count, vote_50_count, vote_75_count, vote_100_count,
            performance, gp, model_version, updated_at
          from bhashan.statement_rating_aggregates
          order by statement_id
        `),
      ],
      { readOnly: true }
    );
  const [
    partyRows,
    politicianRows,
    statementRows,
    rejectionRows,
    settingRows,
    auditRows,
    aggregateRows,
  ] =
    rows as unknown as [
      { document: unknown }[],
      { document: unknown }[],
      { document: unknown }[],
      { document: unknown }[],
      { key: string; document: unknown }[],
      AuditRow[],
      RatingAggregateRecord[],
    ];

  const parties = partyRows.map((row) => row.document as RawParty);
  const politicians = politicianRows.map((row) => row.document as RawPolitician);
  const statements = statementRows.map(
    (row) => row.document as RawStatement
  );
  const rejections = rejectionRows.map((row) => row.document as RawRejection);
  const ratingAggregates = aggregateRows.map(parseRatingAggregate);
  const settings = new Map(
    settingRows.map((row) => [String(row.key), row.document as unknown])
  );
  const model = buildCorpus({ statements, politicians, parties, ratingAggregates });
  const PARTIES = model.CORPUS_PARTIES;
  const NETAS = model.CORPUS_NETAS;
  const STATEMENTS = model.ON_LADDER;
  const publicInventory = buildPublicInventory(model.CORPUS);
  const netaMap = new Map(NETAS.map((neta) => [neta.slug, neta]));
  const partyMap = new Map(PARTIES.map((party) => [party.code, party]));

  const REJECTED: Rejection[] = rejections.map((rejection) => ({
    descriptor: rejection.descriptor,
    attributedTo: rejection.attributed_to ?? "—",
    date: rejection.date ?? "—",
    rule: rejection.rule ?? "—",
    reasoning: rejection.reasoning ?? rejection.ruling ?? "",
  }));
  const REJECTION_RULES =
    (settings.get("rejection_rules") as Record<string, string> | undefined) ?? {};

  const canonicalLedger: LedgerEntry[] = [
    {
      date: "2026-07-30",
      kind: "correction",
      detail: `Publishing was simplified to match the Board's actual purpose. A live card now needs a playable bounded clip, speaker, party, category, title, original-language quote and translation where needed. Date, venue, extra links, context notes and old verification-stage fields remain useful archive material but no longer form a hidden second approval system.`,
    },
    {
      date: "2026-07-29",
      kind: "integrity",
      detail: `Neutrality and evidence audit: source quality was applied without regard to party. Every still-published Tier C-only card was moved to review (BJP, INC and TMC alike). Five additional BJP cards with missing original wording or material metadata/context gaps were moved to review; the rain-god figure of speech and the duplicate pakoda card were withdrawn on their merits, not to force a party percentage.`,
    },
    {
      date: "2026-07-29",
      kind: "correction",
      detail: `Rahul Gandhi corpus review: IN-0042 now indexes only the historically incorrect Coca-Cola/shikanji claim and no longer bundles the materially more defensible McDonald's comparison. The English "Magical Train" attribution was added with the limited finding "no supporting record found" — not "fabricated". Scores remain formula-derived; no requested GP was inserted by hand.`,
    },
    {
      date: "2026-07-29",
      kind: "withdrawal",
      detail: `IN-0010, the reported "poverty is a state of mind" remark, was withdrawn from the ladder. Reporters were excluded, no recording was found, and the host institute's first press note and next-day clarification materially conflict. The harsher release cannot be presented as established verbatim speech.`,
    },
    {
      date: "2026-07-29",
      kind: "audit",
      detail: `Two proposed opposition clips were recorded in Refused rather than silently omitted. The Muzaffarnagar/ISI speech is genuine and officially contradicted, but the statement is barred by the same no-religion/community rule applied to every party. The Ashok Gehlot electricity-and-water clip is a context cut: the full passage shows him recounting an alleged old Jan Sangh rumour, not advancing the claim himself.`,
    },
    {
      date: "2026-07-26",
      kind: "audit",
      detail: `Parity-only holdback withdrawn. Thirteen entries — all from one party — had been kept off the ladder solely so the board would read as balanced. That edits the display rather than the sampling. Later review may still hold or withdraw any entry for source quality, context, duplication or the Rules; party percentage is never itself the reason.`,
    },
    {
      date: "2026-07-26",
      kind: "integrity",
      detail: `Coverage imbalance disclosed rather than corrected through scores. This is a statement about where the research looked, not about what the parties said. The corpus leans heavily on the pseudoscience genre and has barely searched economics or deflection, where opposition material would sit. The gap is closed by sourcing and evidence review, never by adjusting ratings.`,
    },
    {
      date: "2026-07-26",
      kind: "withdrawal",
      detail: `Two of the most-circulated opposition "gaffes" refused on sourcing. The potato-into-gold clip is edited — the full speech attributes the promise to someone else, and the attribution is cut out. The "Steve Jobs of Microsoft" remark turns on whether the speaker said "and" or "of", and the recording does not settle it. Virality is not attribution.`,
    },
    {
      date: "2026-07-26",
      kind: "audit",
      detail: `Seed corpus: ${model.CORPUS.length} entries indexed, ${model.ON_LADDER.length} on the ladder. Every entry remains at verification stage "text sourced" and none is publishable until a Tier A or B clip, a timestamp and a transcript exist.`,
    },
    {
      date: "2026-07-26",
      kind: "correction",
      detail: `${model.CORPUS.length - model.CORPUS_STATS.withVerbatimQuote} of ${model.CORPUS.length} entries carry no verbatim quote. Where the exact wording could not be established the quote field is null and a neutral claim carries the meaning. A null quote is a research task; an invented quote would end the project.`,
    },
  ];
  const mutationLedger: LedgerEntry[] = (auditRows as unknown as AuditRow[]).map((entry) => ({
    date: new Date(entry.occurred_at).toISOString().slice(0, 10),
    kind:
      entry.action === "withdraw"
        ? "withdrawal"
        : entry.action === "reply"
          ? "reply"
          : entry.action === "integrity"
            ? "integrity"
            : entry.action === "update" || entry.action === "status"
              ? "correction"
              : "audit",
    detail: entry.detail,
  }));

  const data: PublicData = {
    CORPUS: model.CORPUS,
    PARTIES,
    NETAS,
    STATEMENTS: model.CORPUS,
    IN_PLACEMENT: model.HELD,
    STATS: model.CORPUS_STATS,
    REJECTED,
    REJECTION_RULES,
    LEDGER: [...mutationLedger, ...canonicalLedger],
    allStatements: () => [...model.CORPUS],
    rankedStatements: () => [...publicInventory.rankedVideos],
    publicInventory: () => publicInventory,
    liveVideoStatements: () => [...publicInventory.liveVideos],
    videoUnderReviewStatements: () => [...publicInventory.videoUnderReview],
    researchOnlyStatements: () => [...publicInventory.researchOnly],
    publicRankedStatements: () => [...publicInventory.rankedVideos],
    publicRankOf: (slug) => publicInventory.publicRankBySlug.get(slug) ?? 0,
    rankOf: (slug) => publicInventory.publicRankBySlug.get(slug) ?? 0,
    statementBySlug: (slug) => model.CORPUS.find((statement) => statement.slug === slug),
    netaBySlug: (slug) => netaMap.get(slug),
    partyByCode: (code) => partyMap.get(code),
    statementsByNeta: (slug) =>
      model.CORPUS
        .filter((statement) => statement.neta === slug)
        .sort(
          (a, b) =>
            a.daysAgo - b.daysAgo || a.corpusId.localeCompare(b.corpusId)
        ),
    netasWithEntries: () =>
      NETAS.filter((neta) => STATEMENTS.some((statement) => statement.neta === neta.slug)),
    states: () =>
      [
        ...new Set(
          STATEMENTS.map((statement) => netaMap.get(statement.neta)?.state).filter(
            (state): state is string => Boolean(state)
          )
        ),
      ].sort(),
    languages: () => [...new Set(STATEMENTS.map((statement) => statement.language))].sort(),
    parity: () => {
      const counts = new Map<string, number>();
      for (const statement of model.CORPUS) {
        counts.set(
          statement.partyAtTime,
          (counts.get(statement.partyAtTime) ?? 0) + 1
        );
      }
      const total = model.CORPUS.length || 1;
      return [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([code, count]) => ({
          code,
          ink: partyMap.get(code)?.ink ?? "#7C8A86",
          pct: Math.round((count / total) * 100),
        }));
    },
  };

  return data;
});

export function getData(): Promise<PublicData> {
  return getDataCached();
}
