import Link from "next/link";
import Medal from "./Medal";
import EntryTitle from "./EntryTitle";
import { netaBySlug, rankedStatements, statementsByNeta } from "@/lib/data";

/**
 * A statement page was a dead end: no way onward, no way to cite it. Both
 * matter — onward navigation is how an archive gets read, and a formal
 * citation is what makes a newsroom willing to reference you.
 */
export default function StatementFooterNav({ slug }: { slug: string }) {
  const ranked = rankedStatements();
  const i = ranked.findIndex((s) => s.slug === slug);
  const current = ranked[i];
  const above = i > 0 ? ranked[i - 1] : null;
  const below = i >= 0 && i < ranked.length - 1 ? ranked[i + 1] : null;
  const neta = current ? netaBySlug(current.neta) : undefined;
  const siblings = neta ? statementsByNeta(neta.slug).filter((s) => s.slug !== slug).slice(0, 4) : [];

  const citation = current && neta
    ? `${neta.name}, ${neta.office}. ${current.hasVerbatimQuote ? `"${current.quote}"` : `[${current.neutralTitle}] — exact wording not established.`} ${current.venue}. ` +
      `The Bhashan Board, Entry No. ${String(current.id).padStart(5, "0")}, ranked #${i + 1}.`
    : "";

  return (
    <>
      <nav className="adjacent" aria-label="Adjacent entries">
        {above ? (
          <Link href={`/statement/${above.slug}`} className="adjacent-item">
            <span className="lbl">Ranked above &middot; #{i}</span>
            <EntryTitle statement={above} className="adjacent-quote" />
          </Link>
        ) : (
          <span className="adjacent-item empty-slot">
            <span className="lbl">Ranked above</span>
            <span className="adjacent-quote">Nothing. This is the summit.</span>
          </span>
        )}
        {below ? (
          <Link href={`/statement/${below.slug}`} className="adjacent-item align-end">
            <span className="lbl">Ranked below &middot; #{i + 2}</span>
            <EntryTitle statement={below} className="adjacent-quote" />
          </Link>
        ) : (
          <span className="adjacent-item align-end empty-slot">
            <span className="lbl">Ranked below</span>
            <span className="adjacent-quote">Nothing further has been recorded.</span>
          </span>
        )}
      </nav>

      {siblings.length > 0 && neta && (
        <section className="also">
          <h2 className="lbl">
            Also on record from <Link href={`/neta/${neta.slug}`}>{neta.name}</Link>
          </h2>
          <ul className="also-list">
            {siblings.map((s) => (
              <li key={s.slug}>
                <Medal gp={s.gp} size={17} title={false} />
                <Link href={`/statement/${s.slug}`}><EntryTitle statement={s} /></Link>
                <span className="num">{s.gp.toLocaleString("en-IN")}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="cite">
        <h2 className="lbl">Cite this entry</h2>
        <p className="cite-text">{citation}</p>
        <p className="legend-foot">
          Reproduce freely with attribution. The clip itself belongs to its publisher; we link, we do
          not host.
        </p>
      </section>
    </>
  );
}
