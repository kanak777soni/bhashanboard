import {
  buildLocalSnapshot,
  conciseIds,
  createSqlClient,
  rowsOf,
  safeErrorMessage,
  shortHash,
} from "./db-common.mjs";

function json(value) {
  return JSON.stringify(value);
}

async function main() {
  // Validate every local relationship before opening a network connection.
  const snapshot = buildLocalSnapshot();
  const sql = await createSqlClient();

  const migration = rowsOf(
    await sql.query(
      "SELECT name FROM bhashan.schema_migrations WHERE name = '0001_initial.sql'"
    )
  )[0];
  if (!migration) {
    throw new Error("Database schema is missing. Run npm run db:migrate first.");
  }

  const existingImport = rowsOf(
    await sql.query(
      "SELECT id FROM bhashan.corpus_imports WHERE manifest_sha256 = $1 LIMIT 1",
      [snapshot.manifestSha]
    )
  )[0];
  if (existingImport) {
    console.log(
      `Corpus already imported (${shortHash(snapshot.manifestSha)}); no changes.`
    );
    return;
  }

  const protectedRows = rowsOf(
    await sql.query(
      `
        SELECT 'parties' AS table_name, id
        FROM bhashan.parties
        WHERE managed_by <> 'json_seed'
          AND id IN (SELECT jsonb_array_elements_text($1::jsonb))
        UNION ALL
        SELECT 'politicians', id
        FROM bhashan.politicians
        WHERE managed_by <> 'json_seed'
          AND id IN (SELECT jsonb_array_elements_text($2::jsonb))
        UNION ALL
        SELECT 'statements', id
        FROM bhashan.statements
        WHERE managed_by <> 'json_seed'
          AND id IN (SELECT jsonb_array_elements_text($3::jsonb))
        UNION ALL
        SELECT 'rejections', id
        FROM bhashan.rejections
        WHERE managed_by <> 'json_seed'
          AND id IN (SELECT jsonb_array_elements_text($4::jsonb))
        UNION ALL
        SELECT 'settings', key
        FROM bhashan.settings
        WHERE managed_by <> 'json_seed'
          AND key IN (SELECT jsonb_array_elements_text($5::jsonb))
      `,
      [
        json(snapshot.entityRows.parties.map((row) => row.id)),
        json(snapshot.entityRows.politicians.map((row) => row.id)),
        json(snapshot.entityRows.statements.map((row) => row.id)),
        json(snapshot.entityRows.rejections.map((row) => row.id)),
        json(snapshot.entityRows.settings.map((row) => row.id)),
      ]
    )
  );
  if (protectedRows.length > 0) {
    console.warn(
      `Preserving admin-managed rows while importing the remaining corpus: ${conciseIds(
        protectedRows.map((row) => `${row.table_name}:${row.id}`)
      )}. Their audited database documents remain authoritative.`
    );
  }

  const detail = `Imported corpus ${snapshot.documents.statements.corpus} ${
    snapshot.documents.statements.version
  } (${shortHash(snapshot.manifestSha)}).`;
  const artifacts = snapshot.artifactRows.map((row) => ({
    ...row,
    import_id: snapshot.importId,
  }));
  const withImport = (rows) =>
    rows.map((row) => ({
      ...row,
      import_id: snapshot.importId,
      managed_by: "json_seed",
    }));

  await sql.transaction((tx) => [
    tx.query("SELECT pg_advisory_xact_lock(hashtextextended('bhashan:corpus-import', 0))"),
    tx.query("SELECT set_config('bhashan.actor', 'json-import', true)"),
    tx.query("SELECT set_config('bhashan.action', 'seed', true)"),
    tx.query("SELECT set_config('bhashan.detail', $1, true)", [detail]),
    tx.query("SET CONSTRAINTS ALL DEFERRED"),
    tx.query(
      `
        INSERT INTO bhashan.corpus_imports (
          id, manifest_sha256, corpus, corpus_version, compiled_on,
          source_commit, source_dirty, document, source_hash
        )
        VALUES ($1, $2, $3, $4, $5::date, $6, $7, $8::jsonb, $9)
        ON CONFLICT (id) DO NOTHING
      `,
      [
        snapshot.importId,
        snapshot.manifestSha,
        snapshot.documents.statements.corpus,
        snapshot.documents.statements.version,
        snapshot.documents.statements.compiled,
        snapshot.git.commit,
        snapshot.git.dirty,
        json(snapshot.manifestDocument),
        snapshot.manifestSha,
      ]
    ),
    tx.query(
      `
        INSERT INTO bhashan.corpus_artifacts (
          id, import_id, path, sha256, wrapper, document,
          source_text, source_hash
        )
        SELECT
          incoming.id,
          incoming.import_id,
          incoming.path,
          incoming.sha256,
          incoming.wrapper,
          incoming.document,
          incoming.source_text,
          incoming.source_hash
        FROM jsonb_to_recordset($1::jsonb) AS incoming(
          id text,
          import_id text,
          path text,
          sha256 text,
          wrapper jsonb,
          document jsonb,
          source_text text,
          source_hash text
        )
        ON CONFLICT (id) DO NOTHING
      `,
      [json(artifacts)]
    ),
    tx.query(
      `
        INSERT INTO bhashan.parties AS target (
          id, document, import_id, source_hash, managed_by
        )
        SELECT id, document, import_id, source_hash, managed_by
        FROM jsonb_to_recordset($1::jsonb) AS incoming(
          id text,
          document jsonb,
          import_id text,
          source_hash text,
          managed_by text
        )
        ON CONFLICT (id) DO UPDATE SET
          document = EXCLUDED.document,
          import_id = EXCLUDED.import_id,
          source_hash = EXCLUDED.source_hash,
          managed_by = EXCLUDED.managed_by,
          version = target.version + 1,
          updated_at = clock_timestamp()
        WHERE target.managed_by = 'json_seed'
          AND target.source_hash IS DISTINCT FROM EXCLUDED.source_hash
      `,
      [json(withImport(snapshot.entityRows.parties))]
    ),
    tx.query(
      `
        INSERT INTO bhashan.politicians AS target (
          id, document, import_id, source_hash, managed_by
        )
        SELECT id, document, import_id, source_hash, managed_by
        FROM jsonb_to_recordset($1::jsonb) AS incoming(
          id text,
          document jsonb,
          import_id text,
          source_hash text,
          managed_by text
        )
        ON CONFLICT (id) DO UPDATE SET
          document = EXCLUDED.document,
          import_id = EXCLUDED.import_id,
          source_hash = EXCLUDED.source_hash,
          managed_by = EXCLUDED.managed_by,
          version = target.version + 1,
          updated_at = clock_timestamp()
        WHERE target.managed_by = 'json_seed'
          AND target.source_hash IS DISTINCT FROM EXCLUDED.source_hash
      `,
      [json(withImport(snapshot.entityRows.politicians))]
    ),
    tx.query(
      `
        INSERT INTO bhashan.statements AS target (
          id, document, import_id, source_hash, managed_by
        )
        SELECT id, document, import_id, source_hash, managed_by
        FROM jsonb_to_recordset($1::jsonb) AS incoming(
          id text,
          document jsonb,
          import_id text,
          source_hash text,
          managed_by text
        )
        ON CONFLICT (id) DO UPDATE SET
          document = EXCLUDED.document,
          import_id = EXCLUDED.import_id,
          source_hash = EXCLUDED.source_hash,
          managed_by = EXCLUDED.managed_by,
          version = target.version + 1,
          updated_at = clock_timestamp()
        WHERE target.managed_by = 'json_seed'
          AND target.source_hash IS DISTINCT FROM EXCLUDED.source_hash
      `,
      [json(withImport(snapshot.entityRows.statements))]
    ),
    tx.query(
      `
        INSERT INTO bhashan.rejections AS target (
          id, position, document, import_id, source_hash, managed_by
        )
        SELECT id, position, document, import_id, source_hash, managed_by
        FROM jsonb_to_recordset($1::jsonb) AS incoming(
          id text,
          position integer,
          document jsonb,
          import_id text,
          source_hash text,
          managed_by text
        )
        ON CONFLICT (id) DO UPDATE SET
          position = EXCLUDED.position,
          document = EXCLUDED.document,
          import_id = EXCLUDED.import_id,
          source_hash = EXCLUDED.source_hash,
          managed_by = EXCLUDED.managed_by,
          version = target.version + 1,
          updated_at = clock_timestamp()
        WHERE target.managed_by = 'json_seed'
          AND (
            target.source_hash IS DISTINCT FROM EXCLUDED.source_hash
            OR target.position IS DISTINCT FROM EXCLUDED.position
          )
      `,
      [json(withImport(snapshot.entityRows.rejections))]
    ),
    tx.query(
      `
        INSERT INTO bhashan.settings AS target (
          key, document, import_id, source_hash, managed_by
        )
        SELECT id, document, import_id, source_hash, managed_by
        FROM jsonb_to_recordset($1::jsonb) AS incoming(
          id text,
          document jsonb,
          import_id text,
          source_hash text,
          managed_by text
        )
        ON CONFLICT (key) DO UPDATE SET
          document = EXCLUDED.document,
          import_id = EXCLUDED.import_id,
          source_hash = EXCLUDED.source_hash,
          managed_by = EXCLUDED.managed_by,
          version = target.version + 1,
          updated_at = clock_timestamp()
        WHERE target.managed_by = 'json_seed'
          AND target.source_hash IS DISTINCT FROM EXCLUDED.source_hash
      `,
      [json(withImport(snapshot.entityRows.settings))]
    ),
    tx.query(
      `
        INSERT INTO bhashan.audit_events (
          event_key, table_schema, table_name, target_id, operation,
          actor, action, detail, after_row, occurred_at
        )
        SELECT
          event_key,
          'legacy-json',
          'audit',
          target_id,
          'IMPORT',
          actor,
          action,
          detail,
          after_row,
          coalesce(occurred_at, clock_timestamp())
        FROM jsonb_to_recordset($1::jsonb) AS incoming(
          event_key text,
          target_id text,
          actor text,
          action text,
          detail text,
          after_row jsonb,
          occurred_at timestamptz
        )
        ON CONFLICT (event_key) DO NOTHING
      `,
      [json(snapshot.legacyAuditRows)]
    ),
    tx.query(`
      SELECT setval(
        'bhashan.statement_number_seq',
        greatest(
          (SELECT coalesce(max(statement_number), 1) FROM bhashan.statements),
          (SELECT last_value FROM bhashan.statement_number_seq),
          1
        ),
        true
      )
    `),
  ]);

  const counts = snapshot.manifestDocument.counts;
  console.log(
    `Imported ${counts.statements} statements, ${counts.politicians} politicians, ` +
      `${counts.parties} parties, and ${counts.rejections} rejections.`
  );
  console.log(`Manifest ${shortHash(snapshot.manifestSha)} (${snapshot.importId})`);
}

main().catch((error) => {
  console.error(`Database import failed: ${safeErrorMessage(error)}`);
  process.exitCode = 1;
});
