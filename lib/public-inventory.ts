import type { CorpusStatement } from "./corpus";
import { PUBLIC_CLASS_MIN_VALID_VOTES } from "./rating";

export type RatingMaturity = "new" | "placement" | "ranked";
export type RatingMaturityLabel =
  | "Fresh clip"
  | "Finding its place"
  | "Ranked";
export type FrontPageInventoryBand = "empty" | "sparse" | "growing" | "full";

export interface PublicInventory {
  /** Committee-passed entries with a canonical, bounded video excerpt. */
  liveVideos: CorpusStatement[];
  /** Entries with video evidence that cannot yet be published or voted on. */
  videoUnderReview: CorpusStatement[];
  /** Research records that still have no canonical video evidence. */
  researchOnly: CorpusStatement[];
  /** Live videos that have accumulated the ten rulings needed for a rank. */
  rankedVideos: CorpusStatement[];
  publicRankBySlug: ReadonlyMap<string, number>;
  frontPageBand: FrontPageInventoryBand;
}

export function ratingMaturityForVoteCount(voteCount: number): RatingMaturity {
  if (!Number.isFinite(voteCount) || voteCount <= 0) return "new";
  if (voteCount < PUBLIC_CLASS_MIN_VALID_VOTES) return "placement";
  return "ranked";
}

export function ratingMaturityLabel(
  maturity: RatingMaturity
): RatingMaturityLabel {
  switch (maturity) {
    case "new":
      return "Fresh clip";
    case "placement":
      return "Finding its place";
    case "ranked":
      return "Ranked";
  }
}

export function statementRatingMaturity(
  statement: Pick<CorpusStatement, "rating">
): RatingMaturity {
  return ratingMaturityForVoteCount(statement.rating.validVoteCount);
}

export function frontPageInventoryBand(
  eligibleVideoCount: number
): FrontPageInventoryBand {
  if (!Number.isFinite(eligibleVideoCount) || eligibleVideoCount <= 0) {
    return "empty";
  }
  if (eligibleVideoCount <= 3) return "sparse";
  if (eligibleVideoCount <= 11) return "growing";
  return "full";
}

export function isLiveVideoStatement(
  statement: Pick<CorpusStatement, "publicationEligible" | "video">
): boolean {
  return statement.publicationEligible === true && statement.video !== undefined;
}

export function isVideoUnderReviewStatement(
  statement: Pick<CorpusStatement, "publicationEligible" | "video">
): boolean {
  return statement.video !== undefined && statement.publicationEligible !== true;
}

export function isResearchOnlyStatement(
  statement: Pick<CorpusStatement, "video">
): boolean {
  return statement.video === undefined;
}

function byFeedPriority(a: CorpusStatement, b: CorpusStatement): number {
  return (
    Number(!a.eventDate) - Number(!b.eventDate) ||
    a.daysAgo - b.daysAgo ||
    b.rating.validVoteCount - a.rating.validVoteCount ||
    a.corpusId.localeCompare(b.corpusId) ||
    a.slug.localeCompare(b.slug)
  );
}

function byPublicRank(a: CorpusStatement, b: CorpusStatement): number {
  return (
    b.gp - a.gp ||
    b.rating.validVoteCount - a.rating.validVoteCount ||
    a.slug.localeCompare(b.slug)
  );
}

export function selectLiveVideoStatements(
  statements: readonly CorpusStatement[]
): CorpusStatement[] {
  return statements.filter(isLiveVideoStatement).sort(byFeedPriority);
}

export function selectVideoUnderReviewStatements(
  statements: readonly CorpusStatement[]
): CorpusStatement[] {
  return statements.filter(isVideoUnderReviewStatement).sort(byFeedPriority);
}

export function selectResearchOnlyStatements(
  statements: readonly CorpusStatement[]
): CorpusStatement[] {
  return statements.filter(isResearchOnlyStatement).sort(byFeedPriority);
}

export function selectPublicRankedStatements(
  statements: readonly CorpusStatement[]
): CorpusStatement[] {
  return statements
    .filter(
      (statement) =>
        isLiveVideoStatement(statement) &&
        statementRatingMaturity(statement) === "ranked"
    )
    .sort(byPublicRank);
}

export function buildPublicInventory(
  statements: readonly CorpusStatement[]
): PublicInventory {
  const liveVideos = selectLiveVideoStatements(statements);
  const rankedVideos = selectPublicRankedStatements(liveVideos);

  return {
    liveVideos,
    videoUnderReview: selectVideoUnderReviewStatements(statements),
    researchOnly: selectResearchOnlyStatements(statements),
    rankedVideos,
    publicRankBySlug: new Map(
      rankedVideos.map((statement, index) => [statement.slug, index + 1])
    ),
    frontPageBand: frontPageInventoryBand(liveVideos.length),
  };
}
