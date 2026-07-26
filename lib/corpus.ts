import statementsFile from "@/data/statements.json";
import politiciansFile from "@/data/politicians.json";
import partiesFile from "@/data/parties.json";
import type { Axes, Neta, Party, Source, SourceTier, Statement } from "./types";

/**
 * Adapter over the researched India corpus (docs/09-seed-corpus.md).
 *
 * Two properties of that corpus drive everything below, and both must
 * survive into the UI rather than being smoothed away:
 *
 * 1. **26 of 41 entries have no established quote.** The research could not
 *    fix the exact wording, so `quote` is null and a neutral `claim`
 *    carries the meaning. Rendering a claim inside quotation marks would
 *    manufacture a quotation — precisely the thing this project must never
 *    do. `hasVerbatimQuote` exists so every surface can tell the
 *    difference, and the components are required to check it.
 *
 * 2. **No entry is publishable yet.** Every record sits at verification
 *    stage `text_sourced`: a named person and a reputable report, but no
 *    Tier A/B clip, timestamp or transcript. The certificate must not say
 *    "Ratified by the Committee" over material that has not been verified.
 */

interface RawVerification {
  stage: string;
  best_source_tier: string;
  needs?: string[];
  sources?: { tier?: string; publisher?: string; title?: string; url?: string }[];
}

interface RawStatement {
  id: string;
  status: "published" | "held_parity" | "held_review";
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
  quote_note?: string;
  claim: string;
  context?: string;
  counterpoint?: string;
  policy_note?: string;
  axes: Record<string, number>;
  verification: RawVerification;
}

const RAW = ((statementsFile as unknown as { statements?: RawStatement[] }).statements ??
  (statementsFile as unknown as RawStatement[])) as RawStatement[];

interface RawPolitician { id: string; name: string; party: string; state: string; notes?: string }
interface RawParty { id: string; name: string; scope?: string; ink?: string }

const RAW_POLITICIANS = ((politiciansFile as unknown as { politicians?: RawPolitician[] }).politicians ??
  []) as RawPolitician[];

const RAW_PARTIES = ((partiesFile as unknown as { parties?: RawParty[] }).parties ?? []) as RawParty[];

/** Only entries on the ladder are ranked. Held entries are indexed but not placed. */
const LADDER = RAW.filter((r) => r.status === "published");

// ── ranking ──────────────────────────────────────────────────────────
// Mirrors tools/seed-rank.mjs: weighted axes → order → GP interpolated
// within the tier bands, so the seed spread matches the target rarities
// in docs/02 §2.4 instead of bunching at the top.
const WEIGHTS: Record<string, number> = {
  logic_damage: 0.3,
  straight_face: 0.2,
  rewatch_value: 0.2,
  crowd_complicity: 0.15,
  consequence: 0.15,
};

function weighted(axes: Record<string, number>): number {
  return Object.entries(WEIGHTS).reduce((sum, [k, w]) => sum + (axes[k] ?? 0) * w, 0);
}

const BANDS: [number, number, number][] = [
  [0.025, 1875, 1960],
  [0.08, 1750, 1868],
  [0.16, 1600, 1742],
  [0.21, 1450, 1590],
  [0.24, 1300, 1440],
  [1, 1150, 1290],
];

const ordered = [...LADDER].sort((a, b) => weighted(b.axes) - weighted(a.axes));

const gpBySlug = new Map<string, number>();
{
  let index = 0;
  for (const [share, lo, hi] of BANDS) {
    const count = Math.max(share === 1 ? ordered.length - index : Math.round(ordered.length * share), 0);
    const n = Math.min(count, ordered.length - index);
    for (let k = 0; k < n; k++) {
      const gp = n === 1 ? hi : Math.round(hi - ((hi - lo) * k) / Math.max(n - 1, 1));
      gpBySlug.set(ordered[index + k].id, gp);
    }
    index += n;
    if (index >= ordered.length) break;
  }
}

// ── shaping ──────────────────────────────────────────────────────────
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72);
}

function scriptOf(language: string): Statement["script"] {
  if (language === "English") return "latin";
  if (["Hindi", "Marathi", "Nepali", "Konkani"].includes(language)) return "deva";
  return "other";
}

function toSources(v: RawVerification): Source[] {
  return (v.sources ?? []).map((s) => ({
    tier: (["A", "B", "C"].includes(s.tier ?? "") ? s.tier : "C") as SourceTier,
    outlet: s.publisher ?? s.title ?? "Unattributed",
    url: s.url ?? "#",
  }));
}

