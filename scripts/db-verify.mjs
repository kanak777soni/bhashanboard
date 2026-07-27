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
          SELECT relation.relname AS table_name, trigger.tgname AS trigger_name
          FROM pg_trigger AS trigger
          JOIN pg_class AS relation ON relation.oid = trigger.tgrelid
          JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
          WHERE namespace.nspname = 'bhashan'
            AND NOT tgisinternal
        `
      ),
    ],
    { readOnly: true }
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
  for (const table of ["parties", "politicians", "statements", "rejections", "settings"]) {
    for (const trigger of ["prepare_document_mutation", "audit_document_change"]) {
      if (!triggerSet.has(`${table}:${trigger}`)) {
        errors.push(`missing trigger ${table}:${trigger}`);
      }
    }
  }
  for (const trigger of [
    "audit_events:prevent_audit_event_mutation",
    "audit_events:prevent_audit_event_truncate",
    "corpus_imports:prevent_history_mutation",
    "corpus_imports:prevent_history_truncate",
    "corpus_artifacts:prevent_history_mutation",
    "corpus_artifacts:prevent_history_truncate",
  ]) {
    if (!triggerSet.has(trigger)) errors.push(`missing trigger ${trigger}`);
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
