-- Freeze every table that participates in publication or rating eligibility.
-- The canonical rebuild and the new guards therefore become visible together.
LOCK TABLE
  bhashan.statements,
  bhashan.statement_votes,
  bhashan.statement_vote_exclusions,
  bhashan.statement_rating_aggregates,
  bhashan.cloudinary_video_upload_intents
IN SHARE ROW EXCLUSIVE MODE;

-- statement-breakpoint
CREATE OR REPLACE FUNCTION bhashan.valid_http_source_url(
  candidate text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = pg_catalog
AS $valid_http_source_url$
  SELECT
    char_length(candidate) BETWEEN 8 AND 2048
    AND candidate = btrim(candidate)
    AND candidate !~ '[[:space:]]'
    AND candidate ~* (
      '^https?://'
      || '([[:alnum:]]|[[:alnum:]][[:alnum:].-]*[[:alnum:]])'
      || '(:[0-9]{1,5})?([/?#].*)?$'
    );
$valid_http_source_url$;

-- statement-breakpoint
REVOKE ALL ON FUNCTION bhashan.valid_http_source_url(text) FROM PUBLIC;

-- statement-breakpoint
CREATE OR REPLACE FUNCTION bhashan.statement_cloudinary_attachment_ready(
  statement_id_value text,
  statement_document jsonb,
  allow_unattached boolean
)
RETURNS boolean
LANGUAGE sql
STABLE
STRICT
SET search_path = pg_catalog, bhashan
AS $statement_cloudinary_attachment_ready$
  SELECT CASE
    WHEN statement_document #>> '{video,platform}' IS DISTINCT FROM 'cloudinary'
      THEN true
    ELSE EXISTS (
      SELECT 1
      FROM bhashan.cloudinary_video_upload_intents AS upload
      WHERE upload.status = 'completed'
        AND upload.playback_attested_at IS NOT NULL
        AND upload.public_id = statement_document #>> '{video,id}'
        AND upload.asset_id = statement_document #>> '{video,assetId}'
        AND upload.version::text = statement_document #>> '{video,version}'
        AND upload.actual_bytes::text = statement_document #>> '{video,bytes}'
        AND upload.derived_bytes::text =
          statement_document #>> '{video,derivedBytes}'
        AND upload.duration_ms::text =
          statement_document #>> '{video,durationMs}'
        AND upload.format = statement_document #>> '{video,format}'
        AND statement_document #>> '{video,start}' = '0'
        AND ((upload.duration_ms + 999) / 1000)::text =
          statement_document #>> '{video,end}'
        AND (
          upload.attached_statement_id = statement_id_value
          OR (
            allow_unattached
            AND upload.attached_statement_id IS NULL
          )
        )
    )
  END;
$statement_cloudinary_attachment_ready$;

-- statement-breakpoint
REVOKE ALL ON FUNCTION
  bhashan.statement_cloudinary_attachment_ready(text, jsonb, boolean)
FROM PUBLIC;

-- statement-breakpoint
ALTER TABLE bhashan.statements
  DROP CONSTRAINT IF EXISTS statements_status_check;

-- statement-breakpoint
ALTER TABLE bhashan.statements
  ADD CONSTRAINT statements_status_check
  CHECK (
    status IN (
      'published',
      'held_parity',
      'held_review',
      'private_draft',
      'withdrawn'
    )
  );

-- statement-breakpoint
CREATE OR REPLACE FUNCTION bhashan.statement_publication_issues(
  statement_document jsonb
)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
STRICT
SET search_path = pg_catalog, bhashan
AS $statement_publication_issues$
DECLARE
  issues text[] := ARRAY[]::text[];
  verification jsonb := statement_document -> 'verification';
  sources jsonb;
  needs jsonb;
  best_source_tier text;
BEGIN
  IF statement_document ->> 'status' IS DISTINCT FROM 'published' THEN
    issues := array_append(issues, 'The statement must be published.');
  END IF;

  IF coalesce(verification ->> 'stage', '') NOT IN ('verified', 'committee_passed') THEN
    issues := array_append(issues, 'The statement must be committee-passed.');
  END IF;

  IF btrim(coalesce(statement_document ->> 'date', '')) = '' THEN
    issues := array_append(issues, 'A confirmed statement date is required.');
  END IF;

  IF btrim(coalesce(statement_document ->> 'venue', '')) = '' THEN
    issues := array_append(issues, 'A confirmed statement venue is required.');
  END IF;

  IF btrim(coalesce(statement_document ->> 'quote', '')) = '' THEN
    issues := array_append(
      issues,
      'An original-language verbatim quote is required.'
    );
  END IF;

  IF btrim(coalesce(statement_document ->> 'language', '')) = '' THEN
    issues := array_append(issues, 'The original language is required.');
  ELSIF lower(btrim(statement_document ->> 'language')) <> 'english'
    AND btrim(coalesce(statement_document ->> 'quote_translation', '')) = ''
  THEN
    issues := array_append(
      issues,
      'A faithful English translation is required for a non-English quote.'
    );
  END IF;

  IF btrim(coalesce(statement_document ->> 'context', '')) = '' THEN
    issues := array_append(issues, 'Surrounding context is required.');
  END IF;

  best_source_tier := verification ->> 'best_source_tier';
  IF best_source_tier NOT IN ('A', 'B') THEN
    issues := array_append(issues, 'The best source tier must be A or B.');
  END IF;

  sources := verification -> 'sources';
  IF jsonb_typeof(sources) IS DISTINCT FROM 'array' THEN
    issues := array_append(
      issues,
      'A matching Tier A/B HTTP(S) source is required.'
    );
  ELSIF NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(sources) AS source(document)
      WHERE source.document ->> 'tier' = best_source_tier
        AND source.document ->> 'tier' IN ('A', 'B')
        AND bhashan.valid_http_source_url(source.document ->> 'url')
    ) THEN
    issues := array_append(
      issues,
      'A matching Tier A/B HTTP(S) source is required.'
    );
  END IF;

  needs := verification -> 'needs';
  IF needs IS NOT NULL THEN
    IF jsonb_typeof(needs) IS DISTINCT FROM 'array' THEN
      issues := array_append(
        issues,
        'Resolve every outstanding verification need before publication.'
      );
    ELSIF jsonb_array_length(needs) > 0 THEN
      issues := array_append(
        issues,
        'Resolve every outstanding verification need before publication.'
      );
    END IF;
  END IF;

  IF bhashan.statement_video_fingerprint(statement_document) IS NULL THEN
    issues := array_append(
      issues,
      'A valid bounded source-video excerpt is required.'
    );
  END IF;

  RETURN issues;
