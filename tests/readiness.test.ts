import assert from "node:assert/strict";
import test from "node:test";
import { statementReadiness } from "../lib/readiness";

const complete = {
  status: "held_review",
  speaker_id: "test-speaker",
  party_at_time: "TST",
  category: "Wordplay",
  neutral_title: "A test statement",
  date: "2026-07-29",
  venue: "Public meeting, New Delhi",
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

test("an accepted submission remains private even when its evidence is complete", () => {
  const readiness = statementReadiness({
    ...complete,
    status: "private_draft",
  });
  assert.equal(readiness.key, "private_draft");
  assert.equal(readiness.publicationReady, true);
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

test("an attached clip does not need a separate committee sign-off", () => {
  const readiness = statementReadiness({
    ...complete,
    verification: {
      ...complete.verification,
      stage: "av_verified",
    },
  });
  assert.equal(readiness.key, "ready");
  assert.equal(readiness.publicationReady, true);
});

test("internal research notes remain optional backstage history", () => {
  const readiness = statementReadiness({
    ...complete,
    verification: {
      ...complete.verification,
      needs: ["Transcribe the surrounding minute"],
    },
  });

  assert.equal(readiness.publicationReady, true);
  assert.deepEqual(readiness.blockers, []);
});

test("withdrawn remains a decision state even if the document is otherwise complete", () => {
  const readiness = statementReadiness({ ...complete, status: "withdrawn" });
  assert.equal(readiness.key, "withdrawn");
  assert.equal(readiness.publicationReady, true);
});
