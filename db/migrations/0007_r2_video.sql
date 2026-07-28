CREATE TABLE IF NOT EXISTS bhashan.r2_video_upload_intents (
  id uuid PRIMARY KEY,
  actor_user_id text NOT NULL REFERENCES public.auth_user(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (
    status IN ('authorized', 'processing', 'completed', 'rejected', 'expired')
  ),
  quarantine_key text NOT NULL UNIQUE CHECK (
    quarantine_key ~ '^quarantine/statement-videos/[0-9a-f]{2}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.mp4$'
  ),
  public_key text CHECK (
    public_key IS NULL
    OR public_key ~ '^statement-videos/[0-9a-f]{2}/[0-9a-f]{64}\.mp4$'
  ),
  expected_bytes bigint NOT NULL CHECK (expected_bytes BETWEEN 1 AND 52428800),
  content_type text NOT NULL CHECK (content_type = 'video/mp4'),
  rights_attested_at timestamptz NOT NULL,
  playback_attested_at timestamptz,
  attached_statement_id text REFERENCES bhashan.statements(id) ON DELETE RESTRICT,
  attached_at timestamptz,
  detached_at timestamptz,
  orphaned_at timestamptz,
  quarantine_etag text CHECK (quarantine_etag ~ '^[0-9a-f]{32}$'),
  public_etag text CHECK (public_etag ~ '^[0-9a-f]{32}$'),
  sha256 text CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  duration_ms integer CHECK (duration_ms BETWEEN 3000 AND 180000),
  last_error_code text CHECK (
    last_error_code IS NULL OR last_error_code ~ '^[A-Z0-9_]{1,64}$'
  ),
  upload_expires_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  processing_started_at timestamptz,
  completed_at timestamptz,
  quarantine_deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (upload_expires_at <= expires_at),
  CHECK (
    (attached_statement_id IS NULL AND attached_at IS NULL)
    OR
    (attached_statement_id IS NOT NULL
      AND attached_at IS NOT NULL
      AND status = 'completed'
      AND playback_attested_at IS NOT NULL)
  ),
  CHECK (orphaned_at IS NULL OR (status = 'completed' AND attached_statement_id IS NULL)),
  CHECK (
    public_key IS NULL
    OR sha256 IS NULL
    OR public_key = (
      'statement-videos/' || left(sha256, 2) || '/' || sha256 || '.mp4'
    )
  ),
  CHECK (
    (status = 'completed'
      AND public_key IS NOT NULL
      AND quarantine_etag IS NOT NULL
      AND public_etag IS NOT NULL
      AND sha256 IS NOT NULL
      AND duration_ms IS NOT NULL
      AND completed_at IS NOT NULL)
    OR
    (status <> 'completed'
      AND public_key IS NULL
      AND public_etag IS NULL
      AND sha256 IS NULL
      AND duration_ms IS NULL
      AND completed_at IS NULL)
  )
);

-- statement-breakpoint
CREATE INDEX IF NOT EXISTS r2_video_upload_intents_actor_created_idx
  ON bhashan.r2_video_upload_intents (actor_user_id, created_at DESC);

-- statement-breakpoint
CREATE INDEX IF NOT EXISTS r2_video_upload_intents_quarantine_cleanup_idx
  ON bhashan.r2_video_upload_intents (expires_at, status)
  WHERE quarantine_deleted_at IS NULL;

-- statement-breakpoint
CREATE INDEX IF NOT EXISTS r2_video_upload_intents_public_key_idx
  ON bhashan.r2_video_upload_intents (public_key)
  WHERE public_key IS NOT NULL;

-- statement-breakpoint
CREATE INDEX IF NOT EXISTS r2_video_upload_intents_attachment_idx
  ON bhashan.r2_video_upload_intents (attached_statement_id)
  WHERE attached_statement_id IS NOT NULL;

-- statement-breakpoint
CREATE INDEX IF NOT EXISTS r2_video_upload_intents_orphan_audit_idx
  ON bhashan.r2_video_upload_intents (completed_at, public_key)
  WHERE status = 'completed'
    AND attached_statement_id IS NULL
    AND orphaned_at IS NULL;

-- statement-breakpoint
CREATE TABLE IF NOT EXISTS bhashan.r2_object_deletion_intents (
  id uuid PRIMARY KEY,
  -- Public evidence objects are deliberately never auto-deleted. This outbox
  -- is restricted to the private quarantine bucket so a statement save can
  -- never race an automatic final-object deletion.
  bucket_role text NOT NULL CHECK (bucket_role = 'upload'),
  object_key text NOT NULL,
  upload_intent_id uuid REFERENCES bhashan.r2_video_upload_intents(id) ON DELETE RESTRICT,
  reason text NOT NULL CHECK (
    reason IN ('completed-quarantine', 'expired-quarantine', 'untracked-quarantine')
  ),
  status text NOT NULL DEFAULT 'planned' CHECK (
    status IN ('planned', 'completed', 'cancelled')
  ),
  requested_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  completed_at timestamptz,
  cancelled_at timestamptz,
  last_error_code text CHECK (
    last_error_code IS NULL OR last_error_code ~ '^[A-Z0-9_]{1,64}$'
  ),
  CHECK (
    object_key ~ '^quarantine/statement-videos/[0-9a-f]{2}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.mp4$'
  ),
  CHECK (
    (status = 'planned' AND completed_at IS NULL AND cancelled_at IS NULL)
    OR (status = 'completed' AND completed_at IS NOT NULL AND cancelled_at IS NULL)
    OR (status = 'cancelled' AND completed_at IS NULL AND cancelled_at IS NOT NULL)
  )
);

-- statement-breakpoint
CREATE INDEX IF NOT EXISTS r2_object_deletion_intents_pending_idx
  ON bhashan.r2_object_deletion_intents (requested_at)
  WHERE status = 'planned';

-- statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS r2_object_deletion_intents_active_key_uidx
  ON bhashan.r2_object_deletion_intents (bucket_role, object_key)
  -- Only an unfinished quarantine deletion is exclusive. Completed rows remain
  -- as history and do not prevent a later idempotent cleanup record.
  WHERE status = 'planned';

-- statement-breakpoint
ALTER TABLE bhashan.statement_watch_sessions
  DROP CONSTRAINT IF EXISTS statement_watch_sessions_video_platform_check;

-- statement-breakpoint
ALTER TABLE bhashan.statement_watch_sessions
  ADD CONSTRAINT statement_watch_sessions_video_platform_check
  CHECK (video_platform IN ('youtube', 'r2')) NOT VALID;

-- statement-breakpoint
ALTER TABLE bhashan.statement_watch_sessions
  VALIDATE CONSTRAINT statement_watch_sessions_video_platform_check;

-- statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS statements_r2_video_id_uidx
  ON bhashan.statements ((document #>> '{video,id}'))
  WHERE document #>> '{video,platform}' = 'r2';

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
  candidate_etag text;
  candidate_sha256 text;
  candidate_content_type text;
  start_text text;
  end_text text;
  bytes_text text;
  duration_ms_text text;
  start_seconds bigint;
  end_seconds bigint;
  object_bytes bigint;
  duration_ms bigint;
BEGIN
  FOREACH candidate IN ARRAY ARRAY[
    statement_document -> 'video',
    statement_document #> '{verification,embed}'
  ] LOOP
    IF candidate IS NULL OR jsonb_typeof(candidate) <> 'object' THEN
      CONTINUE;
    END IF;
    candidate_id := btrim(coalesce(candidate ->> 'id', ''));
    -- A missing legacy platform means YouTube. An explicit JSON null is not a
    -- missing field and must fail closed instead of silently becoming YouTube.
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
      -- Preserve the original v1 byte sequence exactly so existing watch
      -- receipts remain valid after this migration.
      RETURN md5(concat_ws(
        '|', 'v1', 'youtube', candidate_id, start_seconds::text, end_seconds::text
      ));
    END IF;

    IF candidate_platform IS DISTINCT FROM 'r2' THEN
      CONTINUE;
    END IF;
    candidate_etag := btrim(coalesce(candidate ->> 'etag', ''));
    -- Match normalizeR2Etag in lib/video.ts: accept an S3 quoted or weak
    -- quoted value, then store/fingerprint only lowercase bare hex.
    IF left(candidate_etag, 3) = 'W/"' AND right(candidate_etag, 1) = '"' THEN
      candidate_etag := substr(candidate_etag, 4, length(candidate_etag) - 4);
    ELSIF left(candidate_etag, 1) = '"' AND right(candidate_etag, 1) = '"' THEN
      candidate_etag := substr(candidate_etag, 2, length(candidate_etag) - 2);
    END IF;
    candidate_etag := lower(candidate_etag);
    -- Match normalizeR2Sha256 in lib/video.ts. The digest was computed from
    -- the complete quarantine object by the server, then stored canonically.
    candidate_sha256 := lower(btrim(coalesce(candidate ->> 'sha256', '')));
    candidate_content_type := coalesce(candidate ->> 'contentType', '');
    bytes_text := candidate ->> 'bytes';
    duration_ms_text := candidate ->> 'durationMs';
    IF candidate_id !~ '^statement-videos/[0-9a-f]{2}/[0-9a-f]{64}\.mp4$'
      OR candidate_etag !~ '^[0-9a-f]{32}$'
      OR candidate_sha256 !~ '^[0-9a-f]{64}$'
      OR candidate_id <> (
        'statement-videos/' || left(candidate_sha256, 2) || '/' || candidate_sha256 || '.mp4'
      )
      OR candidate_content_type <> 'video/mp4'
      OR bytes_text IS NULL
      OR bytes_text !~ '^\d+$'
      OR duration_ms_text IS NULL
      OR duration_ms_text !~ '^\d+$'
    THEN
      CONTINUE;
    END IF;
    BEGIN
      object_bytes := bytes_text::bigint;
      duration_ms := duration_ms_text::bigint;
    EXCEPTION WHEN numeric_value_out_of_range THEN
      CONTINUE;
    END;
    IF object_bytes < 1
      OR object_bytes > 52428800
      OR duration_ms < 3000
      OR duration_ms > 180000
      OR start_seconds <> 0
      OR end_seconds <> (duration_ms + 999) / 1000
    THEN
      CONTINUE;
    END IF;
    RETURN md5(concat_ws(
      '|',
      'v3',
      'r2',
      candidate_id,
      candidate_sha256,
      start_seconds::text,
      end_seconds::text,
      duration_ms::text,
      object_bytes::text
    ));
  END LOOP;
  RETURN NULL;
END;
$statement_video_fingerprint$;

-- statement-breakpoint
REVOKE ALL ON FUNCTION bhashan.statement_video_fingerprint(jsonb) FROM PUBLIC;
