import assert from "node:assert/strict";
import test from "node:test";
import type { CorpusStatement } from "../lib/corpus";
import {
  buildPublicInventory,
  frontPageInventoryBand,
  ratingMaturityForVoteCount,
  ratingMaturityLabel,
} from "../lib/public-inventory";

function statement({
  slug,
  publicationEligible,
  hasVideo,
  votes,
  gp = 1500,
  daysAgo = 0,
}: {
  slug: string;
  publicationEligible: boolean;
  hasVideo: boolean;
  votes: number;
  gp?: number;
  daysAgo?: number;
}): CorpusStatement {
  return {
    slug,
    publicationEligible,
    video: hasVideo
      ? { platform: "youtube", id: "abc12345", start: 0, end: 15 }
      : undefined,
    rating: { validVoteCount: votes },
    gp,
    daysAgo,
  } as CorpusStatement;
}

test("rating maturity uses the public ten-ruling threshold", () => {
  assert.equal(ratingMaturityForVoteCount(0), "new");
  assert.equal(ratingMaturityForVoteCount(1), "placement");
  assert.equal(ratingMaturityForVoteCount(9), "placement");
  assert.equal(ratingMaturityForVoteCount(10), "ranked");
  assert.equal(ratingMaturityForVoteCount(500), "ranked");

  assert.equal(ratingMaturityLabel("new"), "New filing");
  assert.equal(ratingMaturityLabel("placement"), "In placement");
  assert.equal(ratingMaturityLabel("ranked"), "Ranked");
});

test("front page inventory bands cover zero, sparse, growing and full catalogues", () => {
  assert.equal(frontPageInventoryBand(0), "empty");
  assert.equal(frontPageInventoryBand(1), "sparse");
  assert.equal(frontPageInventoryBand(3), "sparse");
  assert.equal(frontPageInventoryBand(4), "growing");
  assert.equal(frontPageInventoryBand(11), "growing");
  assert.equal(frontPageInventoryBand(12), "full");
  assert.equal(frontPageInventoryBand(200), "full");
});

test("inventory selectors keep live, review and text-only records disjoint", () => {
  const live = statement({
    slug: "live",
    publicationEligible: true,
    hasVideo: true,
    votes: 0,
  });
  const review = statement({
    slug: "review",
    publicationEligible: false,
    hasVideo: true,
    votes: 0,
  });
  const research = statement({
    slug: "research",
    publicationEligible: false,
    hasVideo: false,
    votes: 0,
  });
  // A publication flag cannot put an incomplete record into Watch.
  const incomplete = statement({
    slug: "incomplete",
    publicationEligible: true,
    hasVideo: false,
    votes: 25,
  });

  const inventory = buildPublicInventory([
    research,
    review,
    live,
    incomplete,
  ]);

  assert.deepEqual(inventory.liveVideos.map((entry) => entry.slug), ["live"]);
  assert.deepEqual(
    inventory.videoUnderReview.map((entry) => entry.slug),
    ["review"]
  );
  assert.deepEqual(
    inventory.researchOnly.map((entry) => entry.slug).sort(),
    ["incomplete", "research"]
  );
  assert.equal(inventory.frontPageBand, "sparse");
});

test("public ranks exclude unverified videos and live entries below ten rulings", () => {
  const inventory = buildPublicInventory([
    statement({
      slug: "seed-only-high-gp",
      publicationEligible: false,
      hasVideo: false,
      votes: 0,
      gp: 1999,
    }),
    statement({
      slug: "new-live",
      publicationEligible: true,
      hasVideo: true,
      votes: 0,
      gp: 1980,
    }),
    statement({
      slug: "placement-live",
      publicationEligible: true,
      hasVideo: true,
      votes: 9,
      gp: 1970,
    }),
    statement({
      slug: "ranked-second",
      publicationEligible: true,
      hasVideo: true,
      votes: 10,
      gp: 1600,
    }),
    statement({
      slug: "ranked-first",
      publicationEligible: true,
      hasVideo: true,
      votes: 12,
      gp: 1700,
    }),
    statement({
      slug: "review-video",
      publicationEligible: false,
      hasVideo: true,
      votes: 50,
      gp: 1900,
    }),
  ]);

  assert.deepEqual(
    inventory.rankedVideos.map((entry) => entry.slug),
    ["ranked-first", "ranked-second"]
  );
  assert.equal(inventory.publicRankBySlug.get("ranked-first"), 1);
  assert.equal(inventory.publicRankBySlug.get("ranked-second"), 2);
  assert.equal(inventory.publicRankBySlug.has("placement-live"), false);
  assert.equal(inventory.publicRankBySlug.has("review-video"), false);
});
