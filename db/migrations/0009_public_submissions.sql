CREATE TABLE IF NOT EXISTS bhashan.public_submissions (
  id uuid PRIMARY KEY,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'spam')),
  source_url text NOT NULL CHECK (
    char_length(source_url) BETWEEN 8 AND 2048
    AND source_url ~ '^https?://'
  ),
  source_platform text NOT NULL
    CHECK (source_platform IN ('youtube', 'facebook', 'instagram', 'other')),
  start_seconds integer CHECK (start_seconds >= 0),
  end_seconds integer CHECK (end_seconds > 0),
  speaker text NOT NULL CHECK (char_length(btrim(speaker)) BETWEEN 2 AND 160),
  event_context text NOT NULL DEFAULT ''
    CHECK (char_length(event_context) <= 500),
  claim text NOT NULL CHECK (char_length(btrim(claim)) BETWEEN 10 AND 1200),
  original_language text NOT NULL
    CHECK (char_length(btrim(original_language)) BETWEEN 2 AND 80),
  submitter_name text NOT NULL DEFAULT ''
    CHECK (char_length(submitter_name) <= 120),
  contact_email text NOT NULL CHECK (
    char_length(contact_email) BETWEEN 3 AND 254
    AND contact_email = lower(contact_email)
    AND contact_email !~ '[[:space:]]'
  ),
  synthetic_declaration boolean NOT NULL CHECK (synthetic_declaration),
  acknowledgement_status text NOT NULL DEFAULT 'pending'
    CHECK (acknowledgement_status IN ('pending', 'sent', 'failed', 'not_configured')),
  acknowledgement_sent_at timestamptz,
  reviewed_by text,
  reviewed_at timestamptz,
  review_note text CHECK (review_note IS NULL OR char_length(review_note) <= 1000),
  draft_statement_id text UNIQUE
    REFERENCES bhashan.statements(id) ON DELETE RESTRICT,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (
    (start_seconds IS NULL AND end_seconds IS NULL)
    OR (
      start_seconds IS NOT NULL
      AND end_seconds IS NOT NULL
      AND end_seconds > start_seconds
      AND end_seconds - start_seconds >= 3
      AND end_seconds - start_seconds <= 180
    )
  ),
  CHECK (
    (status = 'pending'
      AND reviewed_by IS NULL
      AND reviewed_at IS NULL
      AND draft_statement_id IS NULL)
    OR
    (status = 'accepted'
      AND reviewed_by IS NOT NULL
      AND reviewed_at IS NOT NULL
      AND draft_statement_id IS NOT NULL)
    OR
    (status IN ('rejected', 'spam')
      AND reviewed_by IS NOT NULL
      AND reviewed_at IS NOT NULL
      AND draft_statement_id IS NULL)
  ),
  CHECK (
    (acknowledgement_status = 'sent' AND acknowledgement_sent_at IS NOT NULL)
    OR
    (acknowledgement_status <> 'sent' AND acknowledgement_sent_at IS NULL)
  )
);

-- statement-breakpoint
CREATE INDEX IF NOT EXISTS public_submissions_queue_idx
  ON bhashan.public_submissions(status, created_at DESC);

-- statement-breakpoint
CREATE INDEX IF NOT EXISTS public_submissions_contact_created_idx
  ON bhashan.public_submissions(contact_email, created_at DESC);

-- statement-breakpoint
CREATE TABLE IF NOT EXISTS bhashan.public_submission_events (
  event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  submission_id uuid NOT NULL
    REFERENCES bhashan.public_submissions(id) ON DELETE RESTRICT,
  event text NOT NULL
    CHECK (event IN ('submitted', 'acknowledged', 'acknowledgement_failed', 'acknowledgement_skipped', 'accepted', 'rejected', 'spam')),
  actor text NOT NULL CHECK (btrim(actor) <> ''),
  detail text NOT NULL CHECK (
    char_length(btrim(detail)) BETWEEN 1 AND 1000
  ),
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

-- statement-breakpoint
CREATE INDEX IF NOT EXISTS public_submission_events_submission_idx
  ON bhashan.public_submission_events(submission_id, occurred_at, event_id);

-- statement-breakpoint
DROP TRIGGER IF EXISTS prevent_public_submission_event_mutation
  ON bhashan.public_submission_events;

-- statement-breakpoint
CREATE TRIGGER prevent_public_submission_event_mutation
BEFORE UPDATE OR DELETE ON bhashan.public_submission_events
FOR EACH ROW EXECUTE FUNCTION bhashan.prevent_history_mutation();

-- statement-breakpoint
DROP TRIGGER IF EXISTS prevent_public_submission_event_truncate
  ON bhashan.public_submission_events;

-- statement-breakpoint
CREATE TRIGGER prevent_public_submission_event_truncate
BEFORE TRUNCATE ON bhashan.public_submission_events
FOR EACH STATEMENT EXECUTE FUNCTION bhashan.prevent_history_mutation();
