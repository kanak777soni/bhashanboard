import {
  createSqlClient,
  listMigrationFiles,
  safeErrorMessage,
  sha256,
  shortHash,
  splitMigration,
} from "./db-common.mjs";

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function conditionalStatement(migrationName, checksum, index, statement) {
  const suffix = `${checksum.slice(0, 12)}_${index}`;
  const blockTag = `$migration_${suffix}$`;
  const statementTag = `$migration_sql_${suffix}$`;
  if (statement.includes(statementTag)) {
    throw new Error(`Migration ${migrationName} contains a reserved migration runner tag.`);
  }
  return `
    DO ${blockTag}
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM bhashan.schema_migrations
        WHERE name = ${sqlLiteral(migrationName)}
      ) THEN
        EXECUTE ${statementTag}${statement}${statementTag};
      END IF;
    END
    ${blockTag}
  `;
}

function checksumGuard(migrationName, checksum) {
  const blockTag = `$checksum_guard_${checksum.slice(0, 12)}$`;
  return `
    DO ${blockTag}
    DECLARE
      applied_checksum text;
    BEGIN
      SELECT schema_migrations.checksum
      INTO applied_checksum
      FROM bhashan.schema_migrations
      WHERE name = ${sqlLiteral(migrationName)};

      IF applied_checksum IS NOT NULL
        AND applied_checksum <> ${sqlLiteral(checksum)}
      THEN
        RAISE EXCEPTION 'checksum mismatch for migration %', ${sqlLiteral(
          migrationName
        )};
      END IF;
    END
    ${blockTag}
  `;
}

async function main() {
  const migrations = listMigrationFiles().map((migration) => ({
    ...migration,
    checksum: sha256(migration.sql),
    statements: splitMigration(migration.sql),
  }));
  if (migrations.length === 0) {
    throw new Error("No migration files were found in db/migrations.");
  }
  for (const migration of migrations) {
    if (migration.statements.length === 0) {
      throw new Error(`Migration ${migration.name} has no SQL statements.`);
    }
  }

  // The lock, bootstrap, checksum guards, DDL and migration markers all commit
  // together. A concurrent runner waits before it makes any schema decision.
  const sql = await createSqlClient();
  await sql.transaction((tx) => {
    const queries = [
      tx.query(
        "SELECT pg_advisory_xact_lock(hashtextextended('bhashan:schema-migrations', 0))"
      ),
      tx.query("CREATE SCHEMA IF NOT EXISTS bhashan"),
      tx.query(`
        CREATE TABLE IF NOT EXISTS bhashan.schema_migrations (
          name text PRIMARY KEY,
          checksum text NOT NULL CHECK (checksum ~ '^[0-9a-f]{64}$'),
          applied_at timestamptz NOT NULL DEFAULT clock_timestamp()
        )
      `),
    ];

    for (const migration of migrations) {
      queries.push(
        tx.query(checksumGuard(migration.name, migration.checksum))
      );
      migration.statements.forEach((statement, index) => {
        queries.push(
          tx.query(
            conditionalStatement(
              migration.name,
              migration.checksum,
              index,
              statement
            )
          )
        );
      });
      queries.push(
        tx.query(
          `
            INSERT INTO bhashan.schema_migrations (name, checksum)
            VALUES ($1, $2)
            ON CONFLICT (name) DO NOTHING
          `,
          [migration.name, migration.checksum]
        )
      );
    }
    return queries;
  });

  console.log(`Database migrations verified: ${migrations.length}.`);
  for (const migration of migrations) {
    console.log(`- ${migration.name} ${shortHash(migration.checksum)}`);
  }
}

main().catch((error) => {
  console.error(`Database migration failed: ${safeErrorMessage(error)}`);
  process.exitCode = 1;
});
