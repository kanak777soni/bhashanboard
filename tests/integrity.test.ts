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

test("R2 migration and corpus import fail closed on non-canonical evidence", async () => {
  const [migrationSource, importSource, r2Source, retentionSource, watchSource, storeSource] = await Promise.all([
    readFile(new URL("../db/migrations/0007_r2_video.sql", import.meta.url), "utf8"),
    readFile(new URL("../scripts/db-common.mjs", import.meta.url), "utf8"),
    readFile(new URL("../lib/r2.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/r2-retention.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/watch-store.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/store.ts", import.meta.url), "utf8"),
  ]);

  assert.match(migrationSource, /WHEN candidate \? 'platform' THEN candidate ->> 'platform'/);
  assert.match(migrationSource, /candidate_platform IS DISTINCT FROM 'r2'/);
  assert.match(migrationSource, /left\(candidate_etag, 3\) = 'W\/"'/);
  assert.match(migrationSource, /candidate_etag := lower\(candidate_etag\)/);
  assert.match(migrationSource, /candidate_sha256 := lower\(btrim/);
  assert.match(migrationSource, /candidate_id <> \(\s*'statement-videos\/' \|\| left\(candidate_sha256, 2\)/);
  assert.match(importSource, /importedVideo\.platform === "r2"/);
  assert.match(importSource, /actor-bound administrator upload workflow/);
  assert.match(r2Source, /"content-length",\s*"content-type",\s*"if-none-match"/);
  assert.match(r2Source, /new GetObjectCommand\(\{[\s\S]*?IfMatch: rawEtag/);
  assert.match(r2Source, /createHash\("sha256"\)/);
  assert.match(r2Source, /for await \(const rawChunk of response\.Body/);
  assert.match(r2Source, /totalBytes !== expected\.bytes/);
  assert.match(r2Source, /"validated-sha256": source\.sha256/);
  assert.match(r2Source, /publicBaseUrl\(\);[\s\S]*?const intentId = randomUUID/);
  assert.match(r2Source, /cf-copy-destination-if-none-match/);
  assert.match(r2Source, /playback_attested_at = coalesce\(playback_attested_at/);
  assert.match(migrationSource, /playback_attested_at timestamptz/);
  assert.match(
    watchSource,
    /"v3",\s*video\.platform,\s*video\.id,\s*video\.sha256,\s*video\.startSeconds,\s*video\.endSeconds,\s*video\.durationMs,\s*video\.bytes/
  );
  assert.match(
    migrationSource,
    /'v3',\s*'r2',\s*candidate_id,\s*candidate_sha256,\s*start_seconds::text,\s*end_seconds::text,\s*duration_ms::text,\s*object_bytes::text/
  );
  assert.match(migrationSource, /CREATE TABLE IF NOT EXISTS bhashan\.r2_object_deletion_intents/);
  assert.match(migrationSource, /bucket_role text NOT NULL CHECK \(bucket_role = 'upload'\)/);
  assert.doesNotMatch(migrationSource, /public-orphan/);
  assert.match(migrationSource, /attached_statement_id text REFERENCES bhashan\.statements\(id\) ON DELETE RESTRICT/);
  assert.match(storeSource, /attached_statement_id = inserted\.id/);
  assert.match(storeSource, /attached_statement_id = updated\.id/);
  assert.match(storeSource, /attachment_assertion\.ok AS attachment_ok/);
  assert.match(retentionSource, /Persist the decision before making the external delete call/);
  assert.match(retentionSource, /const intent = await planDeletion/);
  assert.match(retentionSource, /await completeDeletion\(intent\)/);
  assert.match(retentionSource, /r2-public-orphan-audit/);
  assert.match(retentionSource, /'automaticDeletion', false/);
  assert.doesNotMatch(retentionSource, /deleteR2VideoObject|listR2VideoObjects/);

  assert.match(
    r2Source,
    /\(status = 'authorized' AND upload_expires_at <= clock_timestamp\(\)\)\s*OR \(status = 'processing' AND expires_at <= clock_timestamp\(\)\)/
  );
  const completionRetryStart = r2Source.indexOf("if (!intent) {");
  const liveProcessingCheck = r2Source.indexOf(
    "!r2UploadIntentShouldExpire({",
    completionRetryStart
  );
  const expiryMutation = r2Source.indexOf(
    "await markIntentExpired(payload.intentId, actorId)",
    completionRetryStart
  );
  assert.ok(completionRetryStart >= 0 && liveProcessingCheck > completionRetryStart);
  assert.ok(expiryMutation > liveProcessingCheck);
});

test("an invalid root video cannot hide an R2 legacy embed during JSON import", () => {
  const snapshot = structuredClone(buildLocalSnapshot());
  const statement = snapshot.documents.statements.statements[0];
  statement.video = { platform: null, id: "invalid", start: 0, end: 30 };
  statement.verification = {
    ...statement.verification,
    embed: {
      platform: "r2",
      id: `statement-videos/ab/${"ab".repeat(32)}.mp4`,
      sha256: "ab".repeat(32),
      etag: "cd".repeat(16),
      bytes: 1024,
      contentType: "video/mp4",
      durationMs: 30_000,
      start: 0,
      end: 30,
    },
  };

  assert.throws(
    () => validateSnapshot(snapshot),
    /cannot import an R2 video from JSON/
  );
});

test("aggregate parsing derives performance and GP instead of trusting cache columns", () => {
  const aggregate = parseRatingAggregate({
    statement_id: "IN-0044",
    prior_performance: 60,
    prior_strength: 10,
    valid_vote_count: 3,
    valid_vote_sum: 225,
    vote_0_count: 0,
    vote_25_count: 0,
    vote_50_count: 1,
    vote_75_count: 1,
    vote_100_count: 1,
    performance: 0,
    gp: 1000,
    model_version: 1,
    updated_at: "2026-07-28T00:00:00.000Z",
  });

  assert.equal(aggregate.performance, 825 / 13);
  assert.equal(aggregate.gp, 1635);
  assert.throws(
    () =>
      parseRatingAggregate({
        statement_id: "IN-0044",
        prior_performance: 60,
        prior_strength: 10,
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
    /unsupported model version 2/
  );
  assert.throws(
    () =>
      parseRatingAggregate({
        statement_id: "IN-0044",
        prior_performance: 60,
        prior_strength: 9,
        valid_vote_count: 0,
        valid_vote_sum: 0,
        vote_0_count: 0,
        vote_25_count: 0,
        vote_50_count: 0,
        vote_75_count: 0,
        vote_100_count: 0,
        model_version: 1,
        updated_at: "2026-07-28T00:00:00.000Z",
      }),
    /unsupported prior strength 9/
  );
});

test("a stored zero-vote aggregate preserves its frozen prior in public data", () => {
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
    prior_performance: 88,
    prior_strength: 10,
    valid_vote_count: 0,
    valid_vote_sum: 0,
    vote_0_count: 0,
    vote_25_count: 0,
    vote_50_count: 0,
    vote_75_count: 0,
    vote_100_count: 0,
    performance: 12,
    gp: 1120,
    model_version: 1,
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

  assert.equal(model.CORPUS[0]?.seedGp, 1290);
  assert.equal(model.CORPUS[0]?.gp, 1880);
  assert.equal(model.CORPUS[0]?.rating.source, "community");
  assert.equal(model.CORPUS[0]?.rating.validVoteCount, 0);
  assert.equal(model.CORPUS[0]?.rating.priorPerformance, 88);
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
