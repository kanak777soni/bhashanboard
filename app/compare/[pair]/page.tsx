import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteFrame from "@/components/SiteFrame";
import Medal from "@/components/Medal";
import EntryTitle from "@/components/EntryTitle";
import { getData, type PublicData } from "@/lib/data";
import { TIERS, tierOf } from "@/lib/tiers";

/**
 * Head to head. Two stat sheets, one shared axis, a hairline down the
 * middle — the highest share-value page on the site and a large long-tail
 * search surface (docs/08 §8.3).
 */

function split(pair: string): [string, string] | null {
  const i = pair.indexOf("-vs-");
  if (i === -1) return null;
  return [pair.slice(0, i), pair.slice(i + 4)];
}

export async function generateMetadata({ params }: { params: Promise<{ pair: string }> }): Promise<Metadata> {
  const data = await getData();
  const parts = split((await params).pair);
  const a = parts && data.netaBySlug(parts[0]);
  const b = parts && data.netaBySlug(parts[1]);
  if (!a || !b) return { title: "Comparison not found" };
  return {
    title: `${a.name} vs ${b.name}`,
    description: `Head to head on the Bhashan Board: ${a.name} and ${b.name}, by entries indexed, best rank and grades held.`,
  };
}

function profile(data: PublicData, slug: string) {
  const neta = data.netaBySlug(slug);
  if (!neta) return null;
  const entries = data.statementsByNeta(slug);
  const best = entries.length ? Math.min(...entries.map((e) => data.rankOf(e.slug))) : null;
  const peak = entries.length ? Math.max(...entries.map((e) => e.gp)) : 0;
  const career = entries.reduce((n, e) => n + e.gp, 0);
  const quoted = entries.filter((e) => e.hasVerbatimQuote).length;
  const cabinet = TIERS.map((t) => ({ tier: t, n: entries.filter((e) => tierOf(e.gp).key === t.key).length })).filter((c) => c.n > 0);
  return { neta, entries, best, peak, career, quoted, cabinet, party: data.partyByCode(neta.party) };
}

export default async function ComparePage({ params }: { params: Promise<{ pair: string }> }) {
  const data = await getData();
  const parts = split((await params).pair);
  if (!parts) notFound();
  const A = profile(data, parts[0]);
  const B = profile(data, parts[1]);
  if (!A || !B) notFound();

  /** Bigger wins, except for rank where lower is better. */
  const cmp = (a: number | null, b: number | null, lowerWins = false) => {
    if (a == null || b == null || a === b) return ["", ""];
    const aWins = lowerWins ? a < b : a > b;
    return aWins ? ["lead", ""] : ["", "lead"];
  };

  const rows: [string, string, string, string, string][] = [
    ["Entries indexed", String(A.entries.length), String(B.entries.length), ...cmp(A.entries.length, B.entries.length)] as never,
    ["Best rank", A.best ? `#${A.best}` : "—", B.best ? `#${B.best}` : "—", ...cmp(A.best, B.best, true)] as never,
    ["Peak rating", A.peak.toLocaleString("en-IN"), B.peak.toLocaleString("en-IN"), ...cmp(A.peak, B.peak)] as never,
    ["Career GP", A.career.toLocaleString("en-IN"), B.career.toLocaleString("en-IN"), ...cmp(A.career, B.career)] as never,
    ["Verbatim quotes established", `${A.quoted} of ${A.entries.length}`, `${B.quoted} of ${B.entries.length}`, "", ""],
  ];

  const side = (P: NonNullable<ReturnType<typeof profile>>) => (
    <div>
      <h2 className="compare-name">
        <Link href={`/neta/${P.neta.slug}`} style={{ textDecoration: "none" }}>{P.neta.name}</Link>
      </h2>
      <p className="lbl">
        <i className="swatch" style={{ background: P.party?.ink }} />
        <Link href={`/party/${P.neta.party}`} style={{ textDecoration: "none" }}>{P.neta.party}</Link> &middot; {P.neta.state}
      </p>
      <div className="cabinet" style={{ marginTop: 10 }}>
        {P.cabinet.map((c) => (
          <div key={c.tier.key}><Medal tier={c.tier.key} size={18} />&times;{c.n}</div>
        ))}
      </div>
    </div>
  );

  return (
    <SiteFrame>
      <div className="sec-head" style={{ marginTop: 26 }}>
        <h1>Head to head</h1>
        <span className="lbl">Aamne-Saamne</span>
      </div>

      <div className="compare-heads">
        {side(A)}
        {side(B)}
      </div>

      <table className="compare-table">
        <tbody>
          {rows.map(([label, av, bv, aCls, bCls]) => (
            <tr key={label}>
              <td className={`compare-val ${aCls}`}>{av}</td>
              <th className="compare-label">{label}</th>
              <td className={`compare-val right ${bCls}`}>{bv}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="compare-heads" style={{ marginTop: 30 }}>
        {[A, B].map((P) => (
          <div key={P.neta.slug}>
            <span className="lbl">Entries &mdash; {P.neta.name}</span>
            <ul className="also-list" style={{ marginTop: 8 }}>
              {P.entries.map((e) => (
                <li key={e.slug}>
                  <Medal gp={e.gp} size={17} title={false} />
                  <Link href={`/statement/${e.slug}`}><EntryTitle statement={e} /></Link>
                  <span className="num">#{data.rankOf(e.slug)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="legend-foot" style={{ marginTop: 24 }}>
        A larger count reflects how much has been indexed, which depends on where the research has
        looked. It is not a measure of a person. <Link href="/rules">The rubric is published.</Link>
      </p>
    </SiteFrame>
  );
}
