import assert from "node:assert/strict";
import test from "node:test";
import {
  assertVideoExcerpt,
  committeePublicationIssues,
  isCommitteePublicationEligible,
  isCloudinaryVideoPublicId,
  MAX_CLOUDINARY_DERIVED_VIDEO_BYTES,
  MAX_HOSTED_VIDEO_BYTES,
  normalizeCloudinaryAssetId,
  normalizeStatementEvidenceVideo,
  normalizeStatementVideo,
  normalizeVerificationStage,
  parseVideoTimestamp,
  parseYouTubeVideo,
} from "../lib/video";

const CLOUDINARY_PUBLIC_ID =
  "bhashanboard/statement-videos/123e4567-e89b-42d3-a456-426614174000";
const CLOUDINARY_ASSET_ID = "asset_0123456789abcdef";

function validCloudinaryVideo() {
  return {
    platform: "cloudinary",
    id: CLOUDINARY_PUBLIC_ID,
    assetId: CLOUDINARY_ASSET_ID,
    version: 1_722_345_678,
    bytes: 12_345_678,
    derivedBytes: 10_234_567,
    format: "mp4",
    durationMs: 61_250,
    start: 0,
    end: 62,
  };
}

function eligibleCommitteeDocument() {
  return {
    status: "published",
    date: "2026-07-29",
    venue: "Public meeting, New Delhi",
    language: "Hindi",
    quote: "यह मूल कथन है।",
    quote_translation: "This is the original statement.",
    context: "The surrounding minute was reviewed.",
    video: {
      platform: "youtube",
      id: "abcDEF_1234",
      start: 20,
      end: 50,
    },
    verification: {
      stage: "committee_passed",
      best_source_tier: "A",
      sources: [
        {
          tier: "A",
          url: "https://example.com/source",
        },
      ],
    },
  };
}

test("verification stages normalize old records without elevating unknown data", () => {
  assert.equal(normalizeVerificationStage("lead"), "text_sourced");
  assert.equal(normalizeVerificationStage("clip_attached"), "av_verified");
  assert.equal(normalizeVerificationStage("verified"), "committee_passed");
  assert.equal(normalizeVerificationStage("invented"), "text_sourced");
});

test("YouTube inputs and strict timestamps produce a canonical excerpt", () => {
  assert.deepEqual(parseYouTubeVideo("https://youtu.be/abcDEF_1234?t=40"), {
    platform: "youtube",
    id: "abcDEF_1234",
  });
  assert.equal(parseVideoTimestamp("01:05"), 65);
  assert.equal(parseVideoTimestamp("1:60"), undefined);
  assert.deepEqual(
    normalizeStatementVideo({ platform: "youtube", id: "abcDEF_1234", start: 65, end: 95 }),
    { platform: "youtube", id: "abcDEF_1234", start: 65, end: 95 }
  );
});

test("Cloudinary uploads normalize to a version-pinned, bounded MP4 excerpt", () => {
  const video = normalizeStatementVideo({
    ...validCloudinaryVideo(),
    assetId: ` ${CLOUDINARY_ASSET_ID} `,
    version: "1722345678",
  });

  assert.deepEqual(video, {
    ...validCloudinaryVideo(),
    assetId: CLOUDINARY_ASSET_ID,
  });
  assert.equal(isCloudinaryVideoPublicId(CLOUDINARY_PUBLIC_ID), true);
  assert.equal(
    normalizeCloudinaryAssetId(` ${CLOUDINARY_ASSET_ID} `),
    CLOUDINARY_ASSET_ID
  );
});

test("Cloudinary uploads fail closed when provider metadata is invalid", () => {
  const valid = validCloudinaryVideo();

  assert.equal(normalizeStatementVideo({ ...valid, id: "../evidence.mp4" }), undefined);
  assert.equal(
    normalizeStatementVideo({
      ...valid,
      id: "bhashanboard/statement-videos/123E4567-E89B-42D3-A456-426614174000",
    }),
    undefined
  );
  assert.equal(normalizeStatementVideo({ ...valid, assetId: "too-short" }), undefined);
  assert.equal(normalizeStatementVideo({ ...valid, version: 0 }), undefined);
  assert.equal(normalizeStatementVideo({ ...valid, start: 1 }), undefined);
  assert.equal(normalizeStatementVideo({ ...valid, end: 61 }), undefined);
  assert.equal(
    normalizeStatementVideo({ ...valid, bytes: MAX_HOSTED_VIDEO_BYTES + 1 }),
    undefined
  );
  assert.equal(
    normalizeStatementVideo({
      ...valid,
      derivedBytes: MAX_CLOUDINARY_DERIVED_VIDEO_BYTES + 1,
    }),
    undefined
  );
  assert.equal(normalizeStatementVideo({ ...valid, format: "webm" }), undefined);
  assert.equal(normalizeStatementVideo({ ...valid, durationMs: 2_999, end: 3 }), undefined);
  assert.equal(
    normalizeStatementVideo({ id: "abcDEF_1234", platform: null, start: 0, end: 30 }),
    undefined
  );
});

