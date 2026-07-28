import "server-only";

import { db } from "./db";

export interface RetentionResult {
  sessions: number;
  verifications: number;
  rateLimits: number;
  unfinishedWatches: number;
}

interface RetentionRow {
  sessions: unknown;
  verifications: unknown;
  rate_limits: unknown;
  unfinished_watches: unknown;
}

function count(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error("The retention job returned an invalid deletion count.");
  }
  return parsed;
}

/** Delete short-lived operational records; immutable evidence is untouched. */
export async function runRetention(): Promise<RetentionResult> {
  const rows = await db()`
    WITH deleted_sessions AS (
      DELETE FROM public.auth_session
      WHERE "expiresAt" < clock_timestamp()
      RETURNING id
    ), deleted_verifications AS (
      DELETE FROM public.auth_verification
      WHERE "expiresAt" < clock_timestamp()
      RETURNING id
    ), deleted_rate_limits AS (
      DELETE FROM public.auth_rate_limit
      WHERE last_request < floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint
        - 86400000
      RETURNING id
    ), deleted_watches AS (
      DELETE FROM bhashan.statement_watch_sessions AS session
      WHERE session.qualified_at IS NULL
        AND session.expires_at < clock_timestamp() - interval '7 days'
        AND NOT EXISTS (
          SELECT 1
          FROM bhashan.statement_watch_receipts AS receipt
          WHERE receipt.watch_session_id = session.id
        )
      RETURNING id
    ), totals AS (
      SELECT
        (SELECT count(*) FROM deleted_sessions)::bigint AS sessions,
        (SELECT count(*) FROM deleted_verifications)::bigint AS verifications,
        (SELECT count(*) FROM deleted_rate_limits)::bigint AS rate_limits,
        (SELECT count(*) FROM deleted_watches)::bigint AS unfinished_watches
    ), logged AS (
      INSERT INTO bhashan.audit_events (
        table_schema, table_name, operation, actor, action, detail, after_row
      )
      SELECT
        'public',
        'operational_retention',
        'DELETE',
        'System retention job',
        'retention-cleanup',
        'Deleted expired operational authentication and unfinished playback records.',
        jsonb_build_object(
          'sessions', sessions,
          'verifications', verifications,
          'rateLimits', rate_limits,
          'unfinishedWatches', unfinished_watches
        )
      FROM totals
      WHERE sessions + verifications + rate_limits + unfinished_watches > 0
      RETURNING event_id
    )
    SELECT * FROM totals
  `;
  const row = (rows as unknown as RetentionRow[])[0];
  if (!row) throw new Error("The retention job returned no result.");
  return {
    sessions: count(row.sessions),
    verifications: count(row.verifications),
    rateLimits: count(row.rate_limits),
    unfinishedWatches: count(row.unfinished_watches),
  };
}
