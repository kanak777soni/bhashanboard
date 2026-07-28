import assert from "node:assert/strict";
import test from "node:test";
import {
  assertVideoExcerpt,
  committeePublicationIssues,
  isCommitteePublicationEligible,
  MAX_R2_VIDEO_BYTES,
  normalizeR2Etag,
  normalizeR2Sha256,
  normalizeStatementVideo,
  normalizeVerificationStage,
  parseVideoTimestamp,
  parseYouTubeVideo,
} from "../lib/video";

function eligibleCommitteeDocument() {
  return {
    status: "published",
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

test("R2 uploads normalize to an immutable, bounded MP4 excerpt", () => {
  const sha256 = "0123456789abcdef".repeat(4);
  const video = normalizeStatementVideo({
    platform: "r2",
    id: `statement-videos/01/${sha256}.mp4`,
    sha256: sha256.toUpperCase(),
    etag: '"0123456789ABCDEF0123456789ABCDEF"',
    bytes: 12_345_678,
    contentType: "video/mp4",
    durationMs: 61_250,
    start: 0,
    end: 62,
  });

  assert.deepEqual(video, {
    platform: "r2",
    id: `statement-videos/01/${sha256}.mp4`,
    sha256,
    etag: "0123456789abcdef0123456789abcdef",
    bytes: 12_345_678,
    contentType: "video/mp4",
    durationMs: 61_250,
    start: 0,
    end: 62,
  });
  assert.equal(normalizeR2Etag('W/"0123456789ABCDEF0123456789ABCDEF"'), "0123456789abcdef0123456789abcdef");
  assert.equal(normalizeR2Sha256(` ${sha256.toUpperCase()} `), sha256);
});

test("R2 uploads fail closed when metadata or the immutable key is invalid", () => {
  const sha256 = "0123456789abcdef".repeat(4);
  const valid = {
    platform: "r2",
    id: `statement-videos/01/${sha256}.mp4`,
    sha256,
    etag: "0123456789abcdef0123456789abcdef",
    bytes: 12_345_678,
    contentType: "video/mp4",
    durationMs: 61_250,
    start: 0,
    end: 62,
  };

  assert.equal(normalizeStatementVideo({ ...valid, id: "../evidence.mp4" }), undefined);
  assert.equal(
    normalizeStatementVideo({ ...valid, id: `statement-videos/ff/${sha256}.mp4` }),
    undefined
  );
  assert.equal(normalizeStatementVideo({ ...valid, sha256: `${valid.sha256}00` }), undefined);
  assert.equal(normalizeStatementVideo({ ...valid, etag: `${valid.etag}-2` }), undefined);
  assert.equal(normalizeStatementVideo({ ...valid, start: 1 }), undefined);
  assert.equal(normalizeStatementVideo({ ...valid, end: 61 }), undefined);
  assert.equal(normalizeStatementVideo({ ...valid, bytes: MAX_R2_VIDEO_BYTES + 1 }), undefined);
  assert.equal(normalizeStatementVideo({ ...valid, contentType: "video/quicktime" }), undefined);
  assert.equal(
    normalizeStatementVideo({ id: "abcDEF_1234", platform: null, start: 0, end: 30 }),
    undefined
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
    quote: " ",
    quote_translation: "",
    context: "",
    verification: {
      ...eligible.verification,
      best_source_tier: "B",
    },
  };
  const issues = committeePublicationIssues(incomplete);
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

test("committee publication accepts a verified R2 MP4 as video evidence", () => {
  const sha256 = "0123456789abcdef".repeat(4);
  const eligible = {
    ...eligibleCommitteeDocument(),
    video: {
      platform: "r2",
      id: `statement-videos/01/${sha256}.mp4`,
      sha256,
      etag: "0123456789abcdef0123456789abcdef",
      bytes: 12_345_678,
      contentType: "video/mp4",
      durationMs: 30_000,
      start: 0,
      end: 30,
    },
  };

  assert.deepEqual(committeePublicationIssues(eligible), []);
  assert.equal(isCommitteePublicationEligible(eligible), true);
});
