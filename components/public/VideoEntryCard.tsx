import Link from "next/link";
import type { CorpusStatement } from "@/lib/corpus";
import type { Neta } from "@/lib/types";
import { statementRatingMaturity } from "@/lib/public-inventory";
import EntryTitle from "@/components/EntryTitle";
import styles from "./PublicInventory.module.css";

function clipLength(statement: CorpusStatement): number {
  return statement.video
    ? Math.max(0, statement.video.end - statement.video.start)
    : 0;
}

export default function VideoEntryCard({
  statement,
  neta,
  featured = false,
  rank = 0,
}: {
  statement: CorpusStatement;
  neta?: Neta;
  featured?: boolean;
  /** Public rank. Must be zero until the entry has ten valid votes. */
  rank?: number;
}) {
  const maturity = statementRatingMaturity(statement);
  const maturityLabel =
    maturity === "new"
      ? "Fresh clip"
      : maturity === "placement"
        ? "Finding its place"
        : "Ranked";
  const href = `/statement/${statement.slug}`;
  const showResult = maturity === "ranked";

  return (
    <article
      className={`${styles.videoCard} ${
        featured ? styles.videoCardFeatured : ""
      }`}
    >
      <Link className={styles.screen} href={href} aria-label={`Watch ${statement.neutralTitle}`}>
        <span className={styles.screenLabel}>On the Bhashan Board</span>
        <span className={styles.play} aria-hidden="true">
          &#9654;
        </span>
        <span className={styles.screenMeta}>
          {statement.video?.platform === "cloudinary" ? "Board-hosted" : "YouTube source"}
          <br />
          {clipLength(statement)} sec excerpt
        </span>
      </Link>

      <div className={styles.videoBody}>
        <div>
          <div className={styles.eyebrow}>
            <span>Watch &amp; vote</span>
            <span>{maturityLabel}</span>
            {rank > 0 && <span>Public rank #{rank}</span>}
          </div>
          <Link className={styles.videoTitle} href={href}>
            <EntryTitle statement={statement} />
          </Link>
          <div className={styles.meta}>
            {neta?.name ?? "Representative"} &middot; {statement.partyAtTime} &middot;{" "}
            {statement.category} &middot; {statement.language}
          </div>
        </div>

        <div className={styles.cardFoot}>
          <span className={styles.score}>
            {showResult
              ? `Sarcasm score ${Math.round(statement.rating.performance)}/100`
              : `${statement.rating.validVoteCount}/10 votes`}
          </span>
          <Link className={styles.watchLink} href={href}>
            Play clip &rarr;
          </Link>
        </div>
      </div>
    </article>
  );
}
