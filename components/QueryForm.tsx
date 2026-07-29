"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type MouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { DEFAULTS, activeTokens, toSearchParams, type Query } from "@/lib/query";
import { TIERS } from "@/lib/tiers";

export function mergeQueryUpdate(
  current: Query,
  patch: Partial<Query>,
  pendingTerm?: string
): Query {
  return {
    ...current,
    ...patch,
    ...(pendingTerm === undefined ? {} : { q: pendingTerm }),
  };
}

function isModifiedClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}

export default function QueryForm({
  query,
  resultCount,
  total,
  parties,
  states,
  categories,
  languages,
  basePath = "/",
  mode = "standings",
}: {
  query: Query;
  resultCount: number;
  total: number;
  parties: { code: string; name: string }[];
  states: string[];
  categories: readonly string[];
  languages: string[];
  basePath?: string;
  mode?: "standings" | "record";
}) {
  const router = useRouter();
  const [term, setTerm] = useState(query.q);
  const first = useRef(true);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestQuery = useRef(query);
  // Open by default when a secondary filter is already applied, so an
  // arriving link shows why it is filtered.
  const [open, setOpen] = useState(
    query.state !== DEFAULTS.state ||
      query.category !== DEFAULTS.category ||
      query.language !== DEFAULTS.language ||
      query.period !== DEFAULTS.period
  );

  // Server props eventually confirm each navigation. Do this in an effect,
  // rather than during render, so an unrelated local render cannot erase an
  // optimistically staged filter while the router is still resolving it.
  useEffect(() => {
    latestQuery.current = query;
  }, [query]);

  // Keep the field in step when the URL changes from a token being removed.
  useEffect(() => setTerm(query.q), [query.q]);

  const cancelPendingSearch = useCallback(() => {
    if (searchTimer.current === null) return;
    clearTimeout(searchTimer.current);
    searchTimer.current = null;
  }, []);

  const push = useCallback(
    (patch: Partial<Query>, includePendingTerm = false) => {
      cancelPendingSearch();
      const nextQuery = mergeQueryUpdate(
        latestQuery.current,
        patch,
        includePendingTerm ? term : undefined
      );

      // Stage the destination before asking the router to resolve it. If the
      // user types and changes a filter inside the same 250 ms window, the
      // second navigation now merges with the first instead of erasing it.
      latestQuery.current = nextQuery;
      router.push(`${basePath}${toSearchParams(nextQuery)}`, {
        scroll: false,
      });
    },
    [basePath, cancelPendingSearch, router, term]
  );

  const reset = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      // Modified clicks open another tab and must not change this tab's
      // optimistic state.
      if (isModifiedClick(event)) return;
      event.preventDefault();
      cancelPendingSearch();
      latestQuery.current = DEFAULTS;
      router.push(basePath, { scroll: false });
    },
    [basePath, cancelPendingSearch, router]
  );

  // Debounced push so typing doesn't spam history.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (term === query.q) return;
    cancelPendingSearch();
    searchTimer.current = setTimeout(() => push({ q: term }), 250);
    return cancelPendingSearch;
  }, [cancelPendingSearch, push, query.q, term]);

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

  const tokens = activeTokens(query);

  const select = (
    id: keyof Query,
    label: string,
    options: { value: string; label: string; disabled?: boolean }[],
    className = ""
  ) => (
    <label className={`field field-${id} ${className}`.trim()} key={`${id}-${className}`}>
      <span className="lbl">{label}</span>
      <select
        value={query[id]}
        onChange={(e) =>
          push({ [id]: e.target.value } as Partial<Query>, true)
        }
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );

  const sortOptions =
    mode === "record"
      ? [
          { value: "new", label: "Newest" },
          { value: "rulings", label: "Most public votes" },
        ]
      : [
          { value: "gp", label: "Rating (GP)" },
          { value: "new", label: "Newest" },
          { value: "rulings", label: "Most public votes" },
        ];

  return (
    <section className="query" aria-label="Query the record">
      <div className="query-head">
        <span className="query-title">
          {mode === "record" ? "Search the archive" : "Search the standings"}
        </span>
        <span className="lbl">
          <span className="num">{resultCount}</span> {resultCount === 1 ? "entry" : "entries"} of{" "}
          <span className="num">{total}</span>
        </span>
      </div>

      {/* Primary row only. The standings are the point of the page and
          must not sit below 260px of controls. */}
      <div className="query-primary">
        <label className="field field-search">
          <span className="lbl">
            {mode === "record" ? "Search every entry" : "Search the standings"}{" "}
            <span className="query-shortcut">&mdash; press /</span>
          </span>
          <input
            id="q"
            type="search"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Try &ldquo;monsoon&rdquo;, a party, or a name&hellip;"
            autoComplete="off"
          />
        </label>
        {select("party", "Party", [
          { value: "all", label: "All parties" },
          ...parties.map((p) => ({ value: p.code, label: `${p.code} — ${p.name}` })),
        ])}
        {mode === "standings" &&
          select("tier", "Class", [
            { value: "all", label: "All classes" },
            ...TIERS.map((t) => ({ value: t.key, label: t.name })),
          ])}
        {select("sort", "Sort by", sortOptions, "field-sort-desktop")}
        <button
          type="button"
          className="disclose"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="more-filters"
        >
          <span className="disclose-desktop">
            {open ? "Fewer filters" : "More filters"}
          </span>
          <span className="disclose-mobile">
            {open ? "Fewer filters" : "Filters"}
          </span>
        </button>
      </div>

      {open && (
        <div className="filters" id="more-filters">
          {select("sort", "Sort by", sortOptions, "field-sort-mobile")}
          {select("country", "Country", [
            { value: "India", label: "India" },
            { value: "United States", label: "United States (soon)", disabled: true },
            { value: "United Kingdom", label: "United Kingdom (soon)", disabled: true },
          ])}
          {select("state", "State", [
            { value: "all", label: "All states" },
            ...states.map((s) => ({ value: s, label: s })),
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
        </div>
      )}

      <div className={`tokens ${tokens.length === 0 ? "tokens-empty" : ""}`}>
        {tokens.length === 0 ? (
          <span className="lbl">No filters applied &middot; showing the full record</span>
        ) : (
          <>
            {tokens.map((t) => {
              const patch = {
                [t.key]: DEFAULTS[t.key],
              } as Partial<Query>;
              const nextQuery = mergeQueryUpdate(
                query,
                patch,
                t.key === "q" ? "" : term
              );
              return (
                <Link
                  key={t.key}
                  className="token"
                  href={`${basePath}${toSearchParams(nextQuery)}`}
                  onClick={(event) => {
                    if (isModifiedClick(event)) return;
                    event.preventDefault();
                    push(patch, t.key !== "q");
                  }}
                  scroll={false}
                >
                  {t.label}: {t.value}{" "}
                  <span className="x" aria-hidden="true">
                    &times;
                  </span>
                  <span
                    className="lbl"
                    style={{ position: "absolute", left: -9999 }}
                  >
                    Remove filter
                  </span>
                </Link>
              );
            })}
            <Link
              className="token-reset"
              href={basePath}
              onClick={reset}
              scroll={false}
            >
              Reset all
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
