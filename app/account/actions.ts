"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import {
  PUBLIC_EMPTY_PERFORMANCE,
  RATING_MODEL_VERSION,
  RATING_PRIOR_STRENGTH,
} from "@/lib/rating";

function confirmation(formData: FormData): string {
  return String(formData.get("confirmation") ?? "").trim();
}

function tombstoneEmail(userId: string): string {
  const suffix = createHash("sha256").update(userId).digest("hex").slice(0, 32);
  return `deleted-${suffix}@privacy.invalid`;
}

/**
 * Irreversibly remove account credentials and personal profile data while
 * retaining opaque, immutable ballot history. Previously counted ballots are
 * append-only excluded and every affected aggregate is rebuilt atomically.
 */
export async function anonymizeMyAccount(formData: FormData): Promise<void> {
  if (confirmation(formData) !== "DELETE") {
    throw new Error("Type DELETE exactly to anonymize this account.");
  }

  const user = await requireUser();
  const sql = db();
  const rows = await sql.transaction((tx) => [
    tx`SELECT pg_advisory_xact_lock(
      hashtextextended(${`bhashan:user-lifecycle:${user.id}`}, 0)
    )`,
    tx`SELECT pg_advisory_xact_lock(
      hashtextextended('bhashan:registered-admins', 0)
    )`,
    tx`
      WITH targets AS MATERIALIZED (
        SELECT DISTINCT vote.statement_id
        FROM bhashan.statement_votes AS vote
        LEFT JOIN bhashan.statement_vote_exclusions AS exclusion
          ON exclusion.vote_id = vote.id
        WHERE vote.user_id = ${user.id}
          AND exclusion.vote_id IS NULL
        ORDER BY vote.statement_id
      )
      SELECT pg_advisory_xact_lock(
        hashtextextended('bhashan:statement-rating:' || statement_id, 0)
      )
      FROM targets
    `,
    tx`
      WITH target AS MATERIALIZED (
        SELECT account.*
        FROM public.auth_user AS account
        WHERE account.id = ${user.id}
          AND account."anonymizedAt" IS NULL
          AND (
            account.role <> 'admin'
            OR EXISTS (
              SELECT 1
              FROM public.auth_user AS other
              WHERE other.id <> account.id
                AND other.role = 'admin'
                AND other."anonymizedAt" IS NULL
                AND (
                  other.banned = false
                  OR (
                    other."banExpires" IS NOT NULL
                    AND other."banExpires" <= clock_timestamp()
                  )
                )
            )
          )
        FOR UPDATE
      ), target_votes AS MATERIALIZED (
        SELECT vote.*
        FROM bhashan.statement_votes AS vote
        JOIN target ON target.id = vote.user_id
        LEFT JOIN bhashan.statement_vote_exclusions AS exclusion
          ON exclusion.vote_id = vote.id
        WHERE exclusion.vote_id IS NULL
      ), inserted_exclusions AS (
        INSERT INTO bhashan.statement_vote_exclusions (
          vote_id, actor_user_id, reason
        )
        SELECT
          vote.id,
          target.id,
          'Account anonymized at the member''s request.'
        FROM target_votes AS vote
        CROSS JOIN target
        ON CONFLICT DO NOTHING
        RETURNING vote_id
      ), affected_statements AS MATERIALIZED (
        SELECT DISTINCT vote.statement_id
        FROM target_votes AS vote
        JOIN inserted_exclusions AS exclusion ON exclusion.vote_id = vote.id
      ), totals AS MATERIALIZED (
        SELECT
          affected.statement_id,
          count(vote.id) FILTER (
            WHERE existing_exclusion.vote_id IS NULL
              AND new_exclusion.vote_id IS NULL
          )::bigint AS valid_vote_count,
          coalesce(sum(vote.value) FILTER (
            WHERE existing_exclusion.vote_id IS NULL
              AND new_exclusion.vote_id IS NULL
          ), 0)::bigint AS valid_vote_sum,
          count(vote.id) FILTER (
            WHERE vote.value = 0
              AND existing_exclusion.vote_id IS NULL
              AND new_exclusion.vote_id IS NULL
          )::bigint AS vote_0_count,
          count(vote.id) FILTER (
            WHERE vote.value = 25
              AND existing_exclusion.vote_id IS NULL
              AND new_exclusion.vote_id IS NULL
          )::bigint AS vote_25_count,
          count(vote.id) FILTER (
            WHERE vote.value = 50
              AND existing_exclusion.vote_id IS NULL
              AND new_exclusion.vote_id IS NULL
          )::bigint AS vote_50_count,
          count(vote.id) FILTER (
            WHERE vote.value = 75
              AND existing_exclusion.vote_id IS NULL
              AND new_exclusion.vote_id IS NULL
          )::bigint AS vote_75_count,
          count(vote.id) FILTER (
            WHERE vote.value = 100
              AND existing_exclusion.vote_id IS NULL
              AND new_exclusion.vote_id IS NULL
          )::bigint AS vote_100_count
        FROM affected_statements AS affected
        LEFT JOIN bhashan.statement_votes AS vote
          ON vote.statement_id = affected.statement_id
        LEFT JOIN bhashan.statement_vote_exclusions AS existing_exclusion
          ON existing_exclusion.vote_id = vote.id
        LEFT JOIN inserted_exclusions AS new_exclusion
          ON new_exclusion.vote_id = vote.id
        GROUP BY affected.statement_id
      ), updated_aggregates AS (
        UPDATE bhashan.statement_rating_aggregates AS aggregate
        SET
          valid_vote_count = totals.valid_vote_count,
          valid_vote_sum = totals.valid_vote_sum,
          vote_0_count = totals.vote_0_count,
          vote_25_count = totals.vote_25_count,
          vote_50_count = totals.vote_50_count,
          vote_75_count = totals.vote_75_count,
          vote_100_count = totals.vote_100_count,
          prior_performance = ${PUBLIC_EMPTY_PERFORMANCE},
          prior_strength = ${RATING_PRIOR_STRENGTH},
          performance = CASE
            WHEN totals.valid_vote_count = 0 THEN ${PUBLIC_EMPTY_PERFORMANCE}
            ELSE totals.valid_vote_sum::numeric / totals.valid_vote_count
          END,
          gp = CASE
            WHEN totals.valid_vote_count = 0
              THEN ${1000 + PUBLIC_EMPTY_PERFORMANCE * 10}
            ELSE round(
              1000 + 10 * totals.valid_vote_sum::numeric / totals.valid_vote_count
            )::integer
          END,
          model_version = ${RATING_MODEL_VERSION},
          updated_at = clock_timestamp()
        FROM totals
        WHERE aggregate.statement_id = totals.statement_id
        RETURNING aggregate.statement_id
      ), deleted_sessions AS (
        DELETE FROM public.auth_session AS session
        USING target
        WHERE session."userId" = target.id
        RETURNING session.id
      ), deleted_accounts AS (
        DELETE FROM public.auth_account AS credential
        USING target
        WHERE credential."userId" = target.id
        RETURNING credential.id
      ), deleted_verifications AS (
        DELETE FROM public.auth_verification AS verification
        USING target
        WHERE strpos(verification.identifier, target.id) > 0
          OR strpos(verification.identifier, target.email) > 0
        RETURNING verification.id
      ), anonymized AS (
        UPDATE public.auth_user AS account
        SET
          name = 'Former Committee member',
          email = ${tombstoneEmail(user.id)},
          "emailVerified" = false,
          image = NULL,
          role = 'user',
          banned = false,
          "banReason" = NULL,
          "banExpires" = NULL,
          "newsletterOptIn" = false,
          "newsletterOptInAt" = NULL,
          "anonymizedAt" = clock_timestamp(),
          "updatedAt" = clock_timestamp()
        FROM target
        WHERE account.id = target.id
        RETURNING account.id, account."anonymizedAt"
      ), logged AS (
        INSERT INTO bhashan.audit_events (
          table_schema, table_name, target_id, operation,
          actor, action, detail, after_row
        )
        SELECT
          'public',
          'auth_user',
          anonymized.id,
          'UPDATE',
          'Former Committee member ' || anonymized.id,
          'account-anonymize',
          'Anonymized an account at the member''s request and excluded its counted ballots.',
          jsonb_build_object(
            'id', anonymized.id,
            'anonymizedAt', anonymized."anonymizedAt",
            'excludedBallots', (SELECT count(*) FROM inserted_exclusions),
            'affectedRatings', (SELECT count(*) FROM updated_aggregates)
          )
        FROM anonymized
        RETURNING event_id
      )
      SELECT anonymized.id
      FROM anonymized
      CROSS JOIN logged
    `,
  ]);

  if (!Array.isArray(rows[3]) || rows[3].length !== 1) {
    throw new Error(
      "This account could not be anonymized. The final active administrator must promote another administrator first."
    );
  }

  revalidatePath("/", "layout");
  redirect("/?account=anonymized");
}
