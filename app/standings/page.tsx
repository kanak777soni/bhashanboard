import Link from "next/link";
import SiteFrame from "@/components/SiteFrame";
import QueryForm from "@/components/QueryForm";
import StandingsTable from "@/components/StandingsTable";
import TierLegend from "@/components/TierLegend";
import CoverageNote from "@/components/CoverageNote";
import { CATEGORIES, getData } from "@/lib/data";
import { parseQuery, runQuery } from "@/lib/query";

export const metadata = {
  title: "The Standings",
  description:
    "Publicly ranked, video-verified statements on the Bhashan Board.",
};

export default async function StandingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const data = await getData();
  const inventory = data.publicInventory();
  const parsed = parseQuery(await searchParams);
  const query = {
    ...parsed,
    sort: ["gp", "new", "rulings"].includes(parsed.sort)
      ? parsed.sort
      : "gp",
  };
  const rows = runQuery(query, {
    statements: inventory.rankedVideos,
    netas: data.NETAS,
  });
  const newFilings = inventory.liveVideos.filter(
    (statement) => statement.rating.validVoteCount === 0
  ).length;
  const inPlacement = inventory.liveVideos.filter(
    (statement) =>
      statement.rating.validVoteCount > 0 &&
      statement.rating.validVoteCount < 10
  ).length;

  return (
    <SiteFrame>
      <QueryForm
        query={query}
        resultCount={rows.length}
        total={inventory.rankedVideos.length}
        parties={data.PARTIES.map((party) => ({
          code: party.code,
          name: party.name,
        }))}
        states={data.states()}
        categories={CATEGORIES}
        languages={data.languages()}
        basePath="/standings"
      />

      <div className="columns">
        <div>
          <div className="sec-head">
            <h1>The Standings</h1>
            <span className="lbl">Verified video &middot; ten public rulings required</span>
          </div>
          <StandingsTable rows={rows} term={query.q} />
          {inventory.rankedVideos.length === 0 && (
            <p className="rail-note" style={{ marginTop: 18 }}>
              The standings are deliberately empty. A filing receives no public
              rank or medal until its video is publication-ready and ten valid
              public rulings have been recorded. Its provisional performance
              bar may appear after the first valid ruling.{" "}
              <Link href="/watch">Watch the open filings.</Link>
            </p>
          )}
        </div>

        <aside className="rail">
          <section className="rail-block summons">
            <h2>The Committee is sitting</h2>
            <p className="rail-note">
              Watch the source clip before ruling. Each verified account may
              rule once on each statement.
            </p>
            <Link className="btn seal summons-btn" href="/watch">
              Enter the screening room
            </Link>
            <p className="lbl summons-foot">
              <span className="num">{inventory.liveVideos.length}</span>{" "}
              {inventory.liveVideos.length === 1 ? "video" : "videos"} open
            </p>
          </section>

          <CoverageNote />

          {inventory.rankedVideos.length > 0 && <TierLegend compact />}

          <section className="rail-block">
            <h2>State of the public board</h2>
            <dl className="record-state">
              <div>
                <dt className="lbl">Ready to rule</dt>
                <dd className="num">{inventory.liveVideos.length}</dd>
              </div>
              <div>
                <dt className="lbl">New filings</dt>
                <dd className="num">{newFilings}</dd>
              </div>
              <div>
                <dt className="lbl">In placement</dt>
                <dd className="num">{inPlacement}</dd>
              </div>
              <div>
                <dt className="lbl">Ranked</dt>
                <dd className="num">{inventory.rankedVideos.length}</dd>
              </div>
              <div>
                <dt className="lbl">Research files</dt>
                <dd className="num">
                  {inventory.videoUnderReview.length + inventory.researchOnly.length}
                </dd>
              </div>
            </dl>
            <p className="rail-note" style={{ marginTop: 10 }}>
              Research files remain searchable without borrowing a public
              position from the editorial seed.{" "}
              <Link href="/record">Open the complete record.</Link>
            </p>
          </section>
        </aside>
      </div>
    </SiteFrame>
  );
}