END;
$statement_publication_issues$;

-- statement-breakpoint
REVOKE ALL ON FUNCTION bhashan.statement_publication_issues(jsonb) FROM PUBLIC;

-- statement-breakpoint
SELECT set_config(
  'bhashan.actor',
  'migration:0010_publication_and_rating_v2',
  true
);

-- statement-breakpoint
-- Keep repository-managed rows repository-managed while recording every
-- statement mutation in the existing append-only audit ledger.
SELECT set_config('bhashan.action', 'seed', true);

-- statement-breakpoint
SELECT set_config(
  'bhashan.detail',
  'Demoted records that do not meet the video-publication bar.',
  true
);

-- statement-breakpoint
UPDATE bhashan.statements AS statement
SET
  document = jsonb_set(
    jsonb_set(
      statement.document,
      '{status}',
      to_jsonb('held_review'::text),
      true
    ),
    '{hall_of_fame}',
    'false'::jsonb,
    true
  ),
  version = statement.version + 1,
  updated_at = clock_timestamp()
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
  );

-- statement-breakpoint
-- Derive every aggregate from immutable ballots. This repairs a missing or
-- stale cache row before it is marked as model v2.
DELETE FROM bhashan.statement_rating_aggregates AS aggregate
WHERE NOT EXISTS (
  SELECT 1
  FROM bhashan.statement_votes AS vote
  WHERE vote.statement_id = aggregate.statement_id
);

