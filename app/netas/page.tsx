import type { Metadata } from "next";
import Link from "next/link";
import SiteFrame from "@/components/SiteFrame";
import Medal from "@/components/Medal";
import { getData } from "@/lib/data";

export const metadata: Metadata = {
  title: "Netas",
  description: "Every representative on record, with career rating, entries indexed and current form.",
};

export default async function NetasPage() {
  const data = await getData();
  const roster = data.netasWithEntries();
  const rows = roster.map((n) => {
    const entries = data.statementsByNeta(n.slug);
    return {
      neta: n,
      entries,
      career: entries.reduce((s, e) => s + e.gp, 0),
      peak: entries.length ? Math.max(...entries.map((e) => e.gp)) : 0,
    };
  }).sort((a, b) => b.career - a.career);

  return (
    <SiteFrame>
      <div className="sec-head" style={{ marginTop: 26 }}>
        <h1>Netas</h1>
        <span className="lbl">{roster.length} on record</span>
      </div>

      <div className="tablewrap">
        <table className="standings netas-table">
          <thead>
            <tr>
              <th className="c-rank">#</th>
              <th>Representative</th>
              <th className="c-meta">Office</th>
              <th className="c-mobile-hide">Form</th>
              <th className="c-gp c-mobile-hide">Entries</th>
              <th className="c-gp">
                <span className="netas-wide-label">Career GP</span>
                <span className="only-narrow" aria-hidden="true">GP</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const party = data.partyByCode(r.neta.party);
              return (
                <tr key={r.neta.slug}>
                  <td className="c-rank">{i + 1}</td>
                  <td>
                    <Link className="entry-quote" href={`/neta/${r.neta.slug}`}>
                      {r.neta.name}
                    </Link>
                    <div className="entry-sub">
                      <i className="swatch" style={{ background: party?.ink }} />
                      {r.neta.party} &middot; {r.neta.state}
                    </div>
                  </td>
                  <td className="c-meta" style={{ fontSize: 14, color: "var(--ink-70)" }}>
                    {r.neta.office}
                  </td>
                  <td className="c-mobile-hide">
                    <div className="formguide">
                      {r.entries.slice(0, 5).map((e) => (
                        <Medal key={e.slug} gp={e.gp} size={17} />
                      ))}
                    </div>
                  </td>
                  <td className="c-gp c-mobile-hide">{r.entries.length}</td>
                  <td className="c-gp">{r.career.toLocaleString("en-IN")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </SiteFrame>
  );
}
