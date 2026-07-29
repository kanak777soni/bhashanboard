import Link from "next/link";
import Medal from "./Medal";
import { getData } from "@/lib/data";
import { slugify } from "@/lib/corpus";
import { languageTag } from "@/lib/language";
import { tierOf } from "@/lib/tiers";
import type { Row } from "@/lib/query";

/** Wraps the first case-insensitive hit so a search shows why it matched. */
function Highlight({ text, term }: { text: string; term: string }) {
  if (!term) return <>{text}</>;
  const i = text.toLowerCase().indexOf(term.toLowerCase());
  if (i === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + term.length)}</mark>
      {text.slice(i + term.length)}
    </>
  );
}

export default async function StandingsTable({
  rows,
  term = "",
  hideNeta = false,
}: {
  rows: Row[];
  term?: string;
  /** On a representative's own page the column just repeats the heading. */
  hideNeta?: boolean;
}) {
  const data = await getData();

  return (
    <div className="tablewrap">
      <table className="standings">
        <thead>
          <tr>
            <th className="c-rank">#</th>
            <th className="c-class">Class</th>
            <th>Entry</th>
            {!hideNeta && <th className="c-meta">Representative</th>}
            <th className="c-gp">GP</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={hideNeta ? 4 : 5} className="empty">
                No entries match this query. Rare, but it happens.
              </td>
            </tr>
          )}

          {rows.map(({ statement: s, rank }) => {
            const neta = data.netaBySlug(s.neta);
            const party = data.partyByCode(s.partyAtTime);
            const tier = tierOf(s.gp);
            return (
              <tr key={s.slug}>
                <td className="c-rank">{rank}</td>
                <td className="c-class">
                  <div className="table-class">
                    <Medal tier={tier.key} />
                    <span className="table-class-name">{tier.name}</span>
                    {s.hallOfFame && (
                      <span className="table-hall-tag">Hall</span>
                    )}
                  </div>
                </td>
                <td>
                  <Link className="entry-quote" href={`/statement/${s.slug}`}>
                    {s.hasVerbatimQuote ? (
                      <span
                        className={s.language !== "English" ? "original-language" : undefined}
                        lang={languageTag(s.language)}
                      >
                        &ldquo;<Highlight text={s.quote} term={term} />&rdquo;
                      </span>
                    ) : (
                      <>
                        <Highlight text={s.quote} term={term} />
                        <span className="unquoted"> &mdash; wording not established</span>
                      </>
                    )}
                  </Link>
                  <div className="entry-sub">
                    <span className="only-narrow">
                      {neta?.name} &middot; {s.partyAtTime} &middot;{" "}
                    </span>
                    <Link href={`/category/${slugify(s.category)}`}>{s.category}</Link>{" "}
                    &middot; {s.language} &middot; Logic Break{" "}
                    <span className="num">{Math.round(s.axes.logic)}</span>{" "}
                    &middot;{" "}
                    <span className="num">
                      {s.rating.validVoteCount.toLocaleString("en-IN")}
                    </span>{" "}
                    votes
                  </div>
                </td>
                {!hideNeta && (
                  <td className="c-meta">
                    {neta ? (
                      <Link href={`/neta/${neta.slug}`} style={{ textDecoration: "none" }}>
                        <Highlight text={neta.name} term={term} />
                      </Link>
                    ) : (
                      "—"
                    )}
                    <div className="entry-sub">
                      <i className="swatch" style={{ background: party?.ink ?? "transparent" }} />
                      <Link href={`/party/${s.partyAtTime}`}>{s.partyAtTime}</Link> &middot; {neta?.state}
                    </div>
                  </td>
                )}
                <td className="c-gp">{s.gp.toLocaleString("en-IN")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
