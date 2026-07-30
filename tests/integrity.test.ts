import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildCorpus,
  type RawParty,
  type RawPolitician,
  type RawStatement,
} from "../lib/corpus";
import { parseRatingAggregate } from "../lib/rating-aggregate";
import {
  assertStatementHasNoVotes,
  statementRatingLockKey,
  StatementAlreadyVotedError,
} from "../lib/statement-rating-lock";
import { buildLocalSnapshot, validateSnapshot } from "../scripts/db-common.mjs";

test("full edits and first votes share one lock and bind the eligibility snapshot", async () => {
  assert.equal(
    statementRatingLockKey("IN-0044"),
    "bhashan:statement-rating:IN-0044"
  );
  assert.throws(
    () => assertStatementHasNoVotes("IN-0044", true),
    StatementAlreadyVotedError
  );

  const [storeSource, voteSource] = await Promise.all([
    readFile(new URL("../lib/store.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/vote-store.ts", import.meta.url), "utf8"),
  ]);
  const editStart = storeSource.indexOf(
    "export async function updateStatementRecord"
  );
  const editEnd = storeSource.indexOf(
    "export async function setStatementStatus",
    editStart
  );
  const editSource = storeSource.slice(editStart, editEnd);
  assert.match(editSource, /statementRatingLockKey\(id\)/);
  assert.match(editSource, /FROM bhashan\.statement_votes AS vote/);
  assert.match(editSource, /AND NOT edit_state\.has_votes/);

  const voteStart = voteSource.indexOf(
    "export async function submitStatementVote"
  );
  const voteEnd = voteSource.indexOf(
    "export async function getStatementRating",
    voteStart
  );
  const submissionSource = voteSource.slice(voteStart, voteEnd);
  assert.match(
    submissionSource,
    /statementRatingLockKey\(input\.statementId\)/
  );
  assert.match(
    submissionSource,
    /AND version = \$\{eligibleStatement\.recordVersion\}/
  );
});

