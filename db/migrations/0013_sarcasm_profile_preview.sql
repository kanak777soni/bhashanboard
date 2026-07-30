-- Sarcasm Profile marks are editorial description, not public rating inputs.
-- Keep the voted clip and every ballot immutable while allowing a registered
-- administrator to correct this narrow, audited profile after voting begins.
LOCK TABLE bhashan.statements IN SHARE ROW EXCLUSIVE MODE;

-- statement-breakpoint
CREATE OR REPLACE FUNCTION bhashan.valid_statement_sarcasm_axes(
  candidate jsonb
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
STRICT
SET search_path = pg_catalog
AS $valid_statement_sarcasm_axes$
DECLARE
  axis_key text;
  axis_value jsonb;
BEGIN
  IF jsonb_typeof(candidate) IS DISTINCT FROM 'object' THEN
    RETURN false;
  END IF;

  FOR axis_key, axis_value IN
    SELECT entry.key, entry.value
    FROM jsonb_each(candidate) AS entry(key, value)
  LOOP
    IF NOT (
      axis_key = ANY (
        ARRAY[
          'logic_damage',
          'reality_gap',
          'straight_face',
          'rewatch_value',
          'crowd_complicity',
          'consequence'
        ]::text[]
      )
    ) THEN
      RETURN false;
    END IF;
    IF jsonb_typeof(axis_value) IS DISTINCT FROM 'number'
      OR axis_value::text !~ '^[0-5]$'
    THEN
      RETURN false;
    END IF;
  END LOOP;

  RETURN true;
END;
$valid_statement_sarcasm_axes$;

-- statement-breakpoint
REVOKE ALL ON FUNCTION
  bhashan.valid_statement_sarcasm_axes(jsonb)
FROM PUBLIC;

-- statement-breakpoint
ALTER TABLE bhashan.statements
  DROP CONSTRAINT IF EXISTS statements_sarcasm_axes_check;

-- statement-breakpoint
ALTER TABLE bhashan.statements
  ADD CONSTRAINT statements_sarcasm_axes_check
  CHECK (
    bhashan.valid_statement_sarcasm_axes(document -> 'axes') IS TRUE
  );

-- statement-breakpoint
CREATE OR REPLACE FUNCTION bhashan.protect_statement_rating_inputs()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SET search_path = pg_catalog, bhashan
AS $protect_statement_rating_inputs$
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended('bhashan:statement-rating:' || OLD.id, 0)
  );

  IF
    (NEW.document - 'status' - 'hall_of_fame' - 'axes')
      IS DISTINCT FROM
    (OLD.document - 'status' - 'hall_of_fame' - 'axes')
    AND EXISTS (
      SELECT 1
      FROM bhashan.statement_votes AS vote
      WHERE vote.statement_id = OLD.id
    )
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = format(
        'statement %s is immutable after its first vote; only status, hall_of_fame, and audited sarcasm axes may change',
        OLD.id
      );
  END IF;

  RETURN NEW;
END;
$protect_statement_rating_inputs$;

-- statement-breakpoint
REVOKE ALL ON FUNCTION bhashan.protect_statement_rating_inputs() FROM PUBLIC;

-- statement-breakpoint
CREATE OR REPLACE FUNCTION bhashan.prepare_statement_rating_seed()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SET search_path = pg_catalog, bhashan
AS $prepare_statement_rating_seed$
BEGIN
  -- Hall and Sarcasm Profile-only writes cannot change publication or public
  -- rating eligibility, so they preserve the neutral legacy seed untouched.
  IF TG_OP = 'UPDATE'
    AND (NEW.document - 'hall_of_fame' - 'axes')
      IS NOT DISTINCT FROM
      (OLD.document - 'hall_of_fame' - 'axes')
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
REVOKE ALL ON FUNCTION bhashan.prepare_statement_rating_seed() FROM PUBLIC;
