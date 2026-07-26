"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DEFAULTS, activeTokens, toSearchParams, type Query } from "@/lib/query";
import { TIERS } from "@/lib/tiers";

export default function QueryForm({
  query,
  resultCount,
  total,
  parties,
  states,
  categories,
  languages,
}: {
  query: Query;
  resultCount: number;
  total: number;
  parties: { code: string; name: string }[];
  states: string[];
  categories: readonly string[];
  languages: string[];
}) {
  const router = useRouter();
  const [term, setTerm] = useState(query.q);
  const first = useRef(true);

  // Keep the field in step when the URL changes from a token being removed.
  useEffect(() => setTerm(query.q), [query.q]);

  // Debounced push so typing doesn't spam history.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (term === query.q) return;
    const id = setTimeout(() => push({ q: term }), 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
        e.preventDefault();
        document.getElementById("q")?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function push(patch: Partial<Query>) {
    router.push(`/${toSearchParams({ ...query, ...patch })}`, { scroll: false });
  }

  const tokens = activeTokens(query);

  const select = (
    id: keyof Query,
    label: string,
    options: { value: string; label: string; disabled?: boolean }[]
  ) => (
    <label className="field" key={id}>
      <span className="lbl">{label}</span>
      <select
        value={query[id]}
        onChange={(e) => push({ [id]: e.target.value } as Partial<Query>)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <section className="query" aria-label="Query the record">
      <div className="query-head">
        <span className="query-title">Query the record</span>
        <span className="lbl">
          <span className="num">{resultCount}</span> {resultCount === 1 ? "entry" : "entries"} of{" "}
          <span className="num">{total}</span>
        </span>
      </div>

      <div className="searchline">
        <label className="field">
          <span className="lbl">Search transcripts, representatives, venues &mdash; press /</span>
          <input
            id="q"
            type="search"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Try &ldquo;monsoon&rdquo;, &ldquo;committee&rdquo;, or a name&hellip;"
            autoComplete="off"
          />
        </label>
      </div>

      <div className="filters">
        {select("country", "Country", [
          { value: "India", label: "India" },
          { value: "United States", label: "United States (soon)", disabled: true },
          { value: "United Kingdom", label: "United Kingdom (soon)", disabled: true },
        ])}
        {select("party", "Party", [
          { value: "all", label: "All parties" },
          ...parties.map((p) => ({ value: p.code, label: `${p.code} — ${p.name}` })),
        ])}
        {select("state", "State", [
          { value: "all", label: "All states" },
          ...states.map((s) => ({ value: s, label: s })),
        ])}
        {select("tier", "Tier", [
          { value: "all", label: "All tiers" },
          ...TIERS.map((t) => ({ value: t.key, label: t.name })),
        ])}
        {select("category", "Category", [
          { value: "all", label: "All categories" },
          ...categories.map((c) => ({ value: c, label: c })),
        ])}
        {select("language", "Language", [
          { value: "all", label: "All languages" },
          ...languages.map((l) => ({ value: l, label: l })),
        ])}
        {select("period", "Period", [
          { value: "all", label: "All time" },
          { value: "365", label: "This year" },
          { value: "90", label: "Last 90 days" },
          { value: "30", label: "This month" },
        ])}
        {select("sort", "Sort by", [
          { value: "gp", label: "Rating (GP)" },
          { value: "new", label: "Newest" },
          { value: "climb", label: "Biggest climber" },
          { value: "duels", label: "Most duels" },
        ])}
      </div>

      <div className="tokens">
        {tokens.length === 0 ? (
          <span className="lbl">No filters applied &middot; showing the full record</span>
        ) : (
          <>
            {tokens.map((t) => (
              <Link
                key={t.key}
                className="token"
                href={`/${toSearchParams({ ...query, [t.key]: DEFAULTS[t.key] })}`}
                scroll={false}
              >
                {t.label}: {t.value} <span className="x" aria-hidden="true">&times;</span>
                <span className="lbl" style={{ position: "absolute", left: -9999 }}>
                  Remove filter
                </span>
              </Link>
            ))}
            <Link className="token-reset" href="/" scroll={false}>
              Reset all
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
