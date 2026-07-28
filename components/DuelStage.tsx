"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { languageTag } from "@/lib/language";

export interface DuelEntry {
  slug: string;
  quote: string;
  neta: string;
  party: string;
  state: string;
  gp: number;
  hasQuote: boolean;
  language: string;
}

interface Pair {
  a: DuelEntry;
  b: DuelEntry;
}

/**
 * Aamne-Saamne is the site's deliberately theatrical, non-scoring exhibition.
 * The official rating is entered on one statement only after its verified
 * footage has been watched. Picks made here never leave this component.
 */
export default function DuelStage({ entries }: { entries: DuelEntry[] }) {
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

  const pair = useMemo(() => pick(entries, cursor), [entries, cursor, pick]);

  const choose = useCallback(
    (side: "a" | "b") => {
      if (stamped) return;
      setStamped(side);
      window.setTimeout(() => {
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
      <p
        className={`duel-quote${
          entry.hasQuote && entry.language !== "English" ? " original-language" : ""
        }`}
        lang={entry.hasQuote ? languageTag(entry.language) : "en"}
      >
        {entry.hasQuote ? `\u201C${entry.quote}\u201D` : entry.quote}
      </p>
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
          {sameParty ? "Same-party exhibition" : `${pair.a.party} vs ${pair.b.party} · you decide`}
        </span>
        <span className="duel-meta">Exhibition · no rating effect</span>
      </div>

      <div className="duel-stage">
        {panel("a", pair.a, "← left arrow")}
        {panel("b", pair.b, "right arrow →")}
      </div>

      <div className="duel-foot">
        <p className="duel-prompt">Which is more magnificent?</p>
        <div className="duel-stats">
          SESSION: {seen} {seen === 1 ? "PICK" : "PICKS"} · ← → TO CHOOSE · S TO SKIP · NOTHING IS RECORDED
        </div>
      </div>
    </div>
  );
}
