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