test("legacy verification embeds remain YouTube-only", () => {
  assert.deepEqual(
    normalizeStatementEvidenceVideo({
      verification: {
        embed: {
          platform: "youtube",
          id: "abcDEF_1234",
          start_s: 10,
          end_s: 30,
        },
      },
    }),
    {
      platform: "youtube",
      id: "abcDEF_1234",
      start: 10,
      end: 30,
    }
  );
  assert.equal(
    normalizeStatementEvidenceVideo({
      verification: { embed: validCloudinaryVideo() },
    }),
    undefined
  );
  assert.deepEqual(
    normalizeStatementEvidenceVideo({
      video: validCloudinaryVideo(),
      verification: {
        embed: {
          platform: "youtube",
          id: "abcDEF_1234",
          start: 10,
          end: 30,
        },
      },
    }),
    validCloudinaryVideo()
  );
});

test("voting excerpts must be bounded and no longer than three minutes", () => {
  assert.throws(
    () => assertVideoExcerpt({ platform: "youtube", id: "abcDEF_1234", start: 20, end: 22 }),
    /at least three seconds/
  );
  assert.throws(
    () => assertVideoExcerpt({ platform: "youtube", id: "abcDEF_1234", start: 0, end: 181 }),
    /three minutes/
  );
  assert.equal(
    normalizeStatementVideo({ platform: "youtube", id: "abcDEF_1234", start: 20, end: 20 }),
    undefined
  );
});

test("committee publication eligibility requires complete evidence and original text", () => {
  const eligible = eligibleCommitteeDocument();
  assert.deepEqual(committeePublicationIssues(eligible), []);
  assert.equal(isCommitteePublicationEligible(eligible), true);

  const incomplete = {
    ...eligible,
    date: " ",
    venue: "",
    quote: " ",
    quote_translation: "",
    context: "",
    verification: {
      ...eligible.verification,
      best_source_tier: "B",
    },
  };
  const issues = committeePublicationIssues(incomplete);
  assert.ok(issues.includes("A confirmed statement date is required."));
  assert.ok(issues.includes("A confirmed statement venue is required."));
  assert.ok(issues.includes("An original-language verbatim quote is required."));
  assert.ok(
    issues.includes("A faithful English translation is required for a non-English quote.")
  );
  assert.ok(issues.includes("Surrounding context is required."));
  assert.ok(issues.includes("A matching Tier A/B HTTP(S) source is required."));
  assert.equal(isCommitteePublicationEligible(incomplete), false);
});

test("committee evidence requires the matching best-tier HTTP(S) source", () => {
  const eligible = eligibleCommitteeDocument();
  const invalidSource = {
    ...eligible,
    verification: {
      ...eligible.verification,
      sources: [{ tier: "A", url: "ftp://example.com/source" }],
    },
  };
  assert.ok(
    committeePublicationIssues(invalidSource).includes(
      "A matching Tier A/B HTTP(S) source is required."
    )
  );
});

test("unresolved verification needs hard-block publication", () => {
  const eligible = eligibleCommitteeDocument();
  const issues = committeePublicationIssues({
    ...eligible,
    verification: {
      ...eligible.verification,
      needs: ["Confirm the exact end timestamp"],
    },
  });

  assert.ok(
    issues.includes("All outstanding verification needs must be resolved.")
  );
  assert.equal(
    isCommitteePublicationEligible({
      ...eligible,
      verification: {
        ...eligible.verification,
        needs: ["Confirm the exact end timestamp"],
      },
    }),
    false
  );
});

test("committee publication accepts a verified Cloudinary MP4 as video evidence", () => {
  const eligible = {
    ...eligibleCommitteeDocument(),
    video: { ...validCloudinaryVideo(), durationMs: 30_000, end: 30 },
  };

  assert.deepEqual(committeePublicationIssues(eligible), []);
  assert.equal(isCommitteePublicationEligible(eligible), true);
});
