import {
  createSqlClient,
  rowsOf,
  safeErrorMessage,
} from "./db-common.mjs";

function requestedEmail() {
  const args = process.argv.slice(2).filter((arg) => arg !== "--");
  if (args.length !== 1) {
    throw new Error(
      "Usage: npm run admin:promote -- verified-user@example.com"
    );
  }
  const email = args[0].trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
    throw new Error("Enter the verified account's valid email address.");
  }
  return email;
}

async function main() {
  const email = requestedEmail();
  const sql = await createSqlClient();
  const results = await sql.transaction((tx) => [
    tx.query(
      "SELECT pg_advisory_xact_lock(hashtextextended('bhashan:registered-admins', 0))"
    ),
    tx.query(
      `
        WITH target AS MATERIALIZED (
          SELECT users.*
          FROM public.auth_user AS users
          WHERE lower(users.email) = lower($1)
            AND users."anonymizedAt" IS NULL
          FOR UPDATE
        ),
        promoted AS (
          UPDATE public.auth_user AS users
          SET role = 'admin', "updatedAt" = clock_timestamp()
          FROM target
          WHERE users.id = target.id
            AND target."emailVerified" = true
            AND (
              target.banned = false
              OR (
                target."banExpires" IS NOT NULL
                AND target."banExpires" <= clock_timestamp()
              )
            )
            AND NOT EXISTS (
              SELECT 1 FROM public.auth_user AS existing
              WHERE existing.role = 'admin'
            )
          RETURNING users.*
        ),
        logged AS (
          INSERT INTO bhashan.audit_events (
            table_schema, table_name, target_id, operation,
            actor, action, detail, after_row
          )
          SELECT
            'public', 'auth_user', promoted.id, 'UPDATE',
            'local-admin-bootstrap', 'user-role',
            'Promoted the first verified registered administrator through the local bootstrap command.',
            jsonb_build_object('id', promoted.id, 'role', promoted.role)
          FROM promoted
          RETURNING event_id
        )
        SELECT promoted.id, promoted.email, promoted.role
        FROM promoted
        CROSS JOIN logged
      `,
      [email]
    ),
  ]);

  const promoted = rowsOf(results[1])[0];
  if (promoted) {
    console.log(`Promoted ${String(promoted.email)} as the first administrator.`);
    return;
  }

  const diagnostics = rowsOf(
    await sql.query(
      `
        SELECT
          users.id,
          users.email,
          users.role,
          users."emailVerified" AS email_verified,
          users.banned,
          users."banExpires" AS ban_expires,
          EXISTS (
            SELECT 1 FROM public.auth_user WHERE role = 'admin'
          ) AS admin_exists
        FROM public.auth_user AS users
        WHERE lower(users.email) = lower($1)
        LIMIT 1
      `,
      [email]
    )
  )[0];

  if (!diagnostics) throw new Error("No registered account uses that email address.");
  if (diagnostics.role === "admin") {
    throw new Error("That account is already an administrator.");
  }
  if (diagnostics.admin_exists === true) {
    throw new Error(
      "An administrator already exists. Promote additional users from /admin/users."
    );
  }
  if (diagnostics.email_verified !== true) {
    throw new Error("Verify this account's email before promoting it.");
  }
  const banExpires = diagnostics.ban_expires
    ? new Date(String(diagnostics.ban_expires)).getTime()
    : Number.POSITIVE_INFINITY;
  if (diagnostics.banned === true && banExpires > Date.now()) {
    throw new Error("A restricted account cannot become an administrator.");
  }
  throw new Error("The account could not be promoted.");
}

main().catch((error) => {
  console.error(`Administrator promotion failed: ${safeErrorMessage(error)}`);
  process.exitCode = 1;
});
