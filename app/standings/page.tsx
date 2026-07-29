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
    "Public statements ranked by sarcasm score and GP.",
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
            <span className="lbl">Ten votes to enter the table</span>
          </div>
          <StandingsTable rows={rows} term={query.q} />
          {inventory.rankedVideos.length === 0 && (
            <p className="rail-note" style={{ marginTop: 18 }}>
              The table is spotless &mdash; suspiciously spotless. A clip joins
              after ten votes; its score bar starts moving after the first.{" "}
              <Link href="/watch">Watch and vote.</Link>
            </p>
          )}
        </div>

        <aside className="rail">
          <section className="rail-block summons">
            <h2>The Board is open</h2>
            <p className="rail-note">
              Watch the clip before voting. Each verified account gets one vote
              per statement.
            </p>
            <Link className="btn seal summons-btn" href="/watch">
              Open the clips
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
                <dt className="lbl">Live clips</dt>
                <dd className="num">{inventory.liveVideos.length}</dd>
              </div>
              <div>
                <dt className="lbl">Fresh</dt>
                <dd className="num">{newFilings}</dd>
              </div>
              <div>
                <dt className="lbl">Finding rank</dt>
                <dd className="num">{inPlacement}</dd>
              </div>
              <div>
                <dt className="lbl">On the table</dt>
                <dd className="num">{inventory.rankedVideos.length}</dd>
              </div>
              <div>
                <dt className="lbl">In the archive</dt>
                <dd className="num">
                  {inventory.videoUnderReview.length + inventory.researchOnly.length}
                </dd>
              </div>
            </dl>
            <p className="rail-note" style={{ marginTop: 10 }}>
              The archive also keeps statements that do not have a live video
              yet.{" "}
              <Link href="/record">Browse the complete Record.</Link>
            </p>
          </section>
        </aside>
      </div>
    </SiteFrame>
  );
}