test("database guards serialize direct statement edits with the first vote", async () => {
  const migrationSource = await readFile(
    new URL(
      "../db/migrations/0005_statement_vote_immutability.sql",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(
    migrationSource,
    /CREATE TRIGGER protect_statement_rating_inputs\s+BEFORE UPDATE ON bhashan\.statements/
  );
  assert.match(
    migrationSource,
    /NEW\.document - 'status' - 'hall_of_fame'/
  );
  assert.match(
    migrationSource,
    /FROM bhashan\.statement_votes AS vote\s+WHERE vote\.statement_id = OLD\.id/
  );
  assert.match(
    migrationSource,
    /CREATE TRIGGER serialize_statement_vote_insert\s+BEFORE INSERT ON bhashan\.statement_votes/
  );
  assert.match(
    migrationSource,
    /'bhashan:statement-rating:' \|\| OLD\.id/
  );
  assert.match(
    migrationSource,
    /'bhashan:statement-rating:' \|\| NEW\.statement_id/
  );
});

test("audited Sarcasm Profile edits stay possible without unlocking voted content", async () => {
  const [migrationSource, storeSource, actionSource] = await Promise.all([
    readFile(
      new URL(
        "../db/migrations/0013_sarcasm_profile_preview.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(new URL("../lib/store.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/actions.ts", import.meta.url), "utf8"),
  ]);

  assert.match(
    migrationSource,
    /NEW\.document - 'status' - 'hall_of_fame' - 'axes'/,
  );
  assert.match(
    migrationSource,
    /OLD\.document - 'status' - 'hall_of_fame' - 'axes'/,
  );
  assert.match(
    migrationSource,
    /AND \(NEW\.document - 'hall_of_fame' - 'axes'\)[\s\S]*?OLD\.rating_seed_gp/,
  );
  assert.match(
    migrationSource,
    /ADD CONSTRAINT statements_sarcasm_axes_check/,
  );
  assert.match(migrationSource, /axis_value::text !~ '\^\[0-5\]\$'/);
  assert.match(
    storeSource,
    /export async function updateStatementAxes[\s\S]*?statementRatingLockKey\(id\)[\s\S]*?jsonb_set\([\s\S]*?'\{axes\}'/,
  );
  assert.match(
    actionSource,
    /export async function updateSarcasmProfile[\s\S]*?const actor = await requireAdmin\(\)/,
  );
  assert.match(
    actionSource,
    /updateStatementAxes\(id, axes, expectedVersion/,
  );
  assert.doesNotMatch(
    actionSource.slice(
      actionSource.indexOf("export async function updateSarcasmProfile"),
      actionSource.indexOf("export async function setStatus"),
    ),
    /rating recomputed|calculateRating|statement_rating_aggregates/,
  );
});

test("corpus refreshes preserve audited admin-managed document overrides", async () => {
  const [importSource, verifierSource] = await Promise.all([
    readFile(new URL("../scripts/db-import.mjs", import.meta.url), "utf8"),
    readFile(new URL("../scripts/db-verify.mjs", import.meta.url), "utf8"),
  ]);

  assert.match(
    importSource,
    /Preserving admin-managed rows while importing the remaining corpus/,
  );
  assert.doesNotMatch(
    importSource,
    /Import would overwrite admin-managed rows/,
  );
  assert.match(
    verifierSource,
    /options\.allowAdminManagedOverride === true/,
  );
  assert.match(
    verifierSource,
    /statements[\s\S]*?allowAdminManagedOverride: true/,
  );
});

test("rating v2 migration demotes incomplete publications and enforces the same bar in Postgres", async () => {
  const migrationSource = await readFile(
    new URL(
      "../db/migrations/0010_publication_and_rating_v2.sql",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(
    migrationSource,
    /CREATE OR REPLACE FUNCTION bhashan\.statement_publication_issues/
  );
  assert.match(
    migrationSource,
    /statement_document ->> 'date'[\s\S]*?confirmed statement date/
  );
  assert.match(
    migrationSource,
    /statement_document ->> 'venue'[\s\S]*?confirmed statement venue/
  );
  assert.match(migrationSource, /verification -> 'needs'/);
  assert.match(
    migrationSource,
    /bhashan\.statement_video_fingerprint\(statement_document\) IS NULL/
  );
  assert.match(
    migrationSource,
    /SELECT set_config\(\s*'bhashan\.actor'[\s\S]*?migration:0010_publication_and_rating_v2/
  );
  assert.match(
    migrationSource,
    /UPDATE bhashan\.statements AS statement[\s\S]*?to_jsonb\('held_review'::text\)/
  );
  assert.match(migrationSource, /prior_strength = 0/);
  assert.match(migrationSource, /model_version = 2/);
  assert.match(
    migrationSource,
    /NEW\.rating_seed_gp := 1500/
  );
  assert.match(
    migrationSource,
    /CREATE TRIGGER enforce_statement_publication_integrity\s+BEFORE INSERT OR UPDATE OF document/
  );
  assert.match(
    migrationSource,
    /CREATE OR REPLACE FUNCTION bhashan\.valid_http_source_url/
  );
  assert.match(
    migrationSource,
    /bhashan\.valid_http_source_url\(source\.document ->> 'url'\)/
  );
  assert.match(
    migrationSource,
    /CREATE CONSTRAINT TRIGGER enforce_statement_cloudinary_attachment[\s\S]*?DEFERRABLE INITIALLY DEFERRED/
  );
  assert.match(
    migrationSource,
    /CREATE CONSTRAINT TRIGGER enforce_cloudinary_upload_statement_attachment[\s\S]*?DEFERRABLE INITIALLY DEFERRED/
  );
  assert.match(
    migrationSource,
    /bhashan\.statement_cloudinary_attachment_ready\([\s\S]*?upload\.playback_attested_at IS NOT NULL/
  );
});

test("sarcasm publication migration removes editorial gates without weakening media integrity", async () => {
  const [
    migrationSource,
    storeSource,
    verifierSource,
    cloudinarySource,
    voteSource,
    watchSource,
  ] = await Promise.all([
      readFile(
        new URL(
          "../db/migrations/0011_sarcasm_publication_contract.sql",
          import.meta.url
        ),
        "utf8"
      ),
      readFile(new URL("../lib/store.ts", import.meta.url), "utf8"),
      readFile(new URL("../scripts/db-verify.mjs", import.meta.url), "utf8"),
      readFile(new URL("../lib/cloudinary.ts", import.meta.url), "utf8"),
      readFile(new URL("../lib/vote-store.ts", import.meta.url), "utf8"),
      readFile(new URL("../lib/watch-store.ts", import.meta.url), "utf8"),
    ]);

  const publicationFunction = migrationSource.slice(
    migrationSource.indexOf(
      "CREATE OR REPLACE FUNCTION bhashan.statement_publication_issues"
    ),
    migrationSource.indexOf(
      "REVOKE ALL ON FUNCTION bhashan.statement_publication_issues"
    )
  );
  for (const requiredField of [
    "speaker_id",
    "party_at_time",
    "category",
    "neutral_title",
    "quote",
    "language",
  ]) {
    assert.match(publicationFunction, new RegExp(`statement_document ->> '${requiredField}'`));
  }
  assert.match(
    publicationFunction,
    /bhashan\.statement_video_fingerprint\(statement_document\) IS NULL/
  );
  assert.match(publicationFunction, /jsonb_typeof\(/);
  assert.match(publicationFunction, /\[\^\[:space:\]\]/);
  assert.match(publicationFunction, /\^\[A-Za-z0-9_-\]\{11\}\$/);
  for (const editorialGate of [
    "committee-passed",
    "best source tier",
    "verification need",
    "confirmed statement date",
    "confirmed statement venue",
    "Surrounding context",
  ]) {
    assert.doesNotMatch(publicationFunction, new RegExp(editorialGate, "i"));
  }

  const attachmentFunction = migrationSource.slice(
    migrationSource.indexOf(
      "CREATE OR REPLACE FUNCTION bhashan.statement_cloudinary_attachment_ready"
    ),
    migrationSource.indexOf(
      "REVOKE ALL ON FUNCTION\n  bhashan.statement_cloudinary_attachment_ready"
    )
  );
  assert.match(attachmentFunction, /upload\.rights_attested_at IS NOT NULL/);
  assert.doesNotMatch(attachmentFunction, /upload\.playback_attested_at IS NOT NULL/);
  assert.match(
    migrationSource,
    /ADD CONSTRAINT cloudinary_video_attachment_lifecycle_check[\s\S]*?status = 'completed'[\s\S]*?rights_attested_at IS NOT NULL/
  );
  assert.match(
    migrationSource,
    /version = statement\.version \+ 1[\s\S]*?updated_at = clock_timestamp\(\)/
  );
  assert.match(storeSource, /upload\.rights_attested_at IS NOT NULL/);
  assert.doesNotMatch(storeSource, /upload\.playback_attested_at IS NOT NULL/);
  assert.doesNotMatch(
    cloudinarySource.slice(
      cloudinarySource.indexOf("export async function verifyCloudinaryAttachmentToken"),
      cloudinarySource.indexOf("export async function verifyExistingCloudinaryVideo")
    ),
    /PLAYBACK_ATTESTATION_REQUIRED|playback_attested_at/
  );
  assert.doesNotMatch(
    voteSource.slice(
      voteSource.indexOf("WITH current_statement AS"),
      voteSource.indexOf("eligible_receipt AS")
    ),
    /verification,stage|committee_passed/
  );
  assert.doesNotMatch(
    watchSource.slice(
      watchSource.indexOf("export function parseVoteEligibleStatement"),
      watchSource.indexOf("export async function getVoteEligibleStatement")
    ),
    /normalizeVerificationStage|committee_passed/
  );
  assert.match(verifierSource, /cloudinary_video_attachment_lifecycle_check/);
  assert.match(verifierSource, /upload\.rights_attested_at IS NOT NULL/);
  assert.match(verifierSource, /rejects_non_string/);
  assert.match(verifierSource, /rejects_whitespace/);
  assert.match(verifierSource, /rejects_bad_youtube_id/);
});

test("rating v2 is canonically rebuilt and enforced while Hall maturity stays live", async () => {
  const [
    migrationSource,
    verifierSource,
    voteStoreSource,
    accountSource,
    storeSource,
  ] = await Promise.all([
      readFile(
        new URL(
          "../db/migrations/0010_publication_and_rating_v2.sql",
          import.meta.url
        ),
        "utf8"
      ),
      readFile(new URL("../scripts/db-verify.mjs", import.meta.url), "utf8"),
      readFile(new URL("../lib/vote-store.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/account/actions.ts", import.meta.url), "utf8"),
      readFile(new URL("../lib/store.ts", import.meta.url), "utf8"),
    ]);

  assert.match(
    migrationSource,
    /LOCK TABLE[\s\S]*?bhashan\.statement_votes[\s\S]*?bhashan\.statement_rating_aggregates[\s\S]*?IN SHARE ROW EXCLUSIVE MODE/
  );
  assert.match(
    migrationSource,
    /DELETE FROM bhashan\.statement_rating_aggregates AS aggregate[\s\S]*?target_statements AS MATERIALIZED[\s\S]*?LEFT JOIN bhashan\.statement_vote_exclusions[\s\S]*?ON CONFLICT \(statement_id\) DO UPDATE SET/
  );
  assert.match(
    migrationSource,
    /UPDATE bhashan\.statements AS statement[\s\S]*?rating_seed_gp = CASE[\s\S]*?THEN 1500/
  );
  assert.match(
    migrationSource,
    /CREATE TRIGGER enforce_statement_rating_aggregate_v2\s+BEFORE INSERT OR UPDATE OR DELETE/
  );
  assert.match(
    migrationSource,
    /ADD CONSTRAINT statement_rating_aggregate_v2_check[\s\S]*?prior_performance = 50[\s\S]*?prior_strength = 0[\s\S]*?model_version = 2/
  );
  assert.match(
    migrationSource,
    /CREATE TRIGGER clear_immature_statement_hall_of_fame\s+AFTER INSERT OR UPDATE OR DELETE/
  );
  assert.match(
    migrationSource,
    /'bhashan:statement-rating:' \|\| NEW\.id/
  );
  assert.match(
    voteStoreSource,
    /ON CONFLICT \(statement_id\) DO UPDATE SET\s+prior_performance = \$\{PUBLIC_EMPTY_PERFORMANCE\},\s+prior_strength = \$\{RATING_PRIOR_STRENGTH\}/
  );
  assert.match(
    voteStoreSource,
    /UPDATE bhashan\.statement_rating_aggregates AS aggregate\s+SET\s+prior_performance = \$\{PUBLIC_EMPTY_PERFORMANCE\},\s+prior_strength = \$\{RATING_PRIOR_STRENGTH\}/
  );
  assert.match(
    accountSource,
    /prior_performance = \$\{PUBLIC_EMPTY_PERFORMANCE\},\s+prior_strength = \$\{RATING_PRIOR_STRENGTH\}/
  );
  const hallMutationSource = storeSource.slice(
    storeSource.indexOf("export async function setStatementHallOfFame"),
    storeSource.indexOf(
      "export async function createPoliticianRecord",
      storeSource.indexOf("export async function setStatementHallOfFame")
    )
  );
  assert.match(hallMutationSource, /statementRatingLockKey\(id\)/);
  for (const expected of [
    "public_submissions",
    "public_submission_events",
    "enforce_statement_publication_integrity",
    "enforce_statement_cloudinary_attachment",
    "enforce_cloudinary_upload_statement_attachment",
    "enforce_statement_rating_aggregate_v2",
    "clear_immature_statement_hall_of_fame",
    "statement_rating_aggregate_v2_check",
    "statement_publication_issues",
    "rating_seed_gp IS DISTINCT FROM CASE",
  ]) {
    assert.match(verifierSource, new RegExp(expected));
  }
});

test("Hall eligibility migration enforces twenty-five votes and Kohinoor GP in Postgres", async () => {
  const migrationSource = await readFile(
    new URL(
      "../db/migrations/0012_hall_of_fame_eligibility.sql",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(
    migrationSource,
    /aggregate\.valid_vote_count >= 25[\s\S]*?aggregate\.gp >= 1875/
  );
  assert.match(
    migrationSource,
    /target_valid_vote_count >= 25 AND target_gp >= 1875/
  );
  assert.match(
    migrationSource,
    /coalesce\(valid_vote_count, 0\) < 25 OR coalesce\(rating_gp, 0\) < 1875/
  );
});

test("Cloudinary migration and corpus import fail closed on non-canonical evidence", async () => {
  const [migrationSource, importSource, storeSource] = await Promise.all([
    readFile(new URL("../db/migrations/0008_cloudinary_video.sql", import.meta.url), "utf8"),
    readFile(new URL("../scripts/db-common.mjs", import.meta.url), "utf8"),
    readFile(new URL("../lib/store.ts", import.meta.url), "utf8"),
  ]);

  assert.match(
    migrationSource,
    /IF EXISTS \(SELECT 1 FROM bhashan\.r2_video_upload_intents\)/
  );
  assert.match(
    migrationSource,
    /LOCK TABLE[\s\S]*?bhashan\.r2_video_upload_intents[\s\S]*?bhashan\.statements[\s\S]*?IN ACCESS EXCLUSIVE MODE/
  );
  assert.match(
    migrationSource,
    /IF EXISTS \(SELECT 1 FROM bhashan\.r2_object_deletion_intents\)/
  );
  assert.match(migrationSource, /WHERE session\.video_platform = 'r2'/);
  assert.match(migrationSource, /DROP TABLE bhashan\.r2_object_deletion_intents/);
  assert.match(migrationSource, /DROP TABLE bhashan\.r2_video_upload_intents/);
  assert.match(
    migrationSource,
    /CREATE TABLE bhashan\.cloudinary_video_upload_intents/
  );
  assert.match(
    migrationSource,
    /public_id ~ '\^bhashanboard\/statement-videos\/\[0-9a-f\]\{8\}/
  );
  assert.match(migrationSource, /expected_bytes bigint NOT NULL CHECK \(expected_bytes BETWEEN 1 AND 52428800\)/);
  assert.match(migrationSource, /derived_bytes bigint CHECK \(derived_bytes BETWEEN 1 AND 104857600\)/);
  assert.match(
    migrationSource,
    /actual_bytes IS NOT NULL\s+AND actual_bytes = expected_bytes/
  );
  assert.match(
    migrationSource,
    /\(coalesce\(detached_at, completed_at\)\)/
  );
  assert.match(
    migrationSource,
    /CONSTRAINT cloudinary_video_upload_intents_attachment_unique[\s\S]*?UNIQUE \(attached_statement_id\)[\s\S]*?DEFERRABLE INITIALLY DEFERRED/
  );
  assert.match(
    migrationSource,
    /status IN \(\s*'authorized',\s*'processing',\s*'completed',\s*'rejected',\s*'expired',\s*'deleting',\s*'deleted'/
  );
  assert.match(migrationSource, /CHECK \(video_platform IN \('youtube', 'cloudinary'\)\)/);
  assert.match(migrationSource, /WHEN candidate \? 'platform' THEN candidate ->> 'platform'/);
  assert.match(migrationSource, /candidate_platform IS DISTINCT FROM 'cloudinary'/);
  assert.match(migrationSource, /IF candidate_index <> 1 THEN\s+CONTINUE/);
  assert.match(migrationSource, /candidate_asset_id := btrim\(coalesce\(candidate ->> 'assetId'/);
  assert.match(migrationSource, /derived_bytes_text := candidate ->> 'derivedBytes'/);
  assert.match(importSource, /importedVideo\.platform === "r2"/);
  assert.match(importSource, /importedVideo\.platform === "cloudinary"/);
  assert.match(importSource, /Object\.hasOwn\(importedVideo, "assetId"\)/);
  assert.match(importSource, /actor-bound administrator upload workflow/);
  assert.match(migrationSource, /playback_attested_at timestamptz/);
  assert.match(migrationSource, /transformation_requested_at timestamptz/);
  assert.match(migrationSource, /deletion_attempt_id uuid/);
  assert.match(
    migrationSource,
    /'v4',\s*'cloudinary',\s*candidate_id,\s*candidate_asset_id,\s*cloudinary_version::text,\s*start_seconds::text,\s*end_seconds::text,\s*duration_ms::text,\s*object_bytes::text,\s*derived_bytes::text/
  );
  assert.match(migrationSource, /attached_statement_id text REFERENCES bhashan\.statements\(id\) ON DELETE RESTRICT/);
  assert.match(storeSource, /UPDATE bhashan\.cloudinary_video_upload_intents AS upload/);
  assert.match(storeSource, /upload\.public_id = inserted\.document #>> '\{video,id\}'/);
  assert.match(storeSource, /upload\.asset_id = inserted\.document #>> '\{video,assetId\}'/);
  assert.match(storeSource, /upload\.version::text = inserted\.document #>> '\{video,version\}'/);
  assert.match(storeSource, /upload\.actual_bytes::text = inserted\.document #>> '\{video,bytes\}'/);
  assert.match(storeSource, /upload\.derived_bytes::text = inserted\.document #>> '\{video,derivedBytes\}'/);
  assert.match(storeSource, /upload\.duration_ms::text = inserted\.document #>> '\{video,durationMs\}'/);
  assert.match(storeSource, /inserted\.document #>> '\{video,platform\}' = 'cloudinary'/);
  assert.match(storeSource, /attached_statement_id = inserted\.id/);
  assert.match(storeSource, /attached_statement_id = updated\.id/);
  assert.match(storeSource, /EXISTS \(SELECT 1 FROM retained_attachment\)/);
  assert.match(storeSource, /attachment_assertion\.ok AS attachment_ok/);
});

test("an invalid root video cannot hide a Cloudinary embed during JSON import", () => {
  const snapshot = structuredClone(buildLocalSnapshot());
  const statement = snapshot.documents.statements.statements[0];
  statement.video = { platform: null, id: "invalid", start: 0, end: 30 };
  statement.verification = {
    ...statement.verification,
    embed: {
      platform: "cloudinary",
      id: "bhashanboard/statement-videos/12345678-1234-4123-8123-123456789abc",
      assetId: "asset_1234567890abcdef",
      version: 1,
      bytes: 1024,
      derivedBytes: 768,
      format: "mp4",
      durationMs: 30_000,
      start: 0,
      end: 30,
    },
  };

  assert.throws(
    () => validateSnapshot(snapshot),
    /cannot import an uploaded video from JSON/
  );
});

test("aggregate parsing derives performance and GP instead of trusting cache columns", () => {
  const aggregate = parseRatingAggregate({
    statement_id: "IN-0044",
    prior_performance: 50,
    prior_strength: 0,
    valid_vote_count: 3,
    valid_vote_sum: 225,
    vote_0_count: 0,
    vote_25_count: 0,
    vote_50_count: 1,
    vote_75_count: 1,
    vote_100_count: 1,
    performance: 0,
    gp: 1000,
    model_version: 2,
    updated_at: "2026-07-28T00:00:00.000Z",
  });

  assert.equal(aggregate.performance, 75);
  assert.equal(aggregate.gp, 1750);
  const transitionalLegacyAggregate = parseRatingAggregate({
    statement_id: "IN-0044",
    prior_performance: 86.8,
    prior_strength: 10,
    valid_vote_count: 2,
    valid_vote_sum: 25,
    vote_0_count: 1,
    vote_25_count: 1,
    vote_50_count: 0,
    vote_75_count: 0,
    vote_100_count: 0,
    model_version: 1,
    updated_at: "2026-07-28T00:00:00.000Z",
  });
  assert.equal(transitionalLegacyAggregate.performance, 12.5);
  assert.equal(transitionalLegacyAggregate.gp, 1125);
  assert.equal(transitionalLegacyAggregate.priorStrength, 0);
  assert.equal(transitionalLegacyAggregate.modelVersion, 2);
  assert.throws(
    () =>
      parseRatingAggregate({
        statement_id: "IN-0044",
        prior_performance: 50,
        prior_strength: 1,
        valid_vote_count: 0,
        valid_vote_sum: 0,
        vote_0_count: 0,
        vote_25_count: 0,
        vote_50_count: 0,
        vote_75_count: 0,
        vote_100_count: 0,
        model_version: 2,
        updated_at: "2026-07-28T00:00:00.000Z",
      }),
    /invalid model-v2 baseline/
  );
});

test("a stored zero-vote aggregate remains neutral in public data", () => {
  const statements: RawStatement[] = [
    {
      id: "IN-9000",
      status: "published",
      speaker_id: "test-speaker",
      party_at_time: "TST",
      office_at_time: "Test office",
      state: "Test state",
      date: "2026-07-28",
      venue: "Test venue",
      language: "English",
      category: "Science & Reason",
      neutral_title: "A test statement",
      quote: "A test statement.",
      claim: "A test claim.",
      axes: {
        logic_damage: 1,
        straight_face: 1,
        rewatch_value: 1,
        crowd_complicity: 1,
        consequence: 1,
      },
      verification: {
        stage: "text_sourced",
        best_source_tier: "C",
      },
    },
  ];
  const politicians: RawPolitician[] = [
    {
      id: "test-speaker",
      name: "Test Speaker",
      party: "TST",
      state: "Test state",
    },
  ];
  const parties: RawParty[] = [{ id: "TST", name: "Test Party" }];
  const frozen = parseRatingAggregate({
    statement_id: "IN-9000",
    prior_performance: 50,
    prior_strength: 0,
    valid_vote_count: 0,
    valid_vote_sum: 0,
    vote_0_count: 0,
    vote_25_count: 0,
    vote_50_count: 0,
    vote_75_count: 0,
    vote_100_count: 0,
    performance: 12,
    gp: 1120,
    model_version: 2,
    updated_at: "2026-07-28T00:00:00.000Z",
  });

  const model = buildCorpus(
    {
      statements,
      politicians,
      parties,
      ratingAggregates: [frozen],
    },
    "2026-07-28"
  );

  assert.equal(model.CORPUS[0]?.gp, 1500);
  assert.equal(model.CORPUS[0]?.rating.source, "community");
  assert.equal(model.CORPUS[0]?.rating.validVoteCount, 0);
  assert.equal(model.CORPUS[0]?.rating.priorPerformance, 50);
});

test("vote moderation is registered-admin-only and audited atomically", async () => {
  const [voteStoreSource, moderationActionSource] = await Promise.all([
    readFile(new URL("../lib/vote-store.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../app/admin/users/[id]/actions.ts", import.meta.url),
      "utf8"
    ),
  ]);
  const exclusionStart = voteStoreSource.indexOf(
    "export async function excludeStatementVote"
  );
  const exclusionEnd = voteStoreSource.indexOf(
    "export async function rebuildStatementRating",
    exclusionStart
  );
  const exclusionSource = voteStoreSource.slice(exclusionStart, exclusionEnd);

  assert.match(exclusionSource, /actorLabel: string/);
  assert.match(exclusionSource, /logged_exclusion AS/);
  assert.match(exclusionSource, /INSERT INTO bhashan\.audit_events/);
  assert.match(exclusionSource, /CROSS JOIN logged_exclusion/);
  assert.match(moderationActionSource, /const actor = await requireAdmin\(\)/);
  assert.match(moderationActionSource, /excludeStatementVote\(\{/);
  assert.match(moderationActionSource, /actorUserId: actor\.id/);
  assert.match(moderationActionSource, /actorLabel: actor\.label/);
  assert.match(
    moderationActionSource,
    /revalidatePath\("\/statement\/\[slug\]", "page"\)/
  );
});