function toAxes(a: Record<string, number>): Axes {
  // Corpus scores 0–5; the UI renders percentages.
  const pct = (n: number) => Math.round(((n ?? 0) / 5) * 100);
  return {
    logic: pct(a.logic_damage),
    straightFace: pct(a.straight_face),
    rewatch: pct(a.rewatch_value),
    crowd: pct(a.crowd_complicity),
    consequence: pct(a.consequence),
  };
}

const TODAY = Date.UTC(2026, 6, 26);
function daysSince(date: string): number {
  const t = Date.parse(date.length === 7 ? `${date}-01` : date);
  return Number.isNaN(t) ? 999 : Math.max(0, Math.round((TODAY - t) / 86_400_000));
}

export interface CorpusStatement extends Statement {
  corpusId: string;
  /** False when the exact wording was never established. Check before quoting. */
  hasVerbatimQuote: boolean;
  neutralTitle: string;
  claim: string;
  counterpoint?: string;
  quoteNote?: string;
  policyNote?: string;
  contextNote?: string;
  verificationStage: string;
  bestSourceTier: string;
  needs: string[];
  held?: "parity" | "review";
  office: string;
}

function shape(r: RawStatement): CorpusStatement {
  const gp = gpBySlug.get(r.id) ?? 1500;
  const hasQuote = typeof r.quote === "string" && r.quote.trim().length > 0;
  return {
    id: Number(r.id.replace(/\D/g, "")) || 0,
    corpusId: r.id,
    slug: slugify(`${r.neutral_title}-${r.id}`),
    // `quote` is the display headline. When no wording was established it
    // carries the neutral title, and hasVerbatimQuote is false so no
    // component wraps it in quotation marks.
    quote: hasQuote ? (r.quote as string) : r.neutral_title,
    hasVerbatimQuote: hasQuote,
    neutralTitle: r.neutral_title,
    claim: r.claim,
    counterpoint: r.counterpoint,
    quoteNote: r.quote_note,
    policyNote: r.policy_note,
    contextNote: r.context,
    originalLines: hasQuote ? [r.quote as string] : [],
    englishLines: hasQuote ? [r.quote as string] : [],
    neta: r.speaker_id,
    category: r.category,
    language: r.language,
    script: scriptOf(r.language),
    venue: r.venue,
    daysAgo: daysSince(r.date),
    gp,
    previousRank: 0,
    duels: 0,
    sources: toSources(r.verification),
    axes: toAxes(r.axes),
    verificationStage: r.verification.stage,
    bestSourceTier: r.verification.best_source_tier,
    needs: r.verification.needs ?? [],
    held: r.status === "held_parity" ? "parity" : r.status === "held_review" ? "review" : undefined,
    office: r.office_at_time,
  };
}

export const CORPUS: CorpusStatement[] = RAW.map(shape);
export const ON_LADDER: CorpusStatement[] = CORPUS.filter((s) => !s.held).sort((a, b) => b.gp - a.gp);
export const HELD: CorpusStatement[] = CORPUS.filter((s) => s.held);

export const CORPUS_PARTIES: Party[] = RAW_PARTIES.map((p) => ({
  code: p.id,
  name: p.name,
  ink: p.ink ?? "#7C8A86",
}));

export const CORPUS_NETAS: Neta[] = RAW_POLITICIANS.map((p) => {
  const mine = ON_LADDER.filter((s) => s.neta === p.id);
  return {
    slug: p.id,
    name: p.name,
    office: CORPUS.find((s) => s.neta === p.id)?.office ?? p.notes ?? "",
    party: p.party,
    state: p.state,
    arc: mine.length ? [...mine].sort((a, b) => b.daysAgo - a.daysAgo).map((s) => s.gp) : [],
    replied: false,
  };
});

export const CORPUS_STATS = {
  indexed: CORPUS.length,
  onLadder: ON_LADDER.length,
  heldParity: CORPUS.filter((s) => s.held === "parity").length,
  heldReview: CORPUS.filter((s) => s.held === "review").length,
  withVerbatimQuote: CORPUS.filter((s) => s.hasVerbatimQuote).length,
  representatives: new Set(CORPUS.map((s) => s.neta)).size,
  parties: new Set(CORPUS.map((s) => CORPUS_NETAS.find((n) => n.slug === s.neta)?.party)).size,
};
