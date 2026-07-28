CREATE TABLE IF NOT EXISTS bhashan.statement_watch_sessions (
  id uuid PRIMARY KEY,
  user_id text NOT NULL REFERENCES public.auth_user(id) ON DELETE CASCADE,
  statement_id text NOT NULL REFERENCES bhashan.statements(id) ON DELETE RESTRICT,
  video_platform text NOT NULL CHECK (video_platform = 'youtube'),
  video_id text NOT NULL CHECK (btrim(video_id) <> ''),
  video_fingerprint text NOT NULL CHECK (video_fingerprint ~ '^[0-9a-f]{32}$'),
  clip_start_ms bigint NOT NULL CHECK (clip_start_ms >= 0),
  clip_end_ms bigint NOT NULL,
  required_watch_ms bigint NOT NULL CHECK (required_watch_ms > 0),
  contiguous_through_ms bigint NOT NULL,
  credited_watch_ms bigint NOT NULL DEFAULT 0 CHECK (credited_watch_ms >= 0),
  last_position_ms bigint NOT NULL,
  last_heartbeat_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  last_player_state text NOT NULL DEFAULT 'paused'
    CHECK (last_player_state IN ('playing', 'paused', 'ended')),
  last_visible boolean NOT NULL DEFAULT true,
  reached_end boolean NOT NULL DEFAULT false,
  qualified_at timestamptz,
  expires_at timestamptz NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (clip_end_ms > clip_start_ms),
  CHECK (required_watch_ms <= clip_end_ms - clip_start_ms),
  CHECK (contiguous_through_ms BETWEEN clip_start_ms AND clip_end_ms),
  CHECK (credited_watch_ms <= clip_end_ms - clip_start_ms),
  CHECK (last_position_ms BETWEEN clip_start_ms AND clip_end_ms),
  CHECK (
    qualified_at IS NULL
    OR (credited_watch_ms >= required_watch_ms AND reached_end)
  )
);

-- statement-breakpoint
CREATE INDEX IF NOT EXISTS statement_watch_sessions_user_statement_idx
  ON bhashan.statement_watch_sessions(user_id, statement_id, created_at DESC);

-- statement-breakpoint
CREATE INDEX IF NOT EXISTS statement_watch_sessions_expiry_idx
  ON bhashan.statement_watch_sessions(expires_at)
  WHERE qualified_at IS NULL;

-- statement-breakpoint
CREATE TABLE IF NOT EXISTS bhashan.statement_watch_receipts (
  id uuid PRIMARY KEY,
  watch_session_id uuid NOT NULL UNIQUE
    REFERENCES bhashan.statement_watch_sessions(id) ON DELETE RESTRICT,
  user_id text NOT NULL REFERENCES public.auth_user(id) ON DELETE RESTRICT,
  statement_id text NOT NULL REFERENCES bhashan.statements(id) ON DELETE RESTRICT,
  video_fingerprint text NOT NULL CHECK (video_fingerprint ~ '^[0-9a-f]{32}$'),
  watched_ms bigint NOT NULL CHECK (watched_ms > 0),
  required_watch_ms bigint NOT NULL CHECK (required_watch_ms > 0),
  qualified_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (watched_ms >= required_watch_ms),
  UNIQUE (user_id, statement_id, video_fingerprint)
);