-- statement-breakpoint
WITH target_statements AS MATERIALIZED (
  SELECT DISTINCT vote.statement_id
  FROM bhashan.statement_votes AS vote
), totals AS MATERIALIZED (
  SELECT
    target.statement_id,
    count(vote.id) FILTER (
      WHERE exclusion.vote_id IS NULL
    )::bigint AS valid_vote_count,
    coalesce(sum(vote.value) FILTER (
      WHERE exclusion.vote_id IS NULL
    ), 0)::bigint AS valid_vote_sum,
    count(vote.id) FILTER (
      WHERE exclusion.vote_id IS NULL AND vote.value = 0
    )::bigint AS vote_0_count,
    count(vote.id) FILTER (
      WHERE exclusion.vote_id IS NULL AND vote.value = 25
    )::bigint AS vote_25_count,
    count(vote.id) FILTER (
      WHERE exclusion.vote_id IS NULL AND vote.value = 50
    )::bigint AS vote_50_count,
    count(vote.id) FILTER (
      WHERE exclusion.vote_id IS NULL AND vote.value = 75
    )::bigint AS vote_75_count,
    count(vote.id) FILTER (
      WHERE exclusion.vote_id IS NULL AND vote.value = 100
    )::bigint AS vote_100_count
  FROM target_statements AS target
  LEFT JOIN bhashan.statement_votes AS vote
    ON vote.statement_id = target.statement_id
  LEFT JOIN bhashan.statement_vote_exclusions AS exclusion
    ON exclusion.vote_id = vote.id
  GROUP BY target.statement_id
)
INSERT INTO bhashan.statement_rating_aggregates AS aggregate (
  statement_id,
  prior_performance,
  prior_strength,
  valid_vote_count,
  valid_vote_sum,
  vote_0_count,
  vote_25_count,
  vote_50_count,
  vote_75_count,
  vote_100_count,
  performance,
  gp,
  model_version,
  updated_at
)
SELECT
  totals.statement_id,
  50,
  0,
  totals.valid_vote_count,
  totals.valid_vote_sum,
  totals.vote_0_count,
  totals.vote_25_count,
  totals.vote_50_count,
  totals.vote_75_count,
  totals.vote_100_count,
  CASE
    WHEN totals.valid_vote_count = 0 THEN 50
    ELSE totals.valid_vote_sum::numeric / totals.valid_vote_count
  END,
  CASE
    WHEN totals.valid_vote_count = 0 THEN 1500
    ELSE round(
      1000 + 10 * totals.valid_vote_sum::numeric / totals.valid_vote_count
    )::integer
  END,
  2,
  clock_timestamp()
FROM totals
ON CONFLICT (statement_id) DO UPDATE SET
  prior_performance = EXCLUDED.prior_performance,
  prior_strength = EXCLUDED.prior_strength,
  valid_vote_count = EXCLUDED.valid_vote_count,
  valid_vote_sum = EXCLUDED.valid_vote_sum,
  vote_0_count = EXCLUDED.vote_0_count,
  vote_25_count = EXCLUDED.vote_25_count,
  vote_50_count = EXCLUDED.vote_50_count,
  vote_75_count = EXCLUDED.vote_75_count,
  vote_100_count = EXCLUDED.vote_100_count,
  performance = EXCLUDED.performance,
  gp = EXCLUDED.gp,
  model_version = EXCLUDED.model_version,
  updated_at = EXCLUDED.updated_at;

-- statement-breakpoint
SELECT set_config(
  'bhashan.detail',
  'Removed Hall of Fame status from entries below the live maturity bar.',
  true
);

-- statement-breakpoint
UPDATE bhashan.statements AS statement
SET
  document = jsonb_set(
    statement.document,
    '{hall_of_fame}',
    'false'::jsonb,
    true
  ),
  version = statement.version + 1,
  updated_at = clock_timestamp()
WHERE coalesce((statement.document ->> 'hall_of_fame')::boolean, false)
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
    OR coalesce(
      (
        SELECT aggregate.valid_vote_count
        FROM bhashan.statement_rating_aggregates AS aggregate
        WHERE aggregate.statement_id = statement.id
      ),
      0
    ) < 10
  );

-- statement-breakpoint
SELECT set_config(
  'bhashan.detail',
  'Neutralized legacy editorial rating seeds for equal-weight public rulings.',
  true
);

-- statement-breakpoint
UPDATE bhashan.statements AS statement
SET
  rating_seed_gp = CASE
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
  END,
  version = statement.version + 1,
  updated_at = clock_timestamp()
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
END;

