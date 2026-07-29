import Link from "next/link";
import ScreeningFrame from "@/components/ScreeningFrame";
import WatchScreeningFeed, {
  type WatchFeedEntry,
} from "@/components/public/WatchScreeningFeed";
import styles from "@/components/public/PublicInventory.module.css";
import { cloudinaryVideoUrl } from "@/lib/cloudinary";
import { getData } from "@/lib/data";
import {
  ratingMaturityLabel,
  statementRatingMaturity,
} from "@/lib/public-inventory";

const PAGE_SIZE = 12;

export const metadata = {
  title: "Watch",
  description:
    "Watch publication-ready source clips and rule on each statement once.",
};

function pageNumber(value: string | string[] | undefined): number {
  const candidate = Array.isArray(value) ? value[0] : value;
  const parsed = Number(candidate);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

export default async function WatchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const data = await getData();
  const inventory = data.publicInventory();
  const requestedPage = pageNumber((await searchParams).page);
  const pageCount = Math.max(
    1,
    Math.ceil(inventory.liveVideos.length / PAGE_SIZE)
  );
  const page = Math.min(requestedPage, pageCount);
  const start = (page - 1) * PAGE_SIZE;
  const statements = inventory.liveVideos.slice(start, start + PAGE_SIZE);

  const entries: WatchFeedEntry[] = statements.flatMap((statement) => {
    if (!statement.video) return [];
    let videoUrl: string | undefined;
    if (statement.video.platform === "cloudinary") {
      try {
        videoUrl = cloudinaryVideoUrl(statement.video);
      } catch (error) {
        // Keep the rest of the sitting available if one hosted asset cannot
        // currently be signed. Its player reports the configuration problem.
        console.error("Cloudinary feed playback URL generation failed", {
          statementId: statement.corpusId,
          error: String(error),
        });
      }
    }

    return [
      {
        statementId: statement.corpusId,
        slug: statement.slug,
        quote: statement.quote,
        neutralTitle: statement.neutralTitle,
        hasVerbatimQuote: statement.hasVerbatimQuote,
        language: statement.language,
        speakerName:
          data.netaBySlug(statement.neta)?.name ?? "Representative",
        partyCode: statement.partyAtTime,
        category: statement.category,
        video: statement.video,
        videoUrl,
        publicationEligible: true as const,
        initialRating: {
          gp: statement.gp,
          performance: statement.rating.performance,
          validVoteCount: statement.rating.validVoteCount,
          distribution: statement.rating.distribution,
        },
        maturityLabel: ratingMaturityLabel(
          statementRatingMaturity(statement)
        ),
        publicRank: data.publicRankOf(statement.slug),
      },
    ];
  });

  return (
    <ScreeningFrame>
      {entries.length === 0 ? (
        <section className={styles.emptyState}>
          <div>
            <span className="lbl">No publication-ready video</span>
            <h1>No verified screening is live yet.</h1>
            <p>
              Watch contains only reviewed, bounded source clips. Research
              records remain available, but they cannot accept a ruling until
              their footage and context pass verification.
            </p>
          </div>
          <div className={styles.emptyActions}>
            <Link className="btn seal" href="/record">
              Open the complete record
            </Link>
            <Link className="btn ghost" href="/submit">
              Submit a source clip
            </Link>
          </div>
        </section>
      ) : (
        <WatchScreeningFeed
          entries={entries}
          catalogueStart={start}
          catalogueTotal={inventory.liveVideos.length}
          previousPageHref={page > 1 ? `/watch?page=${page - 1}` : undefined}
          nextPageHref={
            page < pageCount ? `/watch?page=${page + 1}` : undefined
          }
        />
      )}
    </ScreeningFrame>
  );
}
