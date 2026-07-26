import Link from "next/link";
import Medal from "./Medal";
import { netaBySlug, partyByCode } from "@/lib/data";
import { slugify } from "@/lib/corpus";
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

function Movement({ delta }: { delta: number }) {
  if (delta > 0) return <span className="mv up">&#9650;{delta}</span>;
  if (delta < 0) return <span className="mv down">&#9660;{Math.abs(delta)}</span>;
  return <span className="mv flat">&mdash;</span>;
}

export default function StandingsTable({
  rows,
  term = "",
  hideNeta = false,
}: {
  rows: Row[];
  term?: string;
  /** On a representative's own page the column just repeats the heading. */
  hideNeta?: boolean;
}) {
  return (
    <div className="tablewrap">
      <table className="standings">
        <thead>
          <tr>
            <th className="c-rank">#</th>
            <th className="c-move">&plusmn;</th>
            <th className="c-medal"><span className="lbl" style={{ position: "absolute", left: -9999 }}>Tier</span></th>
            <th>Entry</th>
            {!hideNeta && <th className="c-meta">Representative</th>}
            <th className="c-gp">GP</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={hideNeta ? 5 : 6} className="empty">
                No entries match this query. Rare, but it happens.
              </td>
            </tr>
          )}

          {rows.map(({ statement: s, rank, delta }) => {
            const neta = netaBySlug(s.neta);
            const party = neta ? partyByCode(neta.party) : undefined;
            return (
              <tr key={s.slug}>
                <td className="c-rank">{rank}</td>
                <td className="c-move"><Movement delta={delta} /></td>
                <td className="c-medal"><Medal gp={s.gp} /></td>
                <td>
                  <Link className="entry-quote" href={`/statement/${s.slug}`}>
                    {s.hasVerbatimQuote ? (
                      <>&ldquo;<Highlight text={s.quote} term={term} />&rdquo;</>
                    ) : (
                      <>
                        <Highlight text={s.quote} term={term} />
                        <span className="unquoted"> &mdash; wording not established</span>
                      </>
                    )}
                  </Link>
                  <div className="entry-sub">
                    <span className="only-narrow">
                      {neta?.name} &middot; {neta?.party} &middot;{" "}
                    </span>
                    <Link href={`/category/${slugify(s.category)}`}>{s.category}</Link> &middot; {s.language}
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
                      <Link href={`/party/${neta?.party}`}>{neta?.party}</Link> &middot; {neta?.state}
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