-- statement-breakpoint
CREATE OR REPLACE FUNCTION bhashan.prepare_statement_rating_seed()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SET search_path = pg_catalog, bhashan
AS $prepare_statement_rating_seed$
BEGIN
  -- A Hall-only write does not change publication eligibility. Skipping the
  -- global ladder lock keeps aggregate-driven Hall removal in the same lock
  -- order as every vote and exclusion.
  IF TG_OP = 'UPDATE'
    AND (NEW.document - 'hall_of_fame')
      IS NOT DISTINCT FROM
      (OLD.document - 'hall_of_fame')
  THEN
    NEW.rating_seed_gp := OLD.rating_seed_gp;
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('bhashan:seed-ladder', 0)
  );

  IF TG_OP = 'UPDATE' AND EXISTS (
    SELECT 1
    FROM bhashan.statement_votes AS vote
    WHERE vote.statement_id = OLD.id
  ) THEN
    NEW.rating_seed_gp := 1500;
  ELSIF cardinality(
      bhashan.statement_publication_issues(NEW.document)
    ) = 0
    AND bhashan.statement_cloudinary_attachment_ready(
      NEW.id,
      NEW.document,
      true
    )
  THEN
    NEW.rating_seed_gp := 1500;
  ELSE
    NEW.rating_seed_gp := NULL;
  END IF;

  RETURN NEW;
END;
$prepare_statement_rating_seed$;

-- statement-breakpoint
CREATE OR REPLACE FUNCTION bhashan.enforce_statement_rating_aggregate_v2()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SET search_path = pg_catalog, bhashan
AS $enforce_statement_rating_aggregate_v2$
DECLARE
  target_statement_id text := CASE
    WHEN TG_OP = 'DELETE' THEN OLD.statement_id
    ELSE NEW.statement_id
  END;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      'bhashan:statement-rating:' || target_statement_id,
      0
    )
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  NEW.prior_performance := 50;
  NEW.prior_strength := 0;
  NEW.model_version := 2;
  NEW.performance := CASE
    WHEN NEW.valid_vote_count = 0 THEN 50
    ELSE NEW.valid_vote_sum::numeric / NEW.valid_vote_count
  END;
  NEW.gp := CASE
    WHEN NEW.valid_vote_count = 0 THEN 1500
    ELSE round(
      1000 + 10 * NEW.valid_vote_sum::numeric / NEW.valid_vote_count
    )::integer
  END;
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$enforce_statement_rating_aggregate_v2$;

-- statement-breakpoint
REVOKE ALL ON FUNCTION
  bhashan.enforce_statement_rating_aggregate_v2()
FROM PUBLIC;

-- statement-breakpoint
DROP TRIGGER IF EXISTS enforce_statement_rating_aggregate_v2
  ON bhashan.statement_rating_aggregates;

-- statement-breakpoint
CREATE TRIGGER enforce_statement_rating_aggregate_v2
BEFORE INSERT OR UPDATE OR DELETE ON bhashan.statement_rating_aggregates
FOR EACH ROW EXECUTE FUNCTION
  bhashan.enforce_statement_rating_aggregate_v2();

-- statement-breakpoint
ALTER TABLE bhashan.statement_rating_aggregates
  DROP CONSTRAINT IF EXISTS statement_rating_aggregate_v2_check,
  ADD CONSTRAINT statement_rating_aggregate_v2_check
  CHECK (
    prior_performance = 50
    AND prior_strength = 0
    AND model_version = 2
    AND performance = CASE
      WHEN valid_vote_count = 0 THEN 50::numeric
      ELSE round(valid_vote_sum::numeric / valid_vote_count, 6)
    END
    AND gp = CASE
      WHEN valid_vote_count = 0 THEN 1500
      ELSE round(
        1000 + 10 * valid_vote_sum::numeric / valid_vote_count
      )::integer
    END
  );

-- statement-breakpoint
CREATE OR REPLACE FUNCTION bhashan.clear_immature_statement_hall_of_fame()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SET search_path = pg_catalog, bhashan
AS $clear_immature_statement_hall_of_fame$
DECLARE
  target_statement_id text := CASE
    WHEN TG_OP = 'DELETE' THEN OLD.statement_id
    ELSE NEW.statement_id
  END;
  target_valid_vote_count bigint := CASE
    WHEN TG_OP = 'DELETE' THEN 0
    ELSE NEW.valid_vote_count
  END;
