ALTER TABLE public.auth_user
  ADD COLUMN IF NOT EXISTS "anonymizedAt" timestamptz;

-- statement-breakpoint
ALTER TABLE public.auth_user
  ADD COLUMN IF NOT EXISTS "termsAccepted" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "termsAcceptedAt" timestamptz;

-- statement-breakpoint
ALTER TABLE public.auth_user
  ADD CONSTRAINT auth_user_terms_acceptance_check
  CHECK (
    ("termsAccepted" = true AND "termsAcceptedAt" IS NOT NULL)
    OR ("termsAccepted" = false AND "termsAcceptedAt" IS NULL)
  );

-- statement-breakpoint
CREATE INDEX IF NOT EXISTS auth_user_anonymized_at_idx
  ON public.auth_user ("anonymizedAt")
  WHERE "anonymizedAt" IS NOT NULL;

-- statement-breakpoint
ALTER TABLE bhashan.statements
  ADD COLUMN IF NOT EXISTS rating_seed_gp integer
  CHECK (rating_seed_gp BETWEEN 1000 AND 2000);

-- statement-breakpoint
CREATE OR REPLACE FUNCTION bhashan.candidate_statement_seed_gp(
  candidate_id text,
  candidate_document jsonb
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SET search_path = pg_catalog, bhashan
AS $candidate_statement_seed_gp$
DECLARE
  target_rank integer;
  ladder_size integer;
  band_index integer;
  band_count integer;
  band_start integer := 1;
  remaining integer;
  band_share numeric[] := ARRAY[0.025, 0.08, 0.16, 0.21, 0.24, 1];
  band_low integer[] := ARRAY[1875, 1750, 1600, 1450, 1300, 1150];
  band_high integer[] := ARRAY[1960, 1868, 1742, 1590, 1440, 1290];
BEGIN
  WITH candidate_rows AS (
    SELECT
      statement.id,
      CASE
        WHEN statement.id = candidate_id THEN candidate_document
        ELSE statement.document
      END AS document
    FROM bhashan.statements AS statement
    UNION ALL
    SELECT candidate_id, candidate_document
    WHERE NOT EXISTS (
      SELECT 1 FROM bhashan.statements AS statement WHERE statement.id = candidate_id
    )
  ), ordered AS (
    SELECT
      id,
      row_number() OVER (
        ORDER BY
          (
            coalesce((document #>> '{axes,logic_damage}')::numeric, 0) * 0.30
            + coalesce((document #>> '{axes,straight_face}')::numeric, 0) * 0.20
            + coalesce((document #>> '{axes,rewatch_value}')::numeric, 0) * 0.20
            + coalesce((document #>> '{axes,crowd_complicity}')::numeric, 0) * 0.15
            + coalesce((document #>> '{axes,consequence}')::numeric, 0) * 0.15
          ) DESC,
          id ASC
      )::integer AS ranking,
      count(*) OVER ()::integer AS total
    FROM candidate_rows
    WHERE document ->> 'status' = 'published'
  )
  SELECT ranking, total
  INTO target_rank, ladder_size
  FROM ordered
  WHERE id = candidate_id;

  IF target_rank IS NULL OR ladder_size IS NULL OR ladder_size < 1 THEN
    RETURN 1500;
  END IF;

  remaining := ladder_size;
  FOR band_index IN 1..6 LOOP
    band_count := CASE
      WHEN band_index = 6 THEN remaining
      ELSE least(
        greatest(round(ladder_size * band_share[band_index])::integer, 0),
        remaining
      )
    END;

    IF band_count > 0
      AND target_rank >= band_start
      AND target_rank < band_start + band_count
    THEN
      IF band_count = 1 THEN
        RETURN band_high[band_index];
      END IF;
      RETURN round(
        band_high[band_index]
        - (band_high[band_index] - band_low[band_index])::numeric
          * (target_rank - band_start)
          / (band_count - 1)
      )::integer;
    END IF;

    band_start := band_start + band_count;
    remaining := remaining - band_count;
    EXIT WHEN remaining <= 0;
  END LOOP;

  RETURN 1500;
END;
$candidate_statement_seed_gp$;

-- statement-breakpoint
REVOKE ALL ON FUNCTION bhashan.candidate_statement_seed_gp(text, jsonb) FROM PUBLIC;

-- statement-breakpoint
CREATE OR REPLACE FUNCTION bhashan.prepare_statement_rating_seed()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SET search_path = pg_catalog, bhashan
AS $prepare_statement_rating_seed$
BEGIN
  -- Seed creation and every ladder-changing write are globally serialized.
  -- Once a ballot exists the seed is immutable and remains the aggregate prior.
  PERFORM pg_advisory_xact_lock(hashtextextended('bhashan:seed-ladder', 0));

  IF TG_OP = 'UPDATE' AND EXISTS (
    SELECT 1 FROM bhashan.statement_votes AS vote WHERE vote.statement_id = OLD.id
  ) THEN
    NEW.rating_seed_gp := OLD.rating_seed_gp;
  ELSIF
    NEW.document ->> 'status' = 'published'
    AND NEW.document #>> '{verification,stage}' IN ('verified', 'committee_passed')
  THEN
    NEW.rating_seed_gp := bhashan.candidate_statement_seed_gp(NEW.id, NEW.document);
  ELSE
    NEW.rating_seed_gp := NULL;
  END IF;

  RETURN NEW;
END;
$prepare_statement_rating_seed$;

-- statement-breakpoint
REVOKE ALL ON FUNCTION bhashan.prepare_statement_rating_seed() FROM PUBLIC;

-- statement-breakpoint
DROP TRIGGER IF EXISTS prepare_statement_rating_seed ON bhashan.statements;

-- statement-breakpoint
CREATE TRIGGER prepare_statement_rating_seed
BEFORE INSERT OR UPDATE OF document ON bhashan.statements
FOR EACH ROW EXECUTE FUNCTION bhashan.prepare_statement_rating_seed();

-- statement-breakpoint
ALTER TABLE bhashan.statement_watch_sessions
  ADD CONSTRAINT statement_watch_sessions_identity_uniq
  UNIQUE (id, user_id, statement_id, video_fingerprint);

-- statement-breakpoint
ALTER TABLE bhashan.statement_watch_receipts
  ADD CONSTRAINT statement_watch_receipts_identity_uniq
  UNIQUE (id, user_id, statement_id);

-- statement-breakpoint
ALTER TABLE bhashan.statement_watch_receipts
  ADD CONSTRAINT statement_watch_receipts_session_identity_fkey
  FOREIGN KEY (watch_session_id, user_id, statement_id, video_fingerprint)
  REFERENCES bhashan.statement_watch_sessions (
    id, user_id, statement_id, video_fingerprint
  )
  ON DELETE RESTRICT;

-- statement-breakpoint
ALTER TABLE bhashan.statement_votes
  ADD CONSTRAINT statement_votes_receipt_identity_fkey
  FOREIGN KEY (watch_receipt_id, user_id, statement_id)
  REFERENCES bhashan.statement_watch_receipts (id, user_id, statement_id)
  ON DELETE RESTRICT;

-- statement-breakpoint
CREATE OR REPLACE FUNCTION bhashan.validate_watch_receipt_insert()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SET search_path = pg_catalog, bhashan
AS $validate_watch_receipt_insert$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM bhashan.statement_watch_sessions AS session
    WHERE session.id = NEW.watch_session_id
      AND session.user_id = NEW.user_id
      AND session.statement_id = NEW.statement_id
      AND session.video_fingerprint = NEW.video_fingerprint
      AND session.qualified_at IS NOT NULL
      AND session.reached_end = true
      AND session.credited_watch_ms >= session.required_watch_ms
      AND NEW.watched_ms = session.credited_watch_ms
      AND NEW.required_watch_ms = session.required_watch_ms
      AND NEW.qualified_at = session.qualified_at
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'watch receipt does not match a qualified watch session';
  END IF;
  RETURN NEW;
END;
$validate_watch_receipt_insert$;

-- statement-breakpoint
REVOKE ALL ON FUNCTION bhashan.validate_watch_receipt_insert() FROM PUBLIC;

-- statement-breakpoint
DROP TRIGGER IF EXISTS validate_watch_receipt_insert
  ON bhashan.statement_watch_receipts;

-- statement-breakpoint
CREATE TRIGGER validate_watch_receipt_insert
BEFORE INSERT ON bhashan.statement_watch_receipts
FOR EACH ROW EXECUTE FUNCTION bhashan.validate_watch_receipt_insert();

-- statement-breakpoint
CREATE OR REPLACE FUNCTION bhashan.statement_video_fingerprint(statement_document jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
STRICT
SET search_path = pg_catalog
AS $statement_video_fingerprint$
DECLARE
  candidate jsonb;
  candidate_id text;
  candidate_platform text;
  start_text text;
  end_text text;
  start_seconds bigint;
  end_seconds bigint;
BEGIN
  FOREACH candidate IN ARRAY ARRAY[
    statement_document -> 'video',
    statement_document #> '{verification,embed}'
  ] LOOP
    IF candidate IS NULL OR jsonb_typeof(candidate) <> 'object' THEN
      CONTINUE;
    END IF;
    candidate_id := btrim(coalesce(candidate ->> 'id', ''));
    candidate_platform := coalesce(candidate ->> 'platform', 'youtube');
    start_text := coalesce(candidate ->> 'start', candidate ->> 'start_s');
    end_text := coalesce(candidate ->> 'end', candidate ->> 'end_s');
    IF candidate_platform <> 'youtube'
      OR candidate_id !~ '^[A-Za-z0-9_-]{6,20}$'
      OR start_text IS NULL
      OR end_text IS NULL
      OR start_text !~ '^\d+$'
      OR end_text !~ '^\d+$'
    THEN
      CONTINUE;
    END IF;
    BEGIN
      start_seconds := start_text::bigint;
      end_seconds := end_text::bigint;
    EXCEPTION WHEN numeric_value_out_of_range THEN
      CONTINUE;
    END;
    IF start_seconds < 0
      OR end_seconds <= start_seconds
      OR end_seconds - start_seconds < 3
      OR end_seconds - start_seconds > 180
      OR end_seconds > 86400
    THEN
      CONTINUE;
    END IF;
    RETURN md5(concat_ws(
      '|', 'v1', 'youtube', candidate_id, start_seconds::text, end_seconds::text
    ));
  END LOOP;
  RETURN NULL;
END;
$statement_video_fingerprint$;

-- statement-breakpoint
REVOKE ALL ON FUNCTION bhashan.statement_video_fingerprint(jsonb) FROM PUBLIC;

-- statement-breakpoint
CREATE OR REPLACE FUNCTION bhashan.serialize_statement_vote_insert()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SET search_path = pg_catalog, bhashan
AS $serialize_statement_vote_insert$
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended('bhashan:user-lifecycle:' || NEW.user_id, 0)
  );
  PERFORM pg_advisory_xact_lock(
    hashtextextended('bhashan:statement-rating:' || NEW.statement_id, 0)
  );

  IF NOT EXISTS (
    SELECT 1
    FROM bhashan.statement_watch_receipts AS receipt
    JOIN bhashan.statements AS statement ON statement.id = receipt.statement_id
    WHERE receipt.id = NEW.watch_receipt_id
      AND receipt.user_id = NEW.user_id
      AND receipt.statement_id = NEW.statement_id
      AND statement.status = 'published'
      AND statement.document #>> '{verification,stage}' IN ('verified', 'committee_passed')
      AND statement.rating_seed_gp IS NOT NULL
      AND receipt.video_fingerprint = bhashan.statement_video_fingerprint(statement.document)
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'vote does not match current eligible evidence';
  END IF;
  RETURN NEW;
END;
$serialize_statement_vote_insert$;

-- statement-breakpoint
ALTER TABLE bhashan.statement_rating_aggregates
  ADD CONSTRAINT statement_rating_aggregate_weighted_sum_check
  CHECK (
    valid_vote_sum =
      vote_25_count * 25
      + vote_50_count * 50
      + vote_75_count * 75
      + vote_100_count * 100
  );
