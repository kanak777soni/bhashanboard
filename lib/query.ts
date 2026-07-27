import { tierOf } from "./tiers";
import type { CorpusStatement } from "./corpus";
import type { Neta } from "./types";

/**
 * Filters live in the URL, not in component state. Every query is
 * therefore shareable, bookmarkable, server-rendered and indexable —
 * which matters because search is a primary growth channel
 * (docs/05-growth-and-money.md §5.3).
 */

export interface Query {
  q: string;
  country: string;
  party: string;
  state: string;
  tier: string;
  category: string;
  language: string;
  period: string;
  sort: string;
}

export const DEFAULTS: Query = {
  q: "",
  country: "India",
  party: "all",
  state: "all",
  tier: "all",
  category: "all",
  language: "all",
  period: "all",
  sort: "gp",
};

type RawParams = Record<string, string | string[] | undefined>;

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export function parseQuery(params: RawParams): Query {
  return {
    q: (one(params.q) ?? "").trim(),
    country: one(params.country) ?? DEFAULTS.country,
    party: one(params.party) ?? DEFAULTS.party,
    state: one(params.state) ?? DEFAULTS.state,
    tier: one(params.tier) ?? DEFAULTS.tier,
    category: one(params.category) ?? DEFAULTS.category,
    language: one(params.language) ?? DEFAULTS.language,
    period: one(params.period) ?? DEFAULTS.period,
    sort: one(params.sort) ?? DEFAULTS.sort,
  };
}

/** Serialise back to a query string, omitting anything left at default. */
export function toSearchParams(query: Query): string {
  const sp = new URLSearchParams();
  (Object.keys(DEFAULTS) as (keyof Query)[]).forEach((k) => {
    if (query[k] && query[k] !== DEFAULTS[k]) sp.set(k, String(query[k]));
  });
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export interface Row {
  statement: CorpusStatement;
  rank: number;
  delta: number;
}

export interface QueryDataset {
  statements: CorpusStatement[];
  netas: Neta[];
}

export function runQuery(query: Query, dataset: QueryDataset): Row[] {
  const term = query.q.toLowerCase();
  const ranked = [...dataset.statements].sort((a, b) => b.gp - a.gp);
  const netaMap = new Map(dataset.netas.map((neta) => [neta.slug, neta]));
  const rankMap = new Map(ranked.map((statement, index) => [statement.slug, index + 1]));

  const matched = ranked.filter((s) => {
    const neta = netaMap.get(s.neta);
    if (!neta) return false;
    if (query.party !== "all" && s.partyAtTime !== query.party) return false;
    if (query.state !== "all" && neta.state !== query.state) return false;
    if (query.category !== "all" && s.category !== query.category) return false;
    if (query.language !== "all" && s.language !== query.language) return false;
    if (query.tier !== "all" && tierOf(s.gp).key !== query.tier) return false;
    if (query.period !== "all" && s.daysAgo > Number(query.period)) return false;
    if (term) {
      const hay = [
        s.quote,
        s.englishLines.join(" "),
        s.originalLines.join(" "),
        neta.name,
        neta.state,
        neta.party,
        s.partyAtTime,
        s.category,
        s.language,
        s.venue,
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(term)) return false;
    }
    return true;
  });

  const rows: Row[] = matched.map((s) => {
    const rank = rankMap.get(s.slug) ?? 0;
    return { statement: s, rank, delta: s.previousRank ? s.previousRank - rank : 0 };
  });

  switch (query.sort) {
    case "new":
      rows.sort((a, b) => a.statement.daysAgo - b.statement.daysAgo);
      break;
    case "duels":
      rows.sort((a, b) => b.statement.duels - a.statement.duels);
      break;
    case "climb":
      rows.sort((a, b) => b.delta - a.delta);
      break;
    default:
      rows.sort((a, b) => b.statement.gp - a.statement.gp);
  }

  return rows;
}

/** Active, non-default filters — rendered as stamped tokens. */
export function activeTokens(query: Query): { key: keyof Query; label: string; value: string }[] {
  const labels: Partial<Record<keyof Query, string>> = {
    q: "Search",
    country: "Country",
    party: "Party",
    state: "State",
    tier: "Tier",
    category: "Category",
    language: "Language",
    period: "Period",
  };
  return (Object.keys(labels) as (keyof Query)[])
    .filter((k) => query[k] && query[k] !== DEFAULTS[k])
    .map((k) => ({
      key: k,
      label: labels[k]!,
      value: k === "period" ? `Last ${query[k]} days` : String(query[k]),
    }));
}
