import Link from "next/link";
import ClassLadder from "@/components/ClassLadder";
import SiteFrame from "@/components/SiteFrame";
import HowItWorks from "@/components/public/HowItWorks";
import ResearchEntryCard from "@/components/public/ResearchEntryCard";
import VideoEntryCard from "@/components/public/VideoEntryCard";
import styles from "@/components/public/PublicInventory.module.css";
import { getData } from "@/lib/data";

export const metadata = {
  title: "The Bhashan Board",
  description:
    "Public speeches, public sarcasm. Watch the moments and see which class each clip earns.",
};

export default async function FrontPage() {
  const data = await getData();
  const inventory = data.publicInventory();
  const featured = inventory.liveVideos[0];
  const secondaryEnd = inventory.frontPageBand === "full" ? 7 : undefined;
  const secondary = inventory.liveVideos.slice(1, secondaryEnd);
  const more =
    inventory.frontPageBand === "full"
      ? inventory.liveVideos.slice(7, 13)
      : [];
  const onDeck = [
    ...inventory.videoUnderReview,
    ...inventory.researchOnly,
  ].slice(0, 6);
  const freshCount = inventory.liveVideos.filter(
    (statement) => statement.rating.validVoteCount === 0,
  ).length;
  const findingPlaceCount = inventory.liveVideos.filter(
    (statement) =>
      statement.rating.validVoteCount > 0 &&
      statement.rating.validVoteCount < 10,
  ).length;
  const hallCount = inventory.rankedVideos.filter(
    (statement) => statement.hallOfFame,
  ).length;

  return (
    <SiteFrame>
      {inventory.frontPageBand === "empty" ? (
        <section className={styles.emptyState} aria-labelledby="first-clip">
          <div>
            <span className="lbl">Nothing on the projector &mdash; yet</span>
            <h1 id="first-clip">The Board needs its first live clip.</h1>
            <p>
              The archive is stocked, but the video shelf is still warming up.
              Drop a link or have a look at what is waiting backstage.
            </p>
          </div>
          <div className={styles.emptyActions}>
            <Link className="btn seal" href="/submit">
              Send a clip
            </Link>
            <Link className="btn ghost" href="/record">
              Browse the archive
            </Link>
          </div>
        </section>
      ) : (
        <section className={styles.section} aria-labelledby="featured-clip">
          <div className={styles.sectionHead}>
            <h1 id="featured-clip">
              {inventory.frontPageBand === "sparse"
                ? "Now on the Board"
                : "Featured clip"}
            </h1>
            <span className="lbl">
              {inventory.liveVideos.length}{" "}
              {inventory.liveVideos.length === 1 ? "clip" : "clips"} live
              &middot; {freshCount} fresh &middot; {findingPlaceCount} finding
              a place
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
      )}

      <HowItWorks />

      <div className={styles.awardSection}>
        <ClassLadder statements={inventory.rankedVideos} />
      </div>

      <section className={styles.hallCallout} aria-labelledby="hall-callout">
        <div>
          <span className="lbl">The permanent gallery</span>
          <h2 id="hall-callout">Hall of Fame</h2>
          <p>
            {hallCount > 0
              ? `${hallCount} ${
                  hallCount === 1 ? "moment has" : "moments have"
                } earned a permanent place on the Board.`
              : "The gallery is waiting for its first formally inducted moment. Follow the strongest clips on their road to the Hall."}
          </p>
        </div>
        <Link className="btn ceremonial" href="/hall">
          Enter the Hall
        </Link>
      </section>

      {secondary.length > 0 && (
        <section className={styles.section} aria-labelledby="keep-watching">
          <div className={styles.sectionHead}>
            <h2 id="keep-watching">Keep watching</h2>
            <Link className="lbl" href="/watch">
              Open every clip &rarr;
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
        <section className={styles.section} aria-labelledby="more-clips">
          <div className={styles.sectionHead}>
            <h2 id="more-clips">More clips</h2>
            <Link className="lbl" href="/standings">
              See the standings &rarr;
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

      {onDeck.length > 0 && (
        <section className={styles.section} aria-labelledby="on-deck">
          <div className={styles.sectionHead}>
            <h2 id="on-deck">On deck</h2>
            <Link className="lbl" href="/record">
              Browse all {data.CORPUS.length} entries &rarr;
            </Link>
          </div>
          <div className={styles.researchGrid}>
            {onDeck.map((statement) => (
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
