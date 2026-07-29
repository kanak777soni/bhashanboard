import Link from "next/link";
import ScreeningFrame from "@/components/ScreeningFrame";
import WatchScreeningFeed, {
  type WatchFeedEntry,
} from "@/components/public/WatchScreeningFeed";
import styles from "@/components/public/PublicInventory.module.css";
import { cloudinaryVideoUrl } from "@/lib/cloudinary";
import { getData } from "@/lib/data";
import { statementRatingMaturity } from "@/lib/public-inventory";

const PAGE_SIZE = 12;

export const metadata = {
  title: "Watch",
  description:
    "Play a public statement, score the sarcasm, and move to the next clip.",
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
    const maturity = statementRatingMaturity(statement);
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
        quoteTranslation: statement.quoteTranslation,
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
        maturityLabel:
          maturity === "new"
            ? "Fresh clip"
            : maturity === "placement"
              ? "Finding its place"
              : "Ranked",
        publicRank: data.publicRankOf(statement.slug),
      },
    ];
  });

  return (
    <ScreeningFrame>
      {entries.length === 0 ? (
        <section className={styles.emptyState}>
          <div>
            <span className="lbl">The projector is quiet</span>
            <h1>No clips are live just yet.</h1>
            <p>
              The first one is still backstage. Know a speech that belongs
              here? Send the link and give the Board something to argue about.
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