-- statement-breakpoint
CREATE TABLE IF NOT EXISTS bhashan.statement_votes (
  id uuid PRIMARY KEY,
  user_id text NOT NULL REFERENCES public.auth_user(id) ON DELETE RESTRICT,
  statement_id text NOT NULL REFERENCES bhashan.statements(id) ON DELETE RESTRICT,
  value smallint NOT NULL CHECK (value IN (0, 25, 50, 75, 100)),
  watch_receipt_id uuid NOT NULL UNIQUE
    REFERENCES bhashan.statement_watch_receipts(id) ON DELETE RESTRICT,
  rating_model_version integer NOT NULL CHECK (rating_model_version > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (user_id, statement_id)
);

-- statement-breakpoint
CREATE INDEX IF NOT EXISTS statement_votes_statement_created_idx
  ON bhashan.statement_votes(statement_id, created_at DESC);

-- statement-breakpoint
CREATE INDEX IF NOT EXISTS statement_votes_user_created_idx
  ON bhashan.statement_votes(user_id, created_at DESC);

-- statement-breakpoint
CREATE TABLE IF NOT EXISTS bhashan.statement_vote_exclusions (
  vote_id uuid PRIMARY KEY REFERENCES bhashan.statement_votes(id) ON DELETE RESTRICT,
  actor_user_id text NOT NULL REFERENCES public.auth_user(id) ON DELETE RESTRICT,
  reason text NOT NULL CHECK (btrim(reason) <> ''),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

-- statement-breakpoint
CREATE TABLE IF NOT EXISTS bhashan.statement_rating_aggregates (
  statement_id text PRIMARY KEY REFERENCES bhashan.statements(id) ON DELETE RESTRICT,
  prior_performance numeric(9, 6) NOT NULL
    CHECK (prior_performance BETWEEN 0 AND 100),
  prior_strength integer NOT NULL CHECK (prior_strength >= 0),
  valid_vote_count bigint NOT NULL DEFAULT 0 CHECK (valid_vote_count >= 0),
  valid_vote_sum bigint NOT NULL DEFAULT 0 CHECK (valid_vote_sum >= 0),
  vote_0_count bigint NOT NULL DEFAULT 0 CHECK (vote_0_count >= 0),
  vote_25_count bigint NOT NULL DEFAULT 0 CHECK (vote_25_count >= 0),
  vote_50_count bigint NOT NULL DEFAULT 0 CHECK (vote_50_count >= 0),
  vote_75_count bigint NOT NULL DEFAULT 0 CHECK (vote_75_count >= 0),
  vote_100_count bigint NOT NULL DEFAULT 0 CHECK (vote_100_count >= 0),
  performance numeric(9, 6) NOT NULL CHECK (performance BETWEEN 0 AND 100),
  gp integer NOT NULL CHECK (gp BETWEEN 1000 AND 2000),
  model_version integer NOT NULL CHECK (model_version > 0),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (valid_vote_sum <= valid_vote_count * 100),
  CHECK (
    vote_0_count + vote_25_count + vote_50_count + vote_75_count + vote_100_count
    = valid_vote_count
  )
);

-- statement-breakpoint
DROP TRIGGER IF EXISTS prevent_watch_receipt_mutation
  ON bhashan.statement_watch_receipts;

-- statement-breakpoint
CREATE TRIGGER prevent_watch_receipt_mutation
BEFORE UPDATE OR DELETE ON bhashan.statement_watch_receipts
FOR EACH ROW EXECUTE FUNCTION bhashan.prevent_history_mutation();

-- statement-breakpoint
DROP TRIGGER IF EXISTS prevent_watch_receipt_truncate
  ON bhashan.statement_watch_receipts;

-- statement-breakpoint
CREATE TRIGGER prevent_watch_receipt_truncate
BEFORE TRUNCATE ON bhashan.statement_watch_receipts
FOR EACH STATEMENT EXECUTE FUNCTION bhashan.prevent_history_mutation();

-- statement-breakpoint
DROP TRIGGER IF EXISTS prevent_statement_vote_mutation
  ON bhashan.statement_votes;

-- statement-breakpoint
CREATE TRIGGER prevent_statement_vote_mutation
BEFORE UPDATE OR DELETE ON bhashan.statement_votes
FOR EACH ROW EXECUTE FUNCTION bhashan.prevent_history_mutation();

-- statement-breakpoint
DROP TRIGGER IF EXISTS prevent_statement_vote_truncate
  ON bhashan.statement_votes;

-- statement-breakpoint
CREATE TRIGGER prevent_statement_vote_truncate
BEFORE TRUNCATE ON bhashan.statement_votes
FOR EACH STATEMENT EXECUTE FUNCTION bhashan.prevent_history_mutation();

-- statement-breakpoint
DROP TRIGGER IF EXISTS prevent_vote_exclusion_mutation
  ON bhashan.statement_vote_exclusions;

-- statement-breakpoint
CREATE TRIGGER prevent_vote_exclusion_mutation
BEFORE UPDATE OR DELETE ON bhashan.statement_vote_exclusions
FOR EACH ROW EXECUTE FUNCTION bhashan.prevent_history_mutation();

-- statement-breakpoint
DROP TRIGGER IF EXISTS prevent_vote_exclusion_truncate
  ON bhashan.statement_vote_exclusions;

-- statement-breakpoint
CREATE TRIGGER prevent_vote_exclusion_truncate
BEFORE TRUNCATE ON bhashan.statement_vote_exclusions
FOR EACH STATEMENT EXECUTE FUNCTION bhashan.prevent_history_mutation();
