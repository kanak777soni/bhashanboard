import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  SubmissionValidationError,
  evidencePlatform,
  parseSubmissionTimestamp,
  validateEvidenceUrl,
  validatePublicSubmission,
} from "../lib/submission-validation";

function validSubmission(overrides: Record<string, unknown> = {}) {
  return {
    sourceUrl: "https://www.youtube.com/watch?v=abcdefghijk",
    startTimestamp: "00:41",
    endTimestamp: "01:03",
    speaker: "Example Speaker",
    eventContext: "Public meeting, Delhi, 2026",
    claim: "A neutral description of the submitted claim.",
    originalLanguage: "Hindi",
    submitterName: "Reader",
    contactEmail: "Reader@Example.com",
    syntheticDeclaration: true,
    ...overrides,
  };
}

test("submission validation recognizes real social domains, not lookalikes", () => {
  assert.equal(
    evidencePlatform(new URL("https://m.youtube.com/shorts/abcdefghijk")),
    "youtube"
  );
  assert.equal(
    evidencePlatform(new URL("https://www.facebook.com/watch/?v=123")),
    "facebook"
  );
  assert.equal(
    evidencePlatform(new URL("https://www.instagram.com/reel/example/")),
    "instagram"
  );
  assert.equal(
    evidencePlatform(new URL("https://instagram.com.evil.example/reel/x")),
    "other"
  );
  assert.equal(
    evidencePlatform(new URL("https://notfacebook.com/watch/x")),
    "other"
  );
});

test("submission evidence requires public HTTP(S) without credentials", () => {
  assert.deepEqual(
    validateEvidenceUrl(
      "http://youtu.be/abcdefghijk?t=40"
    ),
    {
      sourceUrl: "https://www.youtube.com/watch?v=abcdefghijk",
      sourcePlatform: "youtube",
    }
  );
  assert.deepEqual(
    validateEvidenceUrl(
      "https://m.facebook.com/example.page/videos/123456789012345/?ref=share"
    ),
    {
      sourceUrl:
        "https://www.facebook.com/watch/?v=123456789012345",
      sourcePlatform: "facebook",
    }
  );
  assert.deepEqual(
    validateEvidenceUrl(
      "https://m.instagram.com/reel/DMLvAbc123_/?igsh=tracking"
    ),
    {
      sourceUrl: "https://www.instagram.com/reel/DMLvAbc123_/",
      sourcePlatform: "instagram",
    }
  );
  assert.throws(
    () => validateEvidenceUrl("https://user:pass@example.com/evidence"),
    SubmissionValidationError
  );
  assert.throws(
    () => validateEvidenceUrl("https://127.0.0.1/evidence"),
    SubmissionValidationError
  );
  assert.equal(
    validateEvidenceUrl("http://example.org/original-feed").sourcePlatform,
    "other"
  );
  assert.throws(
    () => validateEvidenceUrl("https://instagram.com/a-profile/"),
    /direct YouTube video/
  );
});

test("timestamps accept clock forms and excerpts stay between 3 seconds and 3 minutes", () => {
  assert.equal(parseSubmissionTimestamp("75", "startTimestamp"), 75);
  assert.equal(parseSubmissionTimestamp("01:15", "startTimestamp"), 75);
  assert.equal(parseSubmissionTimestamp("1:01:15", "startTimestamp"), 3675);
  assert.throws(
    () =>
      validatePublicSubmission(
        validSubmission({ startTimestamp: "00:01", endTimestamp: "04:00" })
      ),
    /between 3 seconds and 3 minutes/
  );
  assert.throws(
    () =>
      validatePublicSubmission(
        validSubmission({ startTimestamp: "00:01", endTimestamp: "00:03" })
      ),
    /between 3 seconds and 3 minutes/
  );
  assert.throws(
    () =>
      validatePublicSubmission(
        validSubmission({ startTimestamp: "", endTimestamp: "01:00" })
      ),
    /both the start and end/
  );
});

test("validated submissions normalize contact data and require declaration", () => {
  const result = validatePublicSubmission(validSubmission());
  assert.equal(result.contactEmail, "reader@example.com");
  assert.equal(result.sourcePlatform, "youtube");
  assert.equal(result.startSeconds, 41);
  assert.equal(result.endSeconds, 63);
  assert.throws(
    () =>
      validatePublicSubmission(
        validSubmission({ syntheticDeclaration: false })
      ),
    /not synthetic/
  );
});

test("database and moderation paths fail closed against auto-publication", async () => {
  const [
    migration,
    publicationMigration,
    route,
    action,
    store,
    form,
    corpus,
    statementPage,
  ] = await Promise.all([
    readFile(
      new URL("../db/migrations/0009_public_submissions.sql", import.meta.url),
      "utf8"
    ),
    readFile(
      new URL(
        "../db/migrations/0010_publication_and_rating_v2.sql",
        import.meta.url
      ),
      "utf8"
    ),
    readFile(
      new URL("../app/api/submissions/route.ts", import.meta.url),
      "utf8"
    ),
    readFile(
      new URL("../app/admin/submissions/actions.ts", import.meta.url),
      "utf8"
    ),
    readFile(
      new URL("../lib/submission-store.ts", import.meta.url),
      "utf8"
    ),
    readFile(
      new URL("../components/public/SubmissionForm.tsx", import.meta.url),
      "utf8"
    ),
    readFile(new URL("../lib/corpus.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../app/statement/[slug]/page.tsx", import.meta.url),
      "utf8"
    ),
  ]);

  assert.match(
    migration,
    /status text NOT NULL DEFAULT 'pending'[\s\S]*?'accepted'[\s\S]*?'rejected'/
  );
  assert.match(
    migration,
    /draft_statement_id text UNIQUE[\s\S]*?REFERENCES bhashan\.statements/
  );
  assert.match(
    migration,
    /status = 'accepted'[\s\S]*?draft_statement_id IS NOT NULL/
  );
  assert.match(
    migration,
    /end_seconds - start_seconds >= 3[\s\S]*?end_seconds - start_seconds <= 180/
  );
  assert.match(route, /scope: "submission-ip"/);
  assert.match(route, /scope: "submission-email"/);
  assert.match(route, /body\.website/);
  assert.match(action, /status: "private_draft"/);
  assert.match(action, /assertVideoExcerpt\(candidate\)/);
  assert.doesNotMatch(action, /status: "published"/);
  assert.match(store, /document\.status !== "private_draft"/);
  assert.doesNotMatch(store, /held-review draft/);
  assert.match(
    publicationMigration,
    /statements_status_check[\s\S]*?'private_draft'/
  );
  assert.match(
    corpus,
    /statement\.status !== "private_draft"/
  );
  assert.match(
    statementPage,
    /if \(isLiveScreening && video\?\.platform === "cloudinary"\)/
  );
  assert.match(statementPage, /\{isLiveScreening && video \? \(/);
  assert.match(form, /Nothing goes live automatically/);
  assert.doesNotMatch(form, /type="file"/);
});
