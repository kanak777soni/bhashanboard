import { cache } from "react";
import { unstable_noStore as noStore } from "next/cache";
import { buildCorpus, type CorpusStatement, type RawParty, type RawPolitician, type RawStatement } from "./corpus";
import { db } from "./db";
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
  rankedStatements(): CorpusStatement[];
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
      ],
      { readOnly: true }
    );
  const [partyRows, politicianRows, statementRows, rejectionRows, settingRows, auditRows] =
    rows as unknown as [
      { document: unknown }[],
      { document: unknown }[],
      { document: unknown }[],
      { document: unknown }[],
      { key: string; document: unknown }[],
      AuditRow[],
    ];

  const parties = partyRows.map((row) => row.document as RawParty);
  const politicians = politicianRows.map((row) => row.document as RawPolitician);
  const statements = statementRows.map((row) => row.document as RawStatement);
  const rejections = rejectionRows.map((row) => row.document as RawRejection);
  const settings = new Map(
    settingRows.map((row) => [String(row.key), row.document as unknown])
  );
  const model = buildCorpus({ statements, politicians, parties });
  const PARTIES = model.CORPUS_PARTIES;
  const NETAS = model.CORPUS_NETAS;
  const STATEMENTS = model.ON_LADDER;
  const ranked = [...STATEMENTS].sort((a, b) => b.gp - a.gp);
  const netaMap = new Map(NETAS.map((neta) => [neta.slug, neta]));
  const partyMap = new Map(PARTIES.map((party) => [party.code, party]));
  const rankMap = new Map(ranked.map((statement, index) => [statement.slug, index + 1]));

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
      date: "2026-07-26",
      kind: "audit",
      detail: `Parity holdback withdrawn. Thirteen entries — all from one party — had been kept off the ladder so the board would read as balanced. That edits the display rather than the sampling, and misrepresents what the research found. All ${model.CORPUS.length} indexed entries are now placed. Parity from here governs how hard we search, not what we show.`,
    },
    {
      date: "2026-07-26",
      kind: "integrity",
      detail: `Coverage imbalance published rather than corrected: BJP is 51% of the seed against a 30% target, and holds every one of the top fourteen places. This is a statement about where the research looked, not about what the parties said. The corpus leans heavily on the pseudoscience genre and has barely searched economics or deflection, where opposition material would sit. It is closed by sourcing, never by holding entries back or adjusting ratings.`,
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
    STATEMENTS,
    IN_PLACEMENT: model.HELD,
    STATS: model.CORPUS_STATS,
    REJECTED,
    REJECTION_RULES,
    LEDGER: [...mutationLedger, ...canonicalLedger],
    allStatements: () => STATEMENTS,
    rankedStatements: () => [...ranked],
    rankOf: (slug) => rankMap.get(slug) ?? 0,
    statementBySlug: (slug) => model.CORPUS.find((statement) => statement.slug === slug),
    netaBySlug: (slug) => netaMap.get(slug),
    partyByCode: (code) => partyMap.get(code),
    statementsByNeta: (slug) => ranked.filter((statement) => statement.neta === slug),
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
      for (const statement of STATEMENTS) {
        counts.set(
          statement.partyAtTime,
          (counts.get(statement.partyAtTime) ?? 0) + 1
        );
      }
      const total = STATEMENTS.length || 1;
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