BEGIN
  IF target_valid_vote_count >= 10 THEN
    RETURN NULL;
  END IF;

  IF nullif(current_setting('bhashan.actor', true), '') IS NULL THEN
    PERFORM set_config('bhashan.actor', 'rating-integrity-trigger', true);
  END IF;
  IF nullif(current_setting('bhashan.action', true), '') IS NULL THEN
    PERFORM set_config('bhashan.action', 'remove-immature-hall-entry', true);
  END IF;
  IF nullif(current_setting('bhashan.detail', true), '') IS NULL THEN
    PERFORM set_config(
      'bhashan.detail',
      'Removed Hall of Fame status after valid rulings fell below ten.',
      true
    );
  END IF;

  UPDATE bhashan.statements AS statement
  SET
    document = jsonb_set(
      statement.document,
      '{hall_of_fame}',
      'false'::jsonb,
      true
    ),
    version = statement.version + 1,
    updated_at = clock_timestamp()
  WHERE statement.id = target_statement_id
    AND coalesce(
      (statement.document ->> 'hall_of_fame')::boolean,
      false
    );

  RETURN NULL;
END;
$clear_immature_statement_hall_of_fame$;

-- statement-breakpoint
REVOKE ALL ON FUNCTION
  bhashan.clear_immature_statement_hall_of_fame()
FROM PUBLIC;

-- statement-breakpoint
DROP TRIGGER IF EXISTS clear_immature_statement_hall_of_fame
  ON bhashan.statement_rating_aggregates;

-- statement-breakpoint
CREATE TRIGGER clear_immature_statement_hall_of_fame
AFTER INSERT OR UPDATE OR DELETE ON bhashan.statement_rating_aggregates
FOR EACH ROW EXECUTE FUNCTION
  bhashan.clear_immature_statement_hall_of_fame();

-- statement-breakpoint
CREATE OR REPLACE FUNCTION bhashan.enforce_statement_publication_integrity()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SET search_path = pg_catalog, bhashan
AS $enforce_statement_publication_integrity$
DECLARE
  issues text[];
  valid_vote_count bigint;
  hall_requested boolean :=
    coalesce((NEW.document ->> 'hall_of_fame')::boolean, false);
  hall_was_set boolean := CASE
    WHEN TG_OP = 'INSERT' THEN false
    ELSE coalesce((OLD.document ->> 'hall_of_fame')::boolean, false)
  END;
