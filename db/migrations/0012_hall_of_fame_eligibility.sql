-- The Hall is a permanent editorial honour, distinct from merely reaching
-- the public standings. A clip must first reach Kohinoor Class and collect
-- at least twenty-five valid public rulings.
SELECT set_config('bhashan.actor', 'hall-eligibility-migration', true);

-- statement-breakpoint
SELECT set_config('bhashan.action', 'remove-ineligible-hall-entry', true);

-- statement-breakpoint
SELECT set_config(
  'bhashan.detail',
  'Removed Hall of Fame status under the published 25-vote Kohinoor eligibility rule.',
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
WHERE coalesce(
    (statement.document ->> 'hall_of_fame')::boolean,
    false
  )
  AND NOT EXISTS (
    SELECT 1
    FROM bhashan.statement_rating_aggregates AS aggregate
    WHERE aggregate.statement_id = statement.id
      AND aggregate.valid_vote_count >= 25
      AND aggregate.gp >= 1875
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
  target_gp integer := CASE
    WHEN TG_OP = 'DELETE' THEN 0
    ELSE NEW.gp
  END;
BEGIN
  IF target_valid_vote_count >= 25 AND target_gp >= 1875 THEN
    RETURN NULL;
  END IF;

  IF nullif(current_setting('bhashan.actor', true), '') IS NULL THEN
    PERFORM set_config('bhashan.actor', 'rating-integrity-trigger', true);
  END IF;
  IF nullif(current_setting('bhashan.action', true), '') IS NULL THEN
    PERFORM set_config('bhashan.action', 'remove-ineligible-hall-entry', true);
  END IF;
  IF nullif(current_setting('bhashan.detail', true), '') IS NULL THEN
    PERFORM set_config(
      'bhashan.detail',
      'Removed Hall of Fame status after the clip fell below 25 valid rulings or Kohinoor Class.',
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
CREATE OR REPLACE FUNCTION bhashan.enforce_statement_publication_integrity()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SET search_path = pg_catalog, bhashan
AS $enforce_statement_publication_integrity$
DECLARE
  issues text[];
  valid_vote_count bigint;
  rating_gp integer;
  hall_requested boolean :=
    coalesce((NEW.document ->> 'hall_of_fame')::boolean, false);
  hall_was_set boolean := CASE
    WHEN TG_OP = 'INSERT' THEN false
    ELSE coalesce((OLD.document ->> 'hall_of_fame')::boolean, false)
  END;
BEGIN
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
        MESSAGE = 'statement Cloudinary video is not rights-attested and attached';
    END IF;
  END IF;

  IF hall_requested THEN
    IF NEW.document ->> 'status' <> 'published' THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'Hall of Fame requires a live statement';
    END IF;

    SELECT aggregate.valid_vote_count, aggregate.gp
    INTO valid_vote_count, rating_gp
    FROM bhashan.statement_rating_aggregates AS aggregate
    WHERE aggregate.statement_id = NEW.id;

    IF coalesce(valid_vote_count, 0) < 25 OR coalesce(rating_gp, 0) < 1875 THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'Hall of Fame requires at least twenty-five valid public rulings and Kohinoor Class';
    END IF;
  END IF;

  RETURN NEW;
END;
$enforce_statement_publication_integrity$;

-- statement-breakpoint
REVOKE ALL ON FUNCTION bhashan.enforce_statement_publication_integrity()
  FROM PUBLIC;
