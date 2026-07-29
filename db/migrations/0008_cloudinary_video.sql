-- Block the retiring application from creating R2 state after the guard has
-- checked it. These locks are held until the migration transaction commits.
LOCK TABLE
  bhashan.r2_video_upload_intents,
  bhashan.r2_object_deletion_intents,
  bhashan.statements,
  bhashan.statement_watch_sessions
IN ACCESS EXCLUSIVE MODE;

-- statement-breakpoint
DO $cloudinary_r2_retirement_guard$
BEGIN
  -- This installation never attached an R2 asset. Refuse to discard any
  -- unexpected R2 state so a populated environment requires an explicit data
  -- migration instead of silently losing evidence or deletion history.
  IF EXISTS (SELECT 1 FROM bhashan.r2_video_upload_intents) THEN
    RAISE EXCEPTION
      'cannot retire R2: bhashan.r2_video_upload_intents is not empty';
  END IF;

  IF EXISTS (SELECT 1 FROM bhashan.r2_object_deletion_intents) THEN
    RAISE EXCEPTION
      'cannot retire R2: bhashan.r2_object_deletion_intents is not empty';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM bhashan.statements AS statement
    WHERE statement.document #>> '{video,platform}' IN ('r2', 'cloudinary')
      OR statement.document #>> '{verification,embed,platform}' IN ('r2', 'cloudinary')
      OR statement.document #>> '{video,id}' LIKE 'statement-videos/%'
      OR statement.document #>> '{verification,embed,id}' LIKE 'statement-videos/%'
      OR statement.document #>> '{video,id}' LIKE 'bhashanboard/statement-videos/%'
      OR statement.document #>> '{verification,embed,id}' LIKE 'bhashanboard/statement-videos/%'
  ) THEN
    RAISE EXCEPTION
      'cannot switch video storage: a statement references unmanaged uploaded evidence';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM bhashan.statement_watch_sessions AS session
    WHERE session.video_platform = 'r2'
  ) THEN
    RAISE EXCEPTION 'cannot retire R2: an R2 watch session exists';
  END IF;
END;
$cloudinary_r2_retirement_guard$;

-- statement-breakpoint
DROP TABLE bhashan.r2_object_deletion_intents;

-- statement-breakpoint
DROP TABLE bhashan.r2_video_upload_intents;

-- statement-breakpoint
DROP INDEX IF EXISTS bhashan.statements_r2_video_id_uidx;

