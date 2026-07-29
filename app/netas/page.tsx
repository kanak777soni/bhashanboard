import type { Metadata } from "next";
import Link from "next/link";
import SiteFrame from "@/components/SiteFrame";
import { getData } from "@/lib/data";

export const metadata: Metadata = {
  title: "Netas",
  description:
    "Every representative in the Bhashan Board research archive, with record and verified-video counts.",
};

export default async function NetasPage() {
  const data = await getData();
  const inventory = data.publicInventory();
  const roster = data.NETAS.filter((neta) =>
    data.CORPUS.some((statement) => statement.neta === neta.slug)
  );
  const rows = roster
    .map((neta) => {
      const records = data.CORPUS.filter(
        (statement) => statement.neta === neta.slug
      );
      return {
        neta,
        records,
        liveVideos: inventory.liveVideos.filter(
          (statement) => statement.neta === neta.slug
        ).length,
        rankedVideos: inventory.rankedVideos.filter(
          (statement) => statement.neta === neta.slug
        ).length,
        categories: new Set(records.map((statement) => statement.category)).size,
      };
    })
    .sort((a, b) => a.neta.name.localeCompare(b.neta.name));

  return (
    <SiteFrame>
      <div className="sec-head" style={{ marginTop: 26 }}>
        <h1>Representatives on record</h1>
        <span className="lbl">{roster.length} research files</span>
      </div>

      <p className="legend-foot" style={{ margin: "0 0 18px" }}>
        This directory is alphabetical, not a league table. Record counts show
        where the archive has looked; only publication-ready videos with ten
        valid public rulings can enter the Standings.
      </p>

      <div className="tablewrap">
        <table className="standings netas-table">
          <thead>
            <tr>
              <th>Representative</th>
              <th className="c-meta">Office</th>
              <th className="c-gp c-mobile-hide">Categories</th>
              <th className="c-gp c-mobile-hide">Records</th>
              <th className="c-gp">Ready videos</th>
              <th className="c-gp">Ranked</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="empty">
                  No representatives have a visible research record yet.
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const party = data.partyByCode(row.neta.party);
              return (
                <tr key={row.neta.slug}>
                  <td>
                    <Link
                      className="entry-quote"
                      href={`/neta/${row.neta.slug}`}
                    >
                      {row.neta.name}
                    </Link>
                    <div className="entry-sub">
                      <i
                        className="swatch"
                        style={{ background: party?.ink }}
                      />
                      {row.neta.party} &middot; {row.neta.state}
                    </div>
                  </td>
                  <td
                    className="c-meta"
                    style={{ fontSize: 14, color: "var(--ink-70)" }}
                  >
                    {row.neta.office}
                  </td>
                  <td className="c-gp c-mobile-hide">{row.categories}</td>
                  <td className="c-gp c-mobile-hide">
                    {row.records.length}
                  </td>
                  <td className="c-gp">{row.liveVideos}</td>
                  <td className="c-gp">{row.rankedVideos}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </SiteFrame>
  );
}
