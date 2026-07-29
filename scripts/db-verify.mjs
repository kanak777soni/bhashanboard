import {
  buildLocalSnapshot,
  canonicalJson,
  conciseIds,
  createSqlClient,
  hashDocument,
  listMigrationFiles,
  rowsOf,
  safeErrorMessage,
  sha256,
  shortHash,
} from "./db-common.mjs";

function indexBy(rows, key = "id") {
  return new Map(rows.map((row) => [String(row[key]), row]));
}

function verifyDocuments(label, expectedRows, actualRows, errors, options = {}) {
  const actual = indexBy(actualRows);
  const expectedIds = new Set(expectedRows.map((row) => row.id));

  for (const expected of expectedRows) {
    const found = actual.get(expected.id);
    if (!found) {
      errors.push(`${label} is missing ${expected.id}`);
      continue;
    }
    const remoteHash = hashDocument(found.document);
    if (remoteHash !== expected.source_hash) {
      errors.push(`${label} ${expected.id} document hash differs`);
    }
    if (String(found.source_hash ?? "") !== expected.source_hash) {
      errors.push(`${label} ${expected.id} source_hash differs`);
    }
    if (String(found.managed_by) !== "json_seed") {
      errors.push(`${label} ${expected.id} is managed by ${String(found.managed_by)}`);
    }
    if (
      options.position &&
      Number(found.position) !== Number(expected.position)
    ) {
      errors.push(`${label} ${expected.id} position differs`);
    }
  }

  const extras = actualRows.filter((row) => !expectedIds.has(String(row.id)));
  for (const row of extras) {
    if (String(row.managed_by) === "json_seed") {
      errors.push(`${label} has stale seed row ${String(row.id)}`);
    }
  }
  return extras
    .filter((row) => String(row.managed_by) !== "json_seed")
    .map((row) => String(row.id));
}

