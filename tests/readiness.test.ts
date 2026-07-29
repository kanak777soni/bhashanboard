import assert from "node:assert/strict";
import test from "node:test";
import { statementReadiness } from "../lib/readiness";

const complete = {
  status: "held_review",
  quote: "A verified quotation.",
  language: "English",
  context: "The surrounding context is recorded.",
  video: {
    platform: "youtube",
    id: "abcdefghijk",
    start: 10,
    end: 30,
  },
  verification: {
    stage: "committee_passed",
    best_source_tier: "A",
    sources: [
      {
        tier: "A",
        publisher: "Official source",
        url: "https://example.com/source",
      },
    ],
  },
};

test("a complete held entry is ready, not live", () => {
  const readiness = statementReadiness(complete);
  assert.equal(readiness.key, "ready");
  assert.equal(readiness.publicationReady, true);
  assert.deepEqual(readiness.blockers, []);
});

test("a complete published entry is live", () => {
  const readiness = statementReadiness({ ...complete, status: "published" });
  assert.equal(readiness.key, "live");
});

test("text-only records stay in the needs-video lane even if historically published", () => {
  const readiness = statementReadiness({
    ...complete,
    status: "published",
    video: undefined,
    verification: {
      ...complete.verification,
      stage: "text_sourced",
    },
  });
  assert.equal(readiness.key, "needs_video");
  assert.equal(readiness.publicationReady, false);
});

test("an attached clip awaiting sign-off is production review", () => {
  const readiness = statementReadiness({
    ...complete,
    verification: {
      ...complete.verification,
      stage: "av_verified",
    },
  });
  assert.equal(readiness.key, "production_review");
});

test("withdrawn remains a decision state even if the document is otherwise complete", () => {
  const readiness = statementReadiness({ ...complete, status: "withdrawn" });
  assert.equal(readiness.key, "withdrawn");
  assert.equal(readiness.publicationReady, true);
});
