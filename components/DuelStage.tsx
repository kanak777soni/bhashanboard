"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { applyDuel } from "@/lib/elo";

export interface DuelEntry {
  slug: string;
  quote: string;
  neta: string;
  party: string;
  state: string;
  gp: number;
  duels: number;
  hasQuote: boolean;
}

interface Pair {
  a: DuelEntry;
  b: DuelEntry;
}

/**
 * Aamne-Saamne. The only screen on the site that behaves like an app —
 * full-bleed, keyboard-first, no masthead (docs/08-information-architecture.md §8.1).
 *
 * Matchmaking rules, in order (§2.2):
 *   1. Users can never request a matchup. The server picks. This is the
 *      anti-brigading mechanism — you cannot target what you cannot select.
 *   2. Rating proximity: pair within ~±150 GP.
 *   3. Cross-party bias: prefer pairs from different parties, which forces
 *      a comparative judgment across party lines.
 *
 * Ratings here update in local state so the mechanic is playable. In
 * production, votes append to an immutable log and ratings are recomputed
 * nightly, so a fraud sweep can unwind a brigade retroactively.
 */
export default function DuelStage({ entries }: { entries: DuelEntry[] }) {
  const [pool, setPool] = useState(entries);
  const [seen, setSeen] = useState(0);
  const [stamped, setStamped] = useState<"a" | "b" | null>(null);
  const [cursor, setCursor] = useState(0);

  const pick = useCallback(
    (list: DuelEntry[], n: number): Pair => {
      // Deterministic on first render so server and client agree, then
      // walks the pool as duels are completed.
      const a = list[n % list.length];
      const near = list
        .filter((e) => e.slug !== a.slug)
        .sort((x, y) => Math.abs(x.gp - a.gp) - Math.abs(y.gp - a.gp))
        .slice(0, 6);
      const crossParty = near.filter((e) => e.party !== a.party);
      const candidates = crossParty.length ? crossParty : near;
      const b = candidates[n % candidates.length];
      return { a, b };
    },
    []
  );

  const pair = useMemo(() => pick(pool, cursor), [pool, cursor, pick]);

  const choose = useCallback(
    (side: "a" | "b") => {
      if (stamped) return;
      setStamped(side);
      const winner = side === "a" ? pair.a : pair.b;
      const loser = side === "a" ? pair.b : pair.a;
      const next = applyDuel(winner.gp, winner.duels, loser.gp, loser.duels);

      window.setTimeout(() => {
        setPool((prev) =>
          prev.map((e) => {
            if (e.slug === winner.slug) return { ...e, gp: Math.round(next.winner), duels: e.duels + 1 };
            if (e.slug === loser.slug) return { ...e, gp: Math.round(next.loser), duels: e.duels + 1 };
            return e;
          })
        );
        setSeen((s) => s + 1);
        setCursor((c) => c + 1);
        setStamped(null);
      }, 480);
    },
    [pair, stamped]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") { e.preventDefault(); choose("a"); }
      if (e.key === "ArrowRight") { e.preventDefault(); choose("b"); }
      if (e.key.toLowerCase() === "s") { e.preventDefault(); setCursor((c) => c + 1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [choose]);

  const panel = (side: "a" | "b", entry: DuelEntry, key: string) => (
    <button type="button" className="duel-panel" onClick={() => choose(side)}>
      <p className="duel-quote">{entry.hasQuote ? `\u201C${entry.quote}\u201D` : entry.quote}</p>
      <div className="duel-meta">
        {entry.neta} &middot; {entry.party} &middot; {entry.state}
      </div>
      <div className="duel-key">{key}</div>
      {stamped === side && (
        <span className="stamp-mark">
          <span>More magnificent</span>
        </span>
      )}
    </button>
  );

  const sameParty = pair.a.party === pair.b.party;

  return (
    <div className="duel-shell">
      <div className="duel-bar">
        <Link href="/">&larr; The Standings</Link>
        <span className="duel-meta">
          {sameParty ? "Honeypot pair — same party" : `${pair.a.party} vs ${pair.b.party} · you decide`}
        </span>
        <span className="duel-meta">Committee session</span>
      </div>

      <div className="duel-stage">
        {panel("a", pair.a, "← left arrow")}
        {panel("b", pair.b, "right arrow →")}
      </div>

      <div className="duel-foot">
        <p className="duel-prompt">Which is more magnificent?</p>
        <div className="duel-stats">
          SESSION: {seen} {seen === 1 ? "DUEL" : "DUELS"} · ← → TO CHOOSE · S TO SKIP
        </div>
      </div>
    </div>
  );
}