async function main() {
  const snapshot = buildLocalSnapshot();
  const sql = await createSqlClient();
  const errors = [];

  const remoteMigrations = rowsOf(
    await sql.query("SELECT name, checksum FROM bhashan.schema_migrations ORDER BY name")
  );
  const migrationMap = indexBy(remoteMigrations, "name");
  for (const migration of listMigrationFiles()) {
    const remote = migrationMap.get(migration.name);
    const checksum = sha256(migration.sql);
    if (!remote) {
      errors.push(`migration ${migration.name} is not applied`);
    } else if (String(remote.checksum) !== checksum) {
      errors.push(`migration ${migration.name} checksum differs`);
    }
  }

  const [
    importRows,
    artifactRows,
    partyRows,
    politicianRows,
    statementRows,
    rejectionRows,
    settingRows,
    sequenceRows,
    auditRows,
    triggerRows,
    extensionTableRows,
    authForeignKeyRows,
    authRateLimitColumnRows,
    authRateLimitConstraintRows,
    ratingDerivedCorruptionRows,
    ratingBallotMismatchRows,
    integrityConstraintRows,
    cloudinaryIndexRows,
    cloudinaryUploadColumnRows,
    cloudinaryConsistencyRows,
    ownershipMismatchRows,
    publicationIntegrityRows,
    hallIntegrityRows,
    ratingSeedMismatchRows,
    publicationParityRows,
  ] = await sql.transaction(
    (tx) => [
      tx.query(
        `
          SELECT id, manifest_sha256, document, source_hash
          FROM bhashan.corpus_imports
          WHERE id = $1
        `,
        [snapshot.importId]
      ),
      tx.query(
        `
          SELECT id, path, sha256, wrapper, document, source_text, source_hash
          FROM bhashan.corpus_artifacts
          WHERE import_id = $1
          ORDER BY path
        `,
        [snapshot.importId]
      ),
      tx.query(
        "SELECT id, document, source_hash, managed_by FROM bhashan.parties ORDER BY id"
      ),
      tx.query(
        "SELECT id, document, source_hash, managed_by FROM bhashan.politicians ORDER BY id"
      ),
      tx.query(
        "SELECT id, document, source_hash, managed_by FROM bhashan.statements ORDER BY id"
      ),
      tx.query(
        "SELECT id, position, document, source_hash, managed_by FROM bhashan.rejections ORDER BY position, id"
      ),
      tx.query(
        "SELECT key AS id, document, source_hash, managed_by FROM bhashan.settings ORDER BY key"
      ),
      tx.query(
        "SELECT last_value, is_called FROM bhashan.statement_number_seq"
      ),
      tx.query(
        `
          SELECT
            count(*)::integer AS total,
            count(*) FILTER (WHERE action = 'seed')::integer AS seed
          FROM bhashan.audit_events
        `
      ),
      tx.query(
        `
          SELECT
            relation.relname AS table_name,
            trigger.tgname AS trigger_name,
            trigger.tgdeferrable,
            trigger.tginitdeferred
          FROM pg_trigger AS trigger
          JOIN pg_class AS relation ON relation.oid = trigger.tgrelid
          JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
          WHERE namespace.nspname = 'bhashan'
            AND NOT tgisinternal
            AND trigger.tgenabled IN ('O', 'A')
        `
      ),
      tx.query(`
        SELECT table_schema, table_name
        FROM information_schema.tables
        WHERE (table_schema = 'public' AND table_name IN (
          'auth_user', 'auth_session', 'auth_account', 'auth_verification',
          'auth_rate_limit'
        )) OR (table_schema = 'bhashan' AND table_name IN (
          'statement_watch_sessions', 'statement_watch_receipts',
          'statement_votes', 'statement_vote_exclusions',
          'statement_rating_aggregates', 'cloudinary_video_upload_intents',
          'public_submissions', 'public_submission_events',
          'r2_video_upload_intents',
          'r2_object_deletion_intents'
        ))
      `),
      tx.query(`
        SELECT source.relname AS source_table, target.relname AS target_table
        FROM pg_constraint constraint_record
        JOIN pg_class source ON source.oid = constraint_record.conrelid
        JOIN pg_namespace source_namespace ON source_namespace.oid = source.relnamespace
        JOIN pg_class target ON target.oid = constraint_record.confrelid
        JOIN pg_namespace target_namespace ON target_namespace.oid = target.relnamespace
        WHERE constraint_record.contype = 'f'
          AND source_namespace.nspname = 'bhashan'
          AND source.relname IN (
            'statement_watch_sessions', 'statement_watch_receipts',
            'statement_votes', 'statement_vote_exclusions',
            'cloudinary_video_upload_intents'
          )
          AND target_namespace.nspname = 'public'
          AND target.relname = 'auth_user'
      `),
      tx.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'auth_rate_limit'
        ORDER BY ordinal_position
      `),
      tx.query(`
        SELECT
          constraint_record.contype AS constraint_type,
          array_agg(attribute.attname ORDER BY key_column.ordinality) AS columns
        FROM pg_constraint constraint_record
        JOIN pg_class relation ON relation.oid = constraint_record.conrelid
        JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
        CROSS JOIN LATERAL unnest(constraint_record.conkey)
          WITH ORDINALITY AS key_column(attribute_number, ordinality)
        JOIN pg_attribute attribute
          ON attribute.attrelid = relation.oid
         AND attribute.attnum = key_column.attribute_number
        WHERE namespace.nspname = 'public'
          AND relation.relname = 'auth_rate_limit'
          AND constraint_record.contype IN ('p', 'u')
        GROUP BY constraint_record.oid, constraint_record.contype
      `),
      tx.query(`
        WITH calculated AS (
          SELECT
            aggregate.*,
            CASE
              WHEN aggregate.valid_vote_count = 0 THEN 50::numeric
              ELSE aggregate.valid_vote_sum::numeric / aggregate.valid_vote_count
            END AS expected_performance
          FROM bhashan.statement_rating_aggregates AS aggregate
        )
        SELECT statement_id
        FROM calculated
        WHERE model_version <> 2
          OR prior_strength <> 0
          OR prior_performance <> 50
          OR valid_vote_sum <> (
            vote_25_count * 25
            + vote_50_count * 50
            + vote_75_count * 75
            + vote_100_count * 100
          )
          OR abs(performance - expected_performance) > 0.000001
          OR gp <> round(1000 + 10 * expected_performance)::integer
        ORDER BY statement_id
      `),
      tx.query(`
        WITH immutable_ballots AS (
          SELECT
            vote.statement_id,
            count(*) FILTER (
              WHERE exclusion.vote_id IS NULL
            )::bigint AS valid_vote_count,
            coalesce(sum(vote.value) FILTER (
              WHERE exclusion.vote_id IS NULL
            ), 0)::bigint AS valid_vote_sum,
            count(*) FILTER (
              WHERE exclusion.vote_id IS NULL AND vote.value = 0
            )::bigint AS vote_0_count,
            count(*) FILTER (
              WHERE exclusion.vote_id IS NULL AND vote.value = 25
            )::bigint AS vote_25_count,
            count(*) FILTER (
              WHERE exclusion.vote_id IS NULL AND vote.value = 50
            )::bigint AS vote_50_count,
            count(*) FILTER (
              WHERE exclusion.vote_id IS NULL AND vote.value = 75
            )::bigint AS vote_75_count,
            count(*) FILTER (
              WHERE exclusion.vote_id IS NULL AND vote.value = 100
            )::bigint AS vote_100_count
          FROM bhashan.statement_votes AS vote
          LEFT JOIN bhashan.statement_vote_exclusions AS exclusion
            ON exclusion.vote_id = vote.id
          GROUP BY vote.statement_id
        )
        SELECT coalesce(aggregate.statement_id, ballots.statement_id) AS statement_id
        FROM bhashan.statement_rating_aggregates AS aggregate
        FULL JOIN immutable_ballots AS ballots
          ON ballots.statement_id = aggregate.statement_id
        WHERE aggregate.statement_id IS NULL
          OR ballots.statement_id IS NULL
          OR aggregate.valid_vote_count <> ballots.valid_vote_count
          OR aggregate.valid_vote_sum <> ballots.valid_vote_sum
          OR aggregate.vote_0_count <> ballots.vote_0_count
          OR aggregate.vote_25_count <> ballots.vote_25_count
          OR aggregate.vote_50_count <> ballots.vote_50_count
          OR aggregate.vote_75_count <> ballots.vote_75_count
          OR aggregate.vote_100_count <> ballots.vote_100_count
        ORDER BY statement_id
      `),
      tx.query(`
        SELECT
          constraint_record.conname,
          constraint_record.convalidated,
          constraint_record.condeferrable,
          constraint_record.condeferred,
          pg_get_constraintdef(constraint_record.oid) AS definition
        FROM pg_constraint AS constraint_record
        JOIN pg_class AS relation ON relation.oid = constraint_record.conrelid
        JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
        WHERE namespace.nspname = 'bhashan'
          AND constraint_record.conname IN (
            'statement_watch_sessions_identity_uniq',
            'statement_watch_receipts_identity_uniq',
            'statement_watch_receipts_session_identity_fkey',
            'statement_votes_receipt_identity_fkey',
            'statement_rating_aggregate_weighted_sum_check',
            'statement_rating_aggregate_v2_check',
            'statement_watch_sessions_video_platform_check',
            'cloudinary_video_upload_intents_attachment_unique',
            'cloudinary_video_attachment_lifecycle_check'
          )
      `),
      tx.query(`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE schemaname = 'bhashan'
          AND indexname IN (
            'statements_cloudinary_video_id_uidx',
            'cloudinary_video_upload_intents_public_id_key',
            'cloudinary_video_upload_intents_expiry_idx',
            'cloudinary_video_upload_intents_retention_idx',
            'r2_object_deletion_intents_active_key_uidx',
            'statements_r2_video_id_uidx',
            'r2_video_upload_intents_attachment_idx',
            'r2_video_upload_intents_orphan_audit_idx'
          )
      `),
      tx.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'bhashan'
          AND table_name = 'cloudinary_video_upload_intents'
          AND column_name IN (
            'id', 'actor_user_id', 'status', 'public_id',
            'expected_bytes', 'actual_bytes', 'derived_bytes',
            'asset_id', 'version', 'duration_ms', 'format',
            'rights_attested_at', 'playback_attested_at',
            'attached_statement_id', 'attached_at', 'detached_at',
            'upload_expires_at', 'expires_at', 'processing_started_at',
            'transformation_requested_at', 'completed_at',
            'deletion_started_at', 'deletion_attempt_id', 'deleted_at',
            'last_error_code', 'created_at', 'updated_at'
          )
      `),
      tx.query(`
        SELECT 'cloudinary-statement-attachment' AS kind, statement.id::text AS id
        FROM bhashan.statements AS statement
        LEFT JOIN bhashan.cloudinary_video_upload_intents AS upload
          ON upload.attached_statement_id = statement.id
         AND upload.status = 'completed'
         AND upload.rights_attested_at IS NOT NULL
         AND upload.public_id = statement.document #>> '{video,id}'
         AND upload.asset_id = statement.document #>> '{video,assetId}'
         AND upload.version::text = statement.document #>> '{video,version}'
         AND upload.actual_bytes::text = statement.document #>> '{video,bytes}'
         AND upload.derived_bytes::text = statement.document #>> '{video,derivedBytes}'
         AND upload.duration_ms::text = statement.document #>> '{video,durationMs}'
         AND upload.format = statement.document #>> '{video,format}'
         AND statement.document #>> '{video,start}' = '0'
         AND ((upload.duration_ms + 999) / 1000)::text
           = statement.document #>> '{video,end}'
        WHERE statement.document #>> '{video,platform}' = 'cloudinary'
          AND upload.id IS NULL

        UNION ALL

        SELECT 'cloudinary-intent-attachment', upload.id::text
        FROM bhashan.cloudinary_video_upload_intents AS upload
        LEFT JOIN bhashan.statements AS statement
          ON statement.id = upload.attached_statement_id
        WHERE upload.attached_statement_id IS NOT NULL
          AND (
            statement.id IS NULL
            OR statement.document #>> '{video,platform}' IS DISTINCT FROM 'cloudinary'
            OR upload.status IS DISTINCT FROM 'completed'
            OR upload.rights_attested_at IS NULL
            OR upload.public_id IS DISTINCT FROM statement.document #>> '{video,id}'
            OR upload.asset_id IS DISTINCT FROM statement.document #>> '{video,assetId}'
            OR upload.version::text IS DISTINCT FROM statement.document #>> '{video,version}'
            OR upload.actual_bytes::text IS DISTINCT FROM statement.document #>> '{video,bytes}'
            OR upload.derived_bytes::text IS DISTINCT FROM statement.document #>> '{video,derivedBytes}'
            OR upload.duration_ms::text IS DISTINCT FROM statement.document #>> '{video,durationMs}'
            OR upload.format IS DISTINCT FROM statement.document #>> '{video,format}'
            OR statement.document #>> '{video,start}' IS DISTINCT FROM '0'
            OR ((upload.duration_ms + 999) / 1000)::text
              IS DISTINCT FROM statement.document #>> '{video,end}'
          )

        UNION ALL

        SELECT 'hosted-verification-embed', statement.id::text
        FROM bhashan.statements AS statement
        WHERE statement.document #>> '{verification,embed,platform}'
          IN ('cloudinary', 'r2')
           OR statement.document #>> '{verification,embed,id}'
             LIKE 'statement-videos/%'
           OR statement.document #>> '{verification,embed,id}'
             LIKE 'bhashanboard/statement-videos/%'

        UNION ALL

        SELECT 'residual-r2-statement', statement.id::text
        FROM bhashan.statements AS statement
        WHERE statement.document #>> '{video,platform}' = 'r2'
           OR statement.document #>> '{video,id}' LIKE 'statement-videos/%'

        UNION ALL

        SELECT 'residual-r2-watch-session', session.id::text
        FROM bhashan.statement_watch_sessions AS session
        WHERE session.video_platform = 'r2'
      `),
      tx.query(`
        SELECT 'receipt-session' AS kind, receipt.id::text AS id
        FROM bhashan.statement_watch_receipts AS receipt
        LEFT JOIN bhashan.statement_watch_sessions AS session
          ON session.id = receipt.watch_session_id
         AND session.user_id = receipt.user_id
         AND session.statement_id = receipt.statement_id
         AND session.video_fingerprint = receipt.video_fingerprint
        WHERE session.id IS NULL
          OR session.qualified_at IS NULL
          OR session.reached_end = false
          OR session.credited_watch_ms < session.required_watch_ms
          OR receipt.watched_ms <> session.credited_watch_ms
          OR receipt.required_watch_ms <> session.required_watch_ms
        UNION ALL
        SELECT 'vote-receipt', vote.id::text
        FROM bhashan.statement_votes AS vote
        LEFT JOIN bhashan.statement_watch_receipts AS receipt
          ON receipt.id = vote.watch_receipt_id
         AND receipt.user_id = vote.user_id
         AND receipt.statement_id = vote.statement_id
        WHERE receipt.id IS NULL
      `),
      tx.query(`
        SELECT id
        FROM bhashan.statements AS statement
        WHERE statement.status = 'published'
          AND (
            cardinality(
              bhashan.statement_publication_issues(statement.document)
            ) > 0
            OR NOT bhashan.statement_cloudinary_attachment_ready(
              statement.id,
              statement.document,
              false
            )
          )
        ORDER BY id
      `),
      tx.query(`
        SELECT statement.id
        FROM bhashan.statements AS statement
        LEFT JOIN bhashan.statement_rating_aggregates AS aggregate
          ON aggregate.statement_id = statement.id
        WHERE coalesce(
            (statement.document ->> 'hall_of_fame')::boolean,
            false
          )
          AND (
            statement.status <> 'published'
            OR cardinality(
              bhashan.statement_publication_issues(statement.document)
            ) > 0
            OR NOT bhashan.statement_cloudinary_attachment_ready(
              statement.id,
              statement.document,
              false
            )
            OR coalesce(aggregate.valid_vote_count, 0) < 10
          )
        ORDER BY statement.id
      `),
      tx.query(`
        SELECT statement.id
        FROM bhashan.statements AS statement
        WHERE statement.rating_seed_gp IS DISTINCT FROM CASE
          WHEN EXISTS (
            SELECT 1
            FROM bhashan.statement_votes AS vote
            WHERE vote.statement_id = statement.id
          ) THEN 1500
          WHEN cardinality(
            bhashan.statement_publication_issues(statement.document)
          ) = 0
            AND bhashan.statement_cloudinary_attachment_ready(
              statement.id,
              statement.document,
              false
            )
          THEN 1500
          ELSE NULL
        END
        ORDER BY statement.id
      `),
      tx.query(`
        WITH fixture AS (
          SELECT jsonb_build_object(
            'status', 'published',
            'speaker_id', 'speaker',
            'party_at_time', 'PARTY',
            'category', 'Whataboutery',
            'neutral_title', 'Fixture',
            'quote', 'Fixture quote',
            'language', 'English',
            'video', jsonb_build_object(
              'platform', 'youtube',
              'id', 'abcDEF_1234',
              'start', 0,
              'end', 10
            )
          ) AS document
        )
        SELECT
          cardinality(
            bhashan.statement_publication_issues(document)
          ) = 0 AS valid_fixture,
          cardinality(
            bhashan.statement_publication_issues(
              jsonb_set(document, '{speaker_id}', '42'::jsonb)
            )
          ) > 0 AS rejects_non_string,
          cardinality(
            bhashan.statement_publication_issues(
              jsonb_set(
                document,
                '{neutral_title}',
                to_jsonb(E'\\t\\n'::text)
              )
            )
          ) > 0 AS rejects_whitespace,
          cardinality(
            bhashan.statement_publication_issues(
              jsonb_set(
                document,
                '{video,id}',
                to_jsonb('too-short'::text)
              )
            )
          ) > 0 AS rejects_bad_youtube_id
        FROM fixture
      `),
    ],
    { readOnly: true, isolationLevel: "RepeatableRead" }
  );

  const imported = rowsOf(importRows)[0];
  if (!imported) {
    errors.push(`corpus import ${snapshot.importId} is missing`);
  } else {
    if (String(imported.manifest_sha256) !== snapshot.manifestSha) {
      errors.push("corpus manifest hash differs");
    }
    if (String(imported.source_hash) !== snapshot.manifestSha) {
      errors.push("corpus import source_hash differs");
    }
    if (canonicalJson(imported.document) !== canonicalJson(snapshot.manifestDocument)) {
      errors.push("corpus manifest document differs");
    }
  }

  const artifactMap = indexBy(rowsOf(artifactRows), "path");
  for (const expected of snapshot.artifacts) {
    const found = artifactMap.get(expected.path);
    if (!found) {
      errors.push(`artifact ${expected.path} is missing`);
      continue;
    }
    if (String(found.sha256) !== expected.sha256) {
      errors.push(`artifact ${expected.path} byte hash differs`);
    }
    if (String(found.source_hash) !== expected.sha256) {
      errors.push(`artifact ${expected.path} source_hash differs`);
    }
    if (String(found.source_text) !== expected.sourceText) {
      errors.push(`artifact ${expected.path} source text differs`);
    }
    if (sha256(Buffer.from(String(found.source_text))) !== expected.sha256) {
      errors.push(`artifact ${expected.path} stored bytes do not match its hash`);
    }
    if (canonicalJson(found.document) !== canonicalJson(expected.document)) {
      errors.push(`artifact ${expected.path} parsed document differs`);
    }
    if (canonicalJson(found.wrapper) !== canonicalJson(expected.wrapper)) {
      errors.push(`artifact ${expected.path} wrapper differs`);
    }
  }
  if (artifactMap.size !== snapshot.artifacts.length) {
    errors.push(
      `artifact count differs (database ${artifactMap.size}, local ${snapshot.artifacts.length})`
    );
  }

  const extras = {
    parties: verifyDocuments(
      "parties",
      snapshot.entityRows.parties,
      rowsOf(partyRows),
      errors
    ),
    politicians: verifyDocuments(
      "politicians",
      snapshot.entityRows.politicians,
      rowsOf(politicianRows),
      errors
    ),
    statements: verifyDocuments(
      "statements",
      snapshot.entityRows.statements,
      rowsOf(statementRows),
      errors
    ),
    rejections: verifyDocuments(
      "rejections",
      snapshot.entityRows.rejections,
      rowsOf(rejectionRows),
      errors,
      { position: true }
    ),
    settings: verifyDocuments(
      "settings",
      snapshot.entityRows.settings,
      rowsOf(settingRows),
      errors
    ),
  };

  const highestStatement = Math.max(
    ...snapshot.entityRows.statements.map((row) => Number(row.id.slice(3)))
  );
  const sequence = rowsOf(sequenceRows)[0];
  if (
    !sequence ||
    Number(sequence.last_value) < highestStatement ||
    sequence.is_called !== true
  ) {
    errors.push("statement ID sequence is not positioned after the imported corpus");
  }

  const triggerSet = new Set(
    rowsOf(triggerRows).map(
      (row) => `${String(row.table_name)}:${String(row.trigger_name)}`
    )
  );
  const extensionTableSet = new Set(
    rowsOf(extensionTableRows).map(
      (row) => `${String(row.table_schema)}.${String(row.table_name)}`
    )
  );
  for (const table of [
    "public.auth_user",
    "public.auth_session",
    "public.auth_account",
    "public.auth_verification",
    "public.auth_rate_limit",
    "bhashan.statement_watch_sessions",
    "bhashan.statement_watch_receipts",
    "bhashan.statement_votes",
    "bhashan.statement_vote_exclusions",
    "bhashan.statement_rating_aggregates",
    "bhashan.cloudinary_video_upload_intents",
    "bhashan.public_submissions",
    "bhashan.public_submission_events",
  ]) {
    if (!extensionTableSet.has(table)) errors.push(`missing table ${table}`);
  }
  for (const table of [
    "bhashan.r2_video_upload_intents",
    "bhashan.r2_object_deletion_intents",
  ]) {
    if (extensionTableSet.has(table)) errors.push(`obsolete table ${table} still exists`);
  }

  const expectedRateLimitColumns = new Map([
    ["id", "text"],
    ["key", "text"],
    ["count", "integer"],
    ["last_request", "bigint"],
  ]);
  const rateLimitColumns = new Map(
    rowsOf(authRateLimitColumnRows).map((row) => [
      String(row.column_name),
      { type: String(row.data_type), nullable: String(row.is_nullable) },
    ])
  );
  for (const [column, type] of expectedRateLimitColumns) {
    const actual = rateLimitColumns.get(column);
    if (!actual) {
      errors.push(`auth_rate_limit is missing column ${column}`);
    } else {
      if (actual.type !== type) {
        errors.push(`auth_rate_limit.${column} has type ${actual.type}, expected ${type}`);
      }
      if (actual.nullable !== "NO") {
        errors.push(`auth_rate_limit.${column} must be NOT NULL`);
      }
    }
  }
  const rateLimitConstraints = rowsOf(authRateLimitConstraintRows).map((row) => ({
    type: String(row.constraint_type),
    columns: Array.isArray(row.columns)
      ? row.columns.map(String)
      : String(row.columns).replace(/^\{|\}$/g, "").split(","),
  }));
  if (
    !rateLimitConstraints.some(
      (constraint) => constraint.type === "p" && constraint.columns.join(",") === "id"
    )
  ) {
    errors.push("auth_rate_limit must have a primary key on id");
  }
  if (
    !rateLimitConstraints.some(
      (constraint) => constraint.type === "u" && constraint.columns.join(",") === "key"
    )
  ) {
    errors.push("auth_rate_limit must have a unique constraint on key");
  }

  const ratingDerivedCorruptionIds = rowsOf(ratingDerivedCorruptionRows).map(
    (row) => String(row.statement_id)
  );
  if (ratingDerivedCorruptionIds.length > 0) {
    errors.push(
      `rating aggregate derived fields are corrupt for ${conciseIds(
        ratingDerivedCorruptionIds
      )}`
    );
  }
  const ratingBallotMismatchIds = rowsOf(ratingBallotMismatchRows).map(
    (row) => String(row.statement_id)
  );
  if (ratingBallotMismatchIds.length > 0) {
    errors.push(
      `rating aggregate totals differ from immutable ballots for ${conciseIds(
        ratingBallotMismatchIds
      )}`
    );
  }

  const requiredIntegrityConstraints = new Set([
    "statement_watch_sessions_identity_uniq",
    "statement_watch_receipts_identity_uniq",
    "statement_watch_receipts_session_identity_fkey",
    "statement_votes_receipt_identity_fkey",
    "statement_rating_aggregate_weighted_sum_check",
    "statement_rating_aggregate_v2_check",
    "statement_watch_sessions_video_platform_check",
    "cloudinary_video_upload_intents_attachment_unique",
    "cloudinary_video_attachment_lifecycle_check",
  ]);
  for (const row of rowsOf(integrityConstraintRows)) {
    if (row.convalidated === true || row.convalidated === "true") {
      requiredIntegrityConstraints.delete(String(row.conname));
    }
  }
  for (const name of requiredIntegrityConstraints) {
    errors.push(`missing or unvalidated integrity constraint ${name}`);
  }
  const videoPlatformConstraint = rowsOf(integrityConstraintRows).find(
    (row) => String(row.conname) === "statement_watch_sessions_video_platform_check"
  );
  if (
    !videoPlatformConstraint ||
    !/\bcloudinary\b/.test(String(videoPlatformConstraint.definition)) ||
    /'r2'/.test(String(videoPlatformConstraint.definition))
  ) {
    errors.push(
      "statement_watch_sessions_video_platform_check must allow Cloudinary and reject R2"
    );
  }
  const cloudinaryLifecycleConstraint = rowsOf(integrityConstraintRows).find(
    (row) =>
      String(row.conname) === "cloudinary_video_attachment_lifecycle_check"
  );
  if (
    !cloudinaryLifecycleConstraint ||
    !/status = 'completed'/i.test(
      String(cloudinaryLifecycleConstraint.definition)
    ) ||
    !/rights_attested_at IS NOT NULL/i.test(
      String(cloudinaryLifecycleConstraint.definition)
    ) ||
    /playback_attested_at IS NOT NULL/i.test(
      String(cloudinaryLifecycleConstraint.definition)
    )
  ) {
    errors.push(
      "Cloudinary attachment lifecycle must require completed, rights-attested media without requiring admin playback"
    );
  }
  const cloudinaryAttachmentConstraint = rowsOf(integrityConstraintRows).find(
    (row) =>
      String(row.conname) ===
      "cloudinary_video_upload_intents_attachment_unique"
  );
  if (
    !cloudinaryAttachmentConstraint ||
    !(
      cloudinaryAttachmentConstraint.condeferrable === true ||
      cloudinaryAttachmentConstraint.condeferrable === "true"
    ) ||
    !(
      cloudinaryAttachmentConstraint.condeferred === true ||
      cloudinaryAttachmentConstraint.condeferred === "true"
    ) ||
    !/UNIQUE \(attached_statement_id\) DEFERRABLE INITIALLY DEFERRED/i.test(
      String(cloudinaryAttachmentConstraint.definition)
    )
  ) {
    errors.push(
      "Cloudinary statement attachment uniqueness must be deferrable and initially deferred"
    );
  }

  const requiredCloudinaryUniqueIndexes = new Set([
    "statements_cloudinary_video_id_uidx",
  ]);
  for (const row of rowsOf(cloudinaryIndexRows)) {
    const name = String(row.indexname);
    const definition = String(row.indexdef);
    if (/^CREATE UNIQUE INDEX\b/i.test(definition) && /\bWHERE\b/i.test(definition)) {
      requiredCloudinaryUniqueIndexes.delete(name);
    }
  }
  for (const name of requiredCloudinaryUniqueIndexes) {
    errors.push(`missing or non-partial unique Cloudinary index ${name}`);
  }
  const cloudinaryPublicIdIndex = rowsOf(cloudinaryIndexRows).find(
    (row) =>
      String(row.indexname) ===
      "cloudinary_video_upload_intents_public_id_key"
  );
  if (
    !cloudinaryPublicIdIndex ||
    !/^CREATE UNIQUE INDEX\b/i.test(String(cloudinaryPublicIdIndex.indexdef)) ||
    /\bWHERE\b/i.test(String(cloudinaryPublicIdIndex.indexdef))
  ) {
    errors.push(
      "cloudinary_video_upload_intents.public_id must have an unconditional unique index"
    );
  }
  const cloudinaryIndexSet = new Set(
    rowsOf(cloudinaryIndexRows).map((row) => String(row.indexname))
  );
  for (const name of [
    "cloudinary_video_upload_intents_expiry_idx",
    "cloudinary_video_upload_intents_retention_idx",
  ]) {
    if (!cloudinaryIndexSet.has(name)) {
      errors.push(`missing Cloudinary lifecycle index ${name}`);
    }
  }
  const cloudinaryExpiryIndex = rowsOf(cloudinaryIndexRows).find(
    (row) =>
      String(row.indexname) === "cloudinary_video_upload_intents_expiry_idx"
  );
  if (
    cloudinaryExpiryIndex &&
    (
      !/\bupload_expires_at\b/i.test(String(cloudinaryExpiryIndex.indexdef)) ||
      !/\bexpires_at\b/i.test(String(cloudinaryExpiryIndex.indexdef)) ||
      !/\bWHERE\b/i.test(String(cloudinaryExpiryIndex.indexdef))
    )
  ) {
    errors.push("Cloudinary expiry index does not cover both upload leases");
  }
  const cloudinaryRetentionIndex = rowsOf(cloudinaryIndexRows).find(
    (row) =>
      String(row.indexname) === "cloudinary_video_upload_intents_retention_idx"
  );
  if (
    cloudinaryRetentionIndex &&
    (
      !/coalesce\(detached_at, completed_at\)/i.test(
        String(cloudinaryRetentionIndex.indexdef)
      ) ||
      !/\bWHERE\b/i.test(String(cloudinaryRetentionIndex.indexdef))
    )
  ) {
    errors.push("Cloudinary retention index does not preserve the post-detach grace period");
  }
  for (const name of [
    "r2_object_deletion_intents_active_key_uidx",
    "statements_r2_video_id_uidx",
    "r2_video_upload_intents_attachment_idx",
    "r2_video_upload_intents_orphan_audit_idx",
  ]) {
    if (cloudinaryIndexSet.has(name)) errors.push(`obsolete R2 index ${name} still exists`);
  }
  const cloudinaryUploadColumns = new Map(
    rowsOf(cloudinaryUploadColumnRows).map((row) => [
      String(row.column_name),
      { type: String(row.data_type), nullable: String(row.is_nullable) },
    ])
  );
  for (const [column, type, nullable] of [
    ["id", "uuid", "NO"],
    ["actor_user_id", "text", "NO"],
    ["status", "text", "NO"],
    ["public_id", "text", "NO"],
    ["expected_bytes", "bigint", "NO"],
    ["actual_bytes", "bigint", "YES"],
    ["derived_bytes", "bigint", "YES"],
    ["asset_id", "text", "YES"],
    ["version", "bigint", "YES"],
    ["duration_ms", "integer", "YES"],
    ["format", "text", "YES"],
    ["rights_attested_at", "timestamp with time zone", "NO"],
    ["playback_attested_at", "timestamp with time zone", "YES"],
    ["attached_statement_id", "text", "YES"],
    ["attached_at", "timestamp with time zone", "YES"],
    ["detached_at", "timestamp with time zone", "YES"],
    ["upload_expires_at", "timestamp with time zone", "NO"],
    ["expires_at", "timestamp with time zone", "NO"],
    ["processing_started_at", "timestamp with time zone", "YES"],
    ["transformation_requested_at", "timestamp with time zone", "YES"],
    ["completed_at", "timestamp with time zone", "YES"],
    ["deletion_started_at", "timestamp with time zone", "YES"],
    ["deletion_attempt_id", "uuid", "YES"],
    ["deleted_at", "timestamp with time zone", "YES"],
    ["last_error_code", "text", "YES"],
    ["created_at", "timestamp with time zone", "NO"],
    ["updated_at", "timestamp with time zone", "NO"],
  ]) {
    const actual = cloudinaryUploadColumns.get(column);
    if (!actual) {
      errors.push(`cloudinary_video_upload_intents is missing column ${column}`);
    } else if (actual.type !== type || actual.nullable !== nullable) {
      errors.push(
        `cloudinary_video_upload_intents.${column} must be ${type} nullable=${nullable}`
      );
    }
  }
  const cloudinaryConsistencyIssues = rowsOf(cloudinaryConsistencyRows).map(
    (row) => `${String(row.kind)}:${String(row.id)}`
  );
  if (cloudinaryConsistencyIssues.length > 0) {
    errors.push(
      `hosted-video attachment consistency failed for ${conciseIds(
        cloudinaryConsistencyIssues
      )}`
    );
  }
  const ownershipMismatches = rowsOf(ownershipMismatchRows).map(
    (row) => `${String(row.kind)}:${String(row.id)}`
  );
  if (ownershipMismatches.length > 0) {
    errors.push(`receipt/vote ownership mismatch for ${conciseIds(ownershipMismatches)}`);
  }
  const invalidPublicationIds = rowsOf(publicationIntegrityRows).map((row) =>
    String(row.id)
  );
  if (invalidPublicationIds.length > 0) {
    errors.push(
      `published statements fail the publication bar: ${conciseIds(
        invalidPublicationIds
      )}`
    );
  }
  const invalidHallIds = rowsOf(hallIntegrityRows).map((row) => String(row.id));
  if (invalidHallIds.length > 0) {
    errors.push(
      `Hall of Fame statements fail the live maturity bar: ${conciseIds(
        invalidHallIds
      )}`
    );
  }
  const invalidRatingSeedIds = rowsOf(ratingSeedMismatchRows).map((row) =>
    String(row.id)
  );
  if (invalidRatingSeedIds.length > 0) {
    errors.push(
      `statement rating seed markers are not neutral model-v2 values: ${conciseIds(
        invalidRatingSeedIds
      )}`
    );
  }
  const publicationParity = rowsOf(publicationParityRows)[0];
  for (const check of [
    "valid_fixture",
    "rejects_non_string",
    "rejects_whitespace",
    "rejects_bad_youtube_id",
  ]) {
    if (
      !publicationParity ||
      (publicationParity[check] !== true &&
        publicationParity[check] !== "true")
    ) {
      errors.push(`publication contract parity check failed: ${check}`);
    }
  }

  const authForeignKeySet = new Set(
    rowsOf(authForeignKeyRows).map((row) => String(row.source_table))
  );
  for (const table of [
    "statement_watch_sessions",
    "statement_watch_receipts",
    "statement_votes",
    "statement_vote_exclusions",
    "cloudinary_video_upload_intents",
  ]) {
    if (!authForeignKeySet.has(table)) {
      errors.push(`missing auth-user foreign key from bhashan.${table}`);
    }
  }
  for (const table of ["parties", "politicians", "statements", "rejections", "settings"]) {
    for (const trigger of ["prepare_document_mutation", "audit_document_change"]) {
      if (!triggerSet.has(`${table}:${trigger}`)) {
        errors.push(`missing trigger ${table}:${trigger}`);
      }
    }
  }
  for (const trigger of [
    "statements:prepare_statement_rating_seed",
    "statements:protect_statement_rating_inputs",
    "statements:enforce_statement_publication_integrity",
    "statements:enforce_statement_cloudinary_attachment",
    "cloudinary_video_upload_intents:enforce_cloudinary_upload_statement_attachment",
    "statement_rating_aggregates:enforce_statement_rating_aggregate_v2",
    "statement_rating_aggregates:clear_immature_statement_hall_of_fame",
    "public_submission_events:prevent_public_submission_event_mutation",
    "public_submission_events:prevent_public_submission_event_truncate",
    "audit_events:prevent_audit_event_mutation",
    "audit_events:prevent_audit_event_truncate",
    "corpus_imports:prevent_history_mutation",
    "corpus_imports:prevent_history_truncate",
    "corpus_artifacts:prevent_history_mutation",
    "corpus_artifacts:prevent_history_truncate",
    "statement_watch_receipts:prevent_watch_receipt_mutation",
    "statement_watch_receipts:prevent_watch_receipt_truncate",
    "statement_watch_receipts:validate_watch_receipt_insert",
    "statement_votes:prevent_statement_vote_mutation",
    "statement_votes:prevent_statement_vote_truncate",
    "statement_votes:serialize_statement_vote_insert",
    "statement_vote_exclusions:prevent_vote_exclusion_mutation",
    "statement_vote_exclusions:prevent_vote_exclusion_truncate",
  ]) {
    if (!triggerSet.has(trigger)) errors.push(`missing trigger ${trigger}`);
  }
  for (const [tableName, triggerName] of [
    ["statements", "enforce_statement_cloudinary_attachment"],
    [
      "cloudinary_video_upload_intents",
      "enforce_cloudinary_upload_statement_attachment",
    ],
  ]) {
    const deferredCloudinaryTrigger = rowsOf(triggerRows).find(
      (row) =>
        String(row.table_name) === tableName &&
        String(row.trigger_name) === triggerName
    );
    if (
      !deferredCloudinaryTrigger ||
      !(
        deferredCloudinaryTrigger.tgdeferrable === true ||
        deferredCloudinaryTrigger.tgdeferrable === "true"
      ) ||
      !(
        deferredCloudinaryTrigger.tginitdeferred === true ||
        deferredCloudinaryTrigger.tginitdeferred === "true"
      )
    ) {
      errors.push(
        `${tableName}.${triggerName} must be deferrable and initially deferred`
      );
    }
  }

  if (snapshot.legacyAuditRows.length > 0) {
    const expectedAudit = indexBy(snapshot.legacyAuditRows, "event_key");
    const remoteAudit = rowsOf(
      await sql.query(
        `
          SELECT event_key, after_row
          FROM bhashan.audit_events
          WHERE event_key IN (SELECT jsonb_array_elements_text($1::jsonb))
        `,
        [JSON.stringify([...expectedAudit.keys()])]
      )
    );
    const remoteAuditMap = indexBy(remoteAudit, "event_key");
    for (const [eventKey, expected] of expectedAudit) {
      const found = remoteAuditMap.get(eventKey);
      if (!found) {
        errors.push(`legacy audit event ${eventKey} is missing`);
      } else if (
        canonicalJson(found.after_row) !== canonicalJson(expected.after_row)
      ) {
        errors.push(`legacy audit event ${eventKey} differs`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`verification found ${errors.length} problem(s):\n- ${errors.join("\n- ")}`);
  }

  const counts = snapshot.manifestDocument.counts;
  console.log(`Verified manifest ${shortHash(snapshot.manifestSha)} and ${counts.artifacts} exact source artifacts.`);
  console.log(
    `Verified ${counts.statements} statements, ${counts.politicians} politicians, ` +
      `${counts.parties} parties, ${counts.rejections} rejections, and ${counts.settings} setting.`
  );
  const extraLabels = Object.entries(extras)
    .filter(([, ids]) => ids.length > 0)
    .map(([table, ids]) => `${table}: ${conciseIds(ids)}`);
  if (extraLabels.length > 0) {
    console.log(`Preserved additional admin rows (${extraLabels.join("; ")}).`);
  }
  const audit = rowsOf(auditRows)[0] ?? { total: 0, seed: 0 };
  console.log(
    `Audit ledger: ${Number(audit.total)} event(s), including ${Number(audit.seed)} seed event(s).`
  );
}

main().catch((error) => {
  console.error(`Database verification failed: ${safeErrorMessage(error)}`);
  process.exitCode = 1;
});