-- statement-breakpoint
CREATE TABLE bhashan.cloudinary_video_upload_intents (
  id uuid PRIMARY KEY,
  actor_user_id text NOT NULL REFERENCES public.auth_user(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (
    status IN (
      'authorized',
      'processing',
      'completed',
      'rejected',
      'expired',
      'deleting',
      'deleted'
    )
  ),
  public_id text NOT NULL UNIQUE CHECK (
    public_id ~ '^bhashanboard/statement-videos/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ),
  expected_bytes bigint NOT NULL CHECK (expected_bytes BETWEEN 1 AND 52428800),
  actual_bytes bigint CHECK (actual_bytes BETWEEN 1 AND 52428800),
  derived_bytes bigint CHECK (derived_bytes BETWEEN 1 AND 104857600),
  asset_id text CHECK (
    asset_id IS NULL OR asset_id ~ '^[A-Za-z0-9_-]{16,128}$'
  ),
  version bigint CHECK (version > 0),
  duration_ms integer CHECK (duration_ms BETWEEN 3000 AND 180000),
  format text CHECK (format IS NULL OR format = 'mp4'),
  rights_attested_at timestamptz NOT NULL,
  playback_attested_at timestamptz,
  attached_statement_id text REFERENCES bhashan.statements(id) ON DELETE RESTRICT,
  attached_at timestamptz,
  detached_at timestamptz,
  upload_expires_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  processing_started_at timestamptz,
  transformation_requested_at timestamptz,
  completed_at timestamptz,
  deletion_started_at timestamptz,
  deletion_attempt_id uuid,
  deleted_at timestamptz,
  last_error_code text CHECK (
    last_error_code IS NULL OR last_error_code ~ '^[A-Z0-9_]{1,64}$'
  ),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT cloudinary_video_upload_intents_attachment_unique
    UNIQUE (attached_statement_id)
    DEFERRABLE INITIALLY DEFERRED,
  CHECK (upload_expires_at <= expires_at),
  CHECK (
    (attached_statement_id IS NULL AND attached_at IS NULL)
    OR
    (
      attached_statement_id IS NOT NULL
      AND attached_at IS NOT NULL
      AND status = 'completed'
      AND playback_attested_at IS NOT NULL
    )
  ),
  CHECK (
    playback_attested_at IS NULL
    OR status IN ('completed', 'deleting', 'deleted')
  ),
  CHECK (
    status <> 'processing' OR processing_started_at IS NOT NULL
  ),
  CHECK (
    completed_at IS NULL OR status IN ('completed', 'deleting', 'deleted')
  ),
  CHECK (
    status <> 'completed'
    OR (
      processing_started_at IS NOT NULL
      AND transformation_requested_at IS NOT NULL
      AND completed_at IS NOT NULL
      AND actual_bytes IS NOT NULL
      AND actual_bytes = expected_bytes
      AND derived_bytes IS NOT NULL
      AND asset_id IS NOT NULL
      AND version IS NOT NULL
      AND duration_ms IS NOT NULL
      AND format = 'mp4'
    )
  ),
  CHECK (
    status IN ('completed', 'deleting', 'deleted')
    OR (
      actual_bytes IS NULL
      AND derived_bytes IS NULL
      AND version IS NULL
      AND duration_ms IS NULL
      AND format IS NULL
      AND completed_at IS NULL
      AND playback_attested_at IS NULL
    )
  ),
  CHECK (
    asset_id IS NULL OR status <> 'authorized'
  ),
  CHECK (
    transformation_requested_at IS NULL OR status <> 'authorized'
  ),
  CHECK (
    status NOT IN ('deleting', 'deleted')
    OR (
      deletion_started_at IS NOT NULL
      AND deletion_attempt_id IS NOT NULL
      AND attached_statement_id IS NULL
      AND attached_at IS NULL
    )
  ),
  CHECK (
    deletion_started_at IS NULL OR status IN ('deleting', 'deleted')
  ),
  CHECK (
    deletion_attempt_id IS NULL OR status IN ('deleting', 'deleted')
  ),
  CHECK (status <> 'deleted' OR deleted_at IS NOT NULL),
  CHECK (deleted_at IS NULL OR status = 'deleted')
);

-- statement-breakpoint
CREATE INDEX cloudinary_video_upload_intents_actor_created_idx
  ON bhashan.cloudinary_video_upload_intents (actor_user_id, created_at DESC);

-- statement-breakpoint
CREATE INDEX cloudinary_video_upload_intents_expiry_idx
  ON bhashan.cloudinary_video_upload_intents (
    status,
    upload_expires_at,
    expires_at
  )
  WHERE status IN ('authorized', 'processing');

-- statement-breakpoint
CREATE INDEX cloudinary_video_upload_intents_retention_idx
  ON bhashan.cloudinary_video_upload_intents (
    status,
    (coalesce(detached_at, completed_at)),
    deletion_started_at
  )
  WHERE attached_statement_id IS NULL
    AND status IN ('completed', 'rejected', 'expired', 'deleting');

-- statement-breakpoint
ALTER TABLE bhashan.statement_watch_sessions
  DROP CONSTRAINT IF EXISTS statement_watch_sessions_video_platform_check;

-- statement-breakpoint
ALTER TABLE bhashan.statement_watch_sessions
  ADD CONSTRAINT statement_watch_sessions_video_platform_check
  CHECK (video_platform IN ('youtube', 'cloudinary')) NOT VALID;

-- statement-breakpoint
ALTER TABLE bhashan.statement_watch_sessions
  VALIDATE CONSTRAINT statement_watch_sessions_video_platform_check;

-- statement-breakpoint
CREATE UNIQUE INDEX statements_cloudinary_video_id_uidx
  ON bhashan.statements ((document #>> '{video,id}'))
  WHERE document #>> '{video,platform}' = 'cloudinary';

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
  candidate_index integer;
  candidate_id text;
  candidate_platform text;
  candidate_asset_id text;
  candidate_format text;
  start_text text;
  end_text text;
  version_text text;
  bytes_text text;
  derived_bytes_text text;
  duration_ms_text text;
  start_seconds bigint;
  end_seconds bigint;
  cloudinary_version bigint;
  object_bytes bigint;
  derived_bytes bigint;
  duration_ms bigint;
BEGIN
  FOR candidate_index IN 1..2 LOOP
    candidate := CASE candidate_index
      WHEN 1 THEN statement_document -> 'video'
      ELSE statement_document #> '{verification,embed}'
    END;
    IF candidate IS NULL OR jsonb_typeof(candidate) <> 'object' THEN
      CONTINUE;
    END IF;
    candidate_id := btrim(coalesce(candidate ->> 'id', ''));
    -- Missing legacy platform means YouTube. Explicit JSON null must fail
    -- closed instead of silently becoming YouTube.
    candidate_platform := CASE
      WHEN candidate ? 'platform' THEN candidate ->> 'platform'
      ELSE 'youtube'
    END;
    start_text := coalesce(candidate ->> 'start', candidate ->> 'start_s');
    end_text := coalesce(candidate ->> 'end', candidate ->> 'end_s');
    IF start_text IS NULL
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
    THEN
      CONTINUE;
    END IF;

    IF candidate_platform = 'youtube' THEN
      IF candidate_id !~ '^[A-Za-z0-9_-]{6,20}$'
        OR end_seconds > 86400
      THEN
        CONTINUE;
      END IF;
      -- Preserve the original v1 bytes so existing YouTube receipts remain
      -- valid after switching the uploaded-video provider.
      RETURN md5(concat_ws(
        '|', 'v1', 'youtube', candidate_id, start_seconds::text, end_seconds::text
      ));
    END IF;

    IF candidate_platform IS DISTINCT FROM 'cloudinary' THEN
      CONTINUE;
    END IF;
    -- Hosted assets are valid only at the attachment-tracked root location.
    -- Keep verification.embed solely as a compatibility path for YouTube.
    IF candidate_index <> 1 THEN
      CONTINUE;
    END IF;
    candidate_asset_id := btrim(coalesce(candidate ->> 'assetId', ''));
    candidate_format := btrim(coalesce(candidate ->> 'format', ''));
    version_text := candidate ->> 'version';
    bytes_text := candidate ->> 'bytes';
    derived_bytes_text := candidate ->> 'derivedBytes';
    duration_ms_text := candidate ->> 'durationMs';
    IF candidate_id !~ '^bhashanboard/statement-videos/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      OR candidate_asset_id !~ '^[A-Za-z0-9_-]{16,128}$'
      OR candidate_format <> 'mp4'
      OR version_text IS NULL
      OR version_text !~ '^\d+$'
      OR bytes_text IS NULL
      OR bytes_text !~ '^\d+$'
      OR derived_bytes_text IS NULL
      OR derived_bytes_text !~ '^\d+$'
      OR duration_ms_text IS NULL
      OR duration_ms_text !~ '^\d+$'
    THEN
      CONTINUE;
    END IF;
    BEGIN
      cloudinary_version := version_text::bigint;
      object_bytes := bytes_text::bigint;
      derived_bytes := derived_bytes_text::bigint;
      duration_ms := duration_ms_text::bigint;
    EXCEPTION WHEN numeric_value_out_of_range THEN
      CONTINUE;
    END;
    IF cloudinary_version < 1
      OR object_bytes < 1
      OR object_bytes > 52428800
      OR derived_bytes < 1
      OR derived_bytes > 104857600
      OR duration_ms < 3000
      OR duration_ms > 180000
      OR start_seconds <> 0
      OR end_seconds <> (duration_ms + 999) / 1000
    THEN
      CONTINUE;
    END IF;
    RETURN md5(concat_ws(
      '|',
      'v4',
      'cloudinary',
      candidate_id,
      candidate_asset_id,
      cloudinary_version::text,
      start_seconds::text,
      end_seconds::text,
      duration_ms::text,
      object_bytes::text,
      derived_bytes::text
    ));
  END LOOP;
  RETURN NULL;
END;
$statement_video_fingerprint$;

-- statement-breakpoint
REVOKE ALL ON FUNCTION bhashan.statement_video_fingerprint(jsonb) FROM PUBLIC;
