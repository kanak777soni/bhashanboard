import Link from "next/link";
import SiteFrame from "@/components/SiteFrame";
import ResearchEntryCard from "@/components/public/ResearchEntryCard";
import VideoEntryCard from "@/components/public/VideoEntryCard";
import styles from "@/components/public/PublicInventory.module.css";
import { getData } from "@/lib/data";

export const metadata = {
  title: "The Bhashan Board",
  description:
    "Watch the clip, rule on the statement, and see where the public places it.",
};

export default async function FrontPage() {
  const data = await getData();
  const inventory = data.publicInventory();
  const featured = inventory.liveVideos[0];
  const secondaryEnd = inventory.frontPageBand === "full" ? 7 : undefined;
  const secondary = inventory.liveVideos.slice(1, secondaryEnd);
  const more = inventory.frontPageBand === "full"
    ? inventory.liveVideos.slice(7, 13)
    : [];
  const researchDesk = [
    ...inventory.videoUnderReview,
    ...inventory.researchOnly,
  ].slice(0, 6);
  const newFilingCount = inventory.liveVideos.filter(
    (statement) => statement.rating.validVoteCount === 0
  ).length;
  const placementCount = inventory.liveVideos.filter(
    (statement) =>
      statement.rating.validVoteCount > 0 &&
      statement.rating.validVoteCount < 10
  ).length;

  return (
    <SiteFrame>
      <section className={styles.frontIntro}>
        <h1>Watch what was said. Then place it.</h1>
        <p>
          The source clip comes first. Context and evidence remain attached to
          every filing; public standing begins only after ten valid rulings.
        </p>
      </section>

      {inventory.frontPageBand === "empty" ? (
        <section className={styles.emptyState} aria-labelledby="first-screening">
          <div>
            <span className="lbl">The screening room is being prepared</span>
            <h2 id="first-screening">The first verified reel is not live yet.</h2>
            <p>
              The archive already contains research, but the Board will not
              manufacture a video shelf from text reports. Each clip needs exact
              bounds, original-language wording, context review, source
              verification, and Committee sign-off.
            </p>
          </div>
          <div className={styles.emptyActions}>
            <Link className="btn seal" href="/record">
              Browse the research desk
            </Link>
            <Link className="btn ghost" href="/submit">
              Submit better evidence
            </Link>
          </div>
        </section>
      ) : (
        <>
          <section className={styles.section} aria-labelledby="featured-screening">
            <div className={styles.sectionHead}>
              <h2 id="featured-screening">
                {inventory.frontPageBand === "sparse"
                  ? "The open sitting"
                  : "Featured screening"}
              </h2>
              <span className="lbl">
                {inventory.liveVideos.length}{" "}
                {inventory.liveVideos.length === 1 ? "clip" : "clips"} ready
                &middot; {newFilingCount} new &middot; {placementCount} in
                placement
              </span>
            </div>
            {featured && (
              <div style={{ marginTop: 16 }}>
                <VideoEntryCard
                  statement={featured}
                  neta={data.netaBySlug(featured.neta)}
                  featured
                  rank={data.publicRankOf(featured.slug)}
                />
              </div>
            )}
          </section>

          {secondary.length > 0 && (
            <section className={styles.section} aria-labelledby="open-filings">
              <div className={styles.sectionHead}>
                <h2 id="open-filings">
                  {inventory.frontPageBand === "sparse"
                    ? "Also before the Committee"
                    : "Open filings"}
                </h2>
                <Link className="lbl" href="/watch">
                  Watch the complete sitting &rarr;
                </Link>
              </div>
              <div
                className={`${styles.grid} ${
                  inventory.frontPageBand === "full" ? styles.gridThree : ""
                }`}
              >
                {secondary.map((statement) => (
                  <VideoEntryCard
                    key={statement.slug}
                    statement={statement}
                    neta={data.netaBySlug(statement.neta)}
                    rank={data.publicRankOf(statement.slug)}
                  />
                ))}
              </div>
            </section>
          )}

          {more.length > 0 && (
            <section className={styles.section} aria-labelledby="more-screenings">
              <div className={styles.sectionHead}>
                <h2 id="more-screenings">More screenings</h2>
                <Link className="lbl" href="/standings">
                  See the public standings &rarr;
                </Link>
              </div>
              <div className={`${styles.grid} ${styles.gridThree}`}>
                {more.map((statement) => (
                  <VideoEntryCard
                    key={statement.slug}
                    statement={statement}
                    neta={data.netaBySlug(statement.neta)}
                    rank={data.publicRankOf(statement.slug)}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {researchDesk.length > 0 && (
        <section className={styles.section} aria-labelledby="research-desk">
          <div className={styles.sectionHead}>
            <h2 id="research-desk">From the Research Desk</h2>
            <Link className="lbl" href="/record">
              All {data.CORPUS.length} records &rarr;
            </Link>
          </div>
          <div className={styles.researchGrid}>
            {researchDesk.map((statement) => (
              <ResearchEntryCard
                key={statement.slug}
                statement={statement}
                neta={data.netaBySlug(statement.neta)}
              />
            ))}
          </div>
        </section>
      )}
    </SiteFrame>
  );
}