BEGIN
  -- Serialize induction with every aggregate mutation. A falling vote count
  -- can therefore never commit beside a newly inducted immature entry.
  IF hall_requested AND NOT hall_was_set THEN
    PERFORM pg_advisory_xact_lock(
      hashtextextended(
        'bhashan:statement-rating:' || NEW.id,
        0
      )
    );
  END IF;

  IF NEW.document ->> 'status' = 'published' THEN
    issues := bhashan.statement_publication_issues(NEW.document);
    IF cardinality(issues) > 0 THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'statement is not publication-ready',
        DETAIL = array_to_string(issues, ' ');
    END IF;

    IF NOT bhashan.statement_cloudinary_attachment_ready(
      NEW.id,
      NEW.document,
      true
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'statement Cloudinary evidence is not publication-ready';
    END IF;
  END IF;

  IF hall_requested THEN
    IF NEW.document ->> 'status' <> 'published' THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'Hall of Fame requires a live statement';
    END IF;

    SELECT aggregate.valid_vote_count
    INTO valid_vote_count
    FROM bhashan.statement_rating_aggregates AS aggregate
    WHERE aggregate.statement_id = NEW.id;

    IF coalesce(valid_vote_count, 0) < 10 THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'Hall of Fame requires at least ten valid public rulings';
    END IF;
  END IF;

  RETURN NEW;
END;
$enforce_statement_publication_integrity$;

-- statement-breakpoint
REVOKE ALL ON FUNCTION bhashan.enforce_statement_publication_integrity()
  FROM PUBLIC;

-- statement-breakpoint
DROP TRIGGER IF EXISTS enforce_statement_publication_integrity
  ON bhashan.statements;

-- statement-breakpoint
CREATE TRIGGER enforce_statement_publication_integrity
BEFORE INSERT OR UPDATE OF document ON bhashan.statements
FOR EACH ROW EXECUTE FUNCTION bhashan.enforce_statement_publication_integrity();

-- statement-breakpoint
CREATE OR REPLACE FUNCTION bhashan.enforce_statement_cloudinary_attachment()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SET search_path = pg_catalog, bhashan
AS $enforce_statement_cloudinary_attachment$
DECLARE
  current_document jsonb;
BEGIN
  SELECT statement.document
  INTO current_document
  FROM bhashan.statements AS statement
  WHERE statement.id = NEW.id;

  IF current_document IS NULL THEN
    RETURN NULL;
  END IF;

  IF current_document #>> '{video,platform}' = 'cloudinary'
    AND NOT bhashan.statement_cloudinary_attachment_ready(
      NEW.id,
      current_document,
      false
    )
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'statement Cloudinary evidence is not attached';
  END IF;

  IF current_document #>> '{video,platform}' IS DISTINCT FROM 'cloudinary'
    AND EXISTS (
      SELECT 1
      FROM bhashan.cloudinary_video_upload_intents AS upload
      WHERE upload.attached_statement_id = NEW.id
    )
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'a non-Cloudinary statement retains a Cloudinary attachment';
  END IF;

  RETURN NULL;
END;
$enforce_statement_cloudinary_attachment$;

-- statement-breakpoint
REVOKE ALL ON FUNCTION
  bhashan.enforce_statement_cloudinary_attachment()
FROM PUBLIC;

-- statement-breakpoint
DROP TRIGGER IF EXISTS enforce_statement_cloudinary_attachment
  ON bhashan.statements;

-- statement-breakpoint
CREATE CONSTRAINT TRIGGER enforce_statement_cloudinary_attachment
AFTER INSERT OR UPDATE ON bhashan.statements
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION
  bhashan.enforce_statement_cloudinary_attachment();

-- statement-breakpoint
CREATE OR REPLACE FUNCTION bhashan.enforce_cloudinary_upload_statement_attachment()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SET search_path = pg_catalog, bhashan
AS $enforce_cloudinary_upload_statement_attachment$
DECLARE
  old_statement_id text := CASE
    WHEN TG_OP = 'INSERT' THEN NULL
    ELSE OLD.attached_statement_id
  END;
  new_statement_id text := CASE
    WHEN TG_OP = 'DELETE' THEN NULL
    ELSE NEW.attached_statement_id
  END;
  target_statement_id text;
  target_document jsonb;
BEGIN
  FOREACH target_statement_id IN ARRAY ARRAY[
    old_statement_id,
    new_statement_id
  ] LOOP
    IF target_statement_id IS NULL THEN
      CONTINUE;
    END IF;

    SELECT statement.document
    INTO target_document
    FROM bhashan.statements AS statement
    WHERE statement.id = target_statement_id;

    IF target_document IS NULL THEN
      CONTINUE;
    END IF;

    IF target_document #>> '{video,platform}' IS DISTINCT FROM 'cloudinary'
      OR NOT bhashan.statement_cloudinary_attachment_ready(
        target_statement_id,
        target_document,
        false
      )
    THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'Cloudinary upload attachment does not match its statement';
    END IF;
  END LOOP;

  RETURN NULL;
END;
$enforce_cloudinary_upload_statement_attachment$;

-- statement-breakpoint
REVOKE ALL ON FUNCTION
  bhashan.enforce_cloudinary_upload_statement_attachment()
FROM PUBLIC;

-- statement-breakpoint
DROP TRIGGER IF EXISTS enforce_cloudinary_upload_statement_attachment
  ON bhashan.cloudinary_video_upload_intents;

-- statement-breakpoint
CREATE CONSTRAINT TRIGGER enforce_cloudinary_upload_statement_attachment
AFTER INSERT OR UPDATE OR DELETE ON bhashan.cloudinary_video_upload_intents
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION
  bhashan.enforce_cloudinary_upload_statement_attachment();

-- statement-breakpoint
DO $validate_existing_cloudinary_attachments$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM bhashan.statements AS statement
    WHERE statement.document #>> '{video,platform}' = 'cloudinary'
      AND NOT bhashan.statement_cloudinary_attachment_ready(
        statement.id,
        statement.document,
        false
      )
  ) OR EXISTS (
    SELECT 1
    FROM bhashan.cloudinary_video_upload_intents AS upload
    JOIN bhashan.statements AS statement
      ON statement.id = upload.attached_statement_id
    WHERE statement.document #>> '{video,platform}'
      IS DISTINCT FROM 'cloudinary'
  ) THEN
    RAISE EXCEPTION
      'cannot enforce publication integrity: an existing Cloudinary statement is not attached';
  END IF;
END;
$validate_existing_cloudinary_attachments$;
