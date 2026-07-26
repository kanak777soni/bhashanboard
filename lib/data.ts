import rejectedFile from "@/data/rejected.json";
import {
  CORPUS,
  CORPUS_NETAS,
  CORPUS_PARTIES,
  CORPUS_STATS,
  HELD,
  ON_LADDER,
  type CorpusStatement,
} from "./corpus";
import type { LedgerEntry, Neta, Party } from "./types";

/**
 * The app's data seam.
 *
 * Formerly a fictional specimen set; now backed by the researched India
 * corpus in `data/` (docs/09-seed-corpus.md), adapted in `lib/corpus.ts`.
 * Every read still goes through the accessors here, so moving to Postgres
 * later touches this file and nothing else.
 *
 * These are real statements by real, named, serving or former
 * representatives. Nothing here is invented, and nothing may be. Where the
 * exact wording was never established the corpus carries a null quote and
 * a neutral claim instead — see `hasVerbatimQuote`.
 */

export const PARTIES: Party[] = CORPUS_PARTIES;
export const NETAS: Neta[] = CORPUS_NETAS;
export const STATEMENTS: CorpusStatement[] = ON_LADDER;

/** Indexed but not placed — held for parity or for Committee review. */
export const IN_PLACEMENT: CorpusStatement[] = HELD;

export const STATS = CORPUS_STATS;

export const CATEGORIES = [
  "Science & Reason",
  "History",
  "Economics",
  "Whataboutery",
  "Standing Ovation",
] as const;

// ── the rejection ledger ─────────────────────────────────────────────
// Statements that failed a Rule, with the rule that killed them. Shipping
// this publicly is the only real evidence that the content policy is
// enforced rather than advertised (docs/09-seed-corpus.md §9.2).
interface RawRejection {
  descriptor: string;
  attributed_to?: string;
  date?: string;
  rule?: string;
  ruling?: string;
  reasoning?: string;
}

const RAW_REJECTED = ((rejectedFile as unknown as { rejected?: RawRejection[] }).rejected ?? []) as RawRejection[];

export const REJECTION_RULES = ((rejectedFile as unknown as { rules?: Record<string, string> }).rules ??
  {}) as Record<string, string>;

export interface Rejection {
  descriptor: string;
  attributedTo: string;
  date: string;
  rule: string;
  reasoning: string;
}

export const REJECTED: Rejection[] = RAW_REJECTED.map((r) => ({
  descriptor: r.descriptor,
  attributedTo: r.attributed_to ?? "—",
  date: r.date ?? "—",
  rule: r.rule ?? "—",
  reasoning: r.reasoning ?? r.ruling ?? "",
}));

export const LEDGER: LedgerEntry[] = [
  { date: "2026-07-26", kind: "audit", detail: `Seed corpus indexed: ${CORPUS.length} entries, ${ON_LADDER.length} placed on the ladder, ${HELD.length} held. Every entry remains at verification stage "text sourced" and none is publishable until a Tier A or B clip, a timestamp and a transcript exist.` },
  { date: "2026-07-26", kind: "integrity", detail: `Ladder-head parity flagged: headcount parity is satisfied, but one party holds a disproportionate share of the top positions. The remedy is to source higher-scoring entries from other parties, never to adjust ratings.` },
  { date: "2026-07-26", kind: "withdrawal", detail: `${RAW_REJECTED.length} proposed statements rejected under the Rules of the Committee, each recorded with the rule that killed it. The ledger is published so the same clip is not re-proposed monthly.` },
  { date: "2026-07-26", kind: "correction", detail: `${CORPUS.length - CORPUS_STATS.withVerbatimQuote} of ${CORPUS.length} entries carry no verbatim quote. Where the exact wording could not be established the quote field is null and a neutral claim carries the meaning. A null quote is a research task; an invented quote would end the project.` },
];

// ── accessors ────────────────────────────────────────────────────────

export function allStatements(): CorpusStatement[] {
  return STATEMENTS;
}

export function rankedStatements(): CorpusStatement[] {
  return [...STATEMENTS].sort((a, b) => b.gp - a.gp);
}

export function rankOf(slug: string): number {
  return rankedStatements().findIndex((s) => s.slug === slug) + 1;
}

export function statementBySlug(slug: string): CorpusStatement | undefined {
  return CORPUS.find((s) => s.slug === slug);
}

export function netaBySlug(slug: string): Neta | undefined {
  return NETAS.find((n) => n.slug === slug);
}

export function partyByCode(code: string): Party | undefined {
  return PARTIES.find((p) => p.code === code);
}

export function statementsByNeta(slug: string): CorpusStatement[] {
  return rankedStatements().filter((s) => s.neta === slug);
}

export function netasWithEntries(): Neta[] {
  return NETAS.filter((n) => STATEMENTS.some((s) => s.neta === n.slug));
}

export function states(): string[] {
  return [...new Set(STATEMENTS.map((s) => netaBySlug(s.neta)?.state).filter(Boolean) as string[])].sort();
}

export function languages(): string[] {
  return [...new Set(STATEMENTS.map((s) => s.language))].sort();
}

/** Rolling party distribution across the ladder — docs/01-concept.md §1.5. */
export function parity(): { code: string; pct: number; ink: string }[] {
  const counts = new Map<string, number>();
  for (const s of STATEMENTS) {
    const neta = netaBySlug(s.neta);
    if (!neta) continue;
    counts.set(neta.party, (counts.get(neta.party) ?? 0) + 1);
  }
  const total = STATEMENTS.length || 1;
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([code, n]) => ({
      code,
      ink: partyByCode(code)?.ink ?? "#7C8A86",
      pct: Math.round((n / total) * 100),
    }));
}

export const EDITION = { number: "I", date: "26 July 2026" };
