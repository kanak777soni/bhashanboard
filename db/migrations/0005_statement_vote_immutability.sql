CREATE OR REPLACE FUNCTION bhashan.protect_statement_rating_inputs()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SET search_path = pg_catalog, bhashan
AS $protect_statement_rating_inputs$
BEGIN
  -- Direct SQL and the corpus importer must serialize with the first ballot,
  -- not only application code that happens to observe the voting contract.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('bhashan:statement-rating:' || OLD.id, 0)
  );

  IF
    (NEW.document - 'status' - 'hall_of_fame')
      IS DISTINCT FROM
    (OLD.document - 'status' - 'hall_of_fame')
    AND EXISTS (
      SELECT 1
      FROM bhashan.statement_votes AS vote
      WHERE vote.statement_id = OLD.id
    )
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = format(
        'statement %s rating inputs are immutable after its first vote; only status and hall_of_fame may change',
        OLD.id
      );
  END IF;

  RETURN NEW;
END;
$protect_statement_rating_inputs$;

-- statement-breakpoint
REVOKE ALL ON FUNCTION bhashan.protect_statement_rating_inputs() FROM PUBLIC;

-- statement-breakpoint
DROP TRIGGER IF EXISTS protect_statement_rating_inputs
  ON bhashan.statements;

-- statement-breakpoint
CREATE TRIGGER protect_statement_rating_inputs
BEFORE UPDATE ON bhashan.statements
FOR EACH ROW EXECUTE FUNCTION bhashan.protect_statement_rating_inputs();

-- statement-breakpoint
CREATE OR REPLACE FUNCTION bhashan.serialize_statement_vote_insert()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SET search_path = pg_catalog, bhashan
AS $serialize_statement_vote_insert$
BEGIN
  -- This also covers maintenance scripts and direct SQL inserts. The lock is
  -- re-entrant when the application has already taken it in this transaction.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('bhashan:statement-rating:' || NEW.statement_id, 0)
  );
  RETURN NEW;
END;
$serialize_statement_vote_insert$;

-- statement-breakpoint
REVOKE ALL ON FUNCTION bhashan.serialize_statement_vote_insert() FROM PUBLIC;

-- statement-breakpoint
DROP TRIGGER IF EXISTS serialize_statement_vote_insert
  ON bhashan.statement_votes;

-- statement-breakpoint
CREATE TRIGGER serialize_statement_vote_insert
BEFORE INSERT ON bhashan.statement_votes
FOR EACH ROW EXECUTE FUNCTION bhashan.serialize_statement_vote_insert();
