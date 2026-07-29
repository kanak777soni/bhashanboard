-- Publication is a simple, video-first product action. Research fields remain
-- available to editors, but they are not a second approval system.
LOCK TABLE
  bhashan.statements,
  bhashan.statement_votes,
  bhashan.cloudinary_video_upload_intents
IN SHARE ROW EXCLUSIVE MODE;

-- statement-breakpoint
-- A completed, rights-attested upload with provider-verified metadata is the
-- provenance for a directly uploaded clip. Admin playback is not provenance.
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
        AND upload.rights_attested_at IS NOT NULL
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
-- Migration 0008 created this lifecycle check without an explicit name.
-- Locate only the old attachment/playback check, leaving the independent
-- playback timestamp lifecycle check intact for older rows.
DO $drop_playback_attachment_check$
DECLARE
  legacy_constraint record;
BEGIN
  FOR legacy_constraint IN
    SELECT constraint_record.conname
    FROM pg_constraint AS constraint_record
    JOIN pg_class AS relation
      ON relation.oid = constraint_record.conrelid
    JOIN pg_namespace AS namespace
      ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'bhashan'
      AND relation.relname = 'cloudinary_video_upload_intents'
      AND constraint_record.contype = 'c'
      AND pg_get_constraintdef(constraint_record.oid)
        ILIKE '%attached_statement_id%'
      AND pg_get_constraintdef(constraint_record.oid)
        ILIKE '%playback_attested_at%'
  LOOP
    EXECUTE format(
      'ALTER TABLE bhashan.cloudinary_video_upload_intents DROP CONSTRAINT %I',
      legacy_constraint.conname
    );
  END LOOP;
END;
$drop_playback_attachment_check$;

-- statement-breakpoint
ALTER TABLE bhashan.cloudinary_video_upload_intents
  DROP CONSTRAINT IF EXISTS cloudinary_video_attachment_lifecycle_check;

-- statement-breakpoint
ALTER TABLE bhashan.cloudinary_video_upload_intents
  ADD CONSTRAINT cloudinary_video_attachment_lifecycle_check
  CHECK (
    (attached_statement_id IS NULL AND attached_at IS NULL)
    OR (
      attached_statement_id IS NOT NULL
      AND attached_at IS NOT NULL
      AND status = 'completed'
      AND rights_attested_at IS NOT NULL
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
BEGIN
  IF statement_document ->> 'status' IS DISTINCT FROM 'published' THEN
    issues := array_append(issues, 'The statement must be published.');
  END IF;

  IF jsonb_typeof(statement_document -> 'speaker_id') IS DISTINCT FROM 'string'
    OR coalesce(statement_document ->> 'speaker_id', '')
      !~ '[^[:space:]]'
  THEN
    issues := array_append(issues, 'Choose the speaker.');
  END IF;

  IF jsonb_typeof(statement_document -> 'party_at_time') IS DISTINCT FROM 'string'
    OR coalesce(statement_document ->> 'party_at_time', '')
      !~ '[^[:space:]]'
  THEN
    issues := array_append(issues, 'Choose the speaker''s party.');
  END IF;

  IF jsonb_typeof(statement_document -> 'category') IS DISTINCT FROM 'string'
    OR coalesce(statement_document ->> 'category', '')
      !~ '[^[:space:]]'
  THEN
    issues := array_append(issues, 'Choose a category.');
  END IF;

  IF jsonb_typeof(statement_document -> 'neutral_title') IS DISTINCT FROM 'string'
    OR coalesce(statement_document ->> 'neutral_title', '')
      !~ '[^[:space:]]'
  THEN
    issues := array_append(issues, 'Add a short title.');
  END IF;

  IF jsonb_typeof(statement_document -> 'quote') IS DISTINCT FROM 'string'
    OR coalesce(statement_document ->> 'quote', '')
      !~ '[^[:space:]]'
  THEN
    issues := array_append(issues, 'Add the original-language quote.');
  END IF;

  IF jsonb_typeof(statement_document -> 'language') IS DISTINCT FROM 'string'
    OR coalesce(statement_document ->> 'language', '')
      !~ '[^[:space:]]'
  THEN
    issues := array_append(issues, 'The original language is required.');
  ELSIF lower(
      regexp_replace(
        statement_document ->> 'language',
        '^[[:space:]]+|[[:space:]]+$',
        '',
        'g'
      )
    ) <> 'english'
    AND (
      jsonb_typeof(statement_document -> 'quote_translation')
        IS DISTINCT FROM 'string'
      OR coalesce(statement_document ->> 'quote_translation', '')
        !~ '[^[:space:]]'
    )
  THEN
    issues := array_append(
      issues,
      'A faithful English translation is required for a non-English quote.'
    );
  END IF;

  -- A canonical YouTube ID is the footage provenance. Cloudinary provenance
  -- is checked separately against its private rights-attested upload intent.
  IF bhashan.statement_video_fingerprint(statement_document) IS NULL THEN
    issues := array_append(
      issues,
      'Add a playable video with valid start and end times.'
    );
  ELSIF coalesce(
      statement_document #>> '{video,platform}',
      statement_document #>> '{verification,embed,platform}',
      'youtube'
    ) = 'youtube'
    AND coalesce(
      statement_document #>> '{video,id}',
      statement_document #>> '{verification,embed,id}',
      ''
    ) !~ '^[A-Za-z0-9_-]{11}$'
  THEN
    issues := array_append(issues, 'The YouTube video ID is invalid.');
  END IF;

  RETURN issues;
END;
$statement_publication_issues$;

-- statement-breakpoint
REVOKE ALL ON FUNCTION bhashan.statement_publication_issues(jsonb) FROM PUBLIC;

-- statement-breakpoint
-- Existing rows that fail the new structural bar must not remain publicly
-- addressable. Research metadata is deliberately preserved.
SELECT set_config(
  'bhashan.actor',
  'migration:0011_sarcasm_publication_contract',
  true
);

-- statement-breakpoint
SELECT set_config('bhashan.action', 'seed', true);

-- statement-breakpoint
SELECT set_config(
  'bhashan.detail',
  'Held structurally incomplete live entries without deleting research notes.',
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
-- Keep the database-level ballot guard aligned with the simplified rule.
-- Watch receipt identity, the current video fingerprint and rating marker are
-- still mandatory; only the editorial stage predicate is removed.
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
    JOIN bhashan.statements AS statement
      ON statement.id = receipt.statement_id
    WHERE receipt.id = NEW.watch_receipt_id
      AND receipt.user_id = NEW.user_id
      AND receipt.statement_id = NEW.statement_id
      AND statement.status = 'published'
      AND cardinality(
        bhashan.statement_publication_issues(statement.document)
      ) = 0
      AND bhashan.statement_cloudinary_attachment_ready(
        statement.id,
        statement.document,
        false
      )
      AND statement.rating_seed_gp IS NOT NULL
      AND receipt.video_fingerprint =
        bhashan.statement_video_fingerprint(statement.document)
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'vote does not match current eligible video';
  END IF;
  RETURN NEW;
END;
$serialize_statement_vote_insert$;

-- statement-breakpoint
REVOKE ALL ON FUNCTION bhashan.serialize_statement_vote_insert() FROM PUBLIC;

-- statement-breakpoint
DO $validate_sarcasm_publication_contract$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM bhashan.statements AS statement
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
      )
  ) THEN
    RAISE EXCEPTION
      'cannot enforce sarcasm publication contract: an invalid live statement remains';
  END IF;
END;
$validate_sarcasm_publication_contract$;
