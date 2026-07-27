CREATE SCHEMA IF NOT EXISTS bhashan;

-- statement-breakpoint
CREATE TABLE IF NOT EXISTS bhashan.schema_migrations (
  name text PRIMARY KEY,
  checksum text NOT NULL CHECK (checksum ~ '^[0-9a-f]{64}$'),
  applied_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

-- statement-breakpoint
CREATE SEQUENCE IF NOT EXISTS bhashan.statement_number_seq
  AS bigint
  START WITH 1
  INCREMENT BY 1;

-- statement-breakpoint
CREATE TABLE IF NOT EXISTS bhashan.corpus_imports (
  id text PRIMARY KEY,
  manifest_sha256 text NOT NULL UNIQUE CHECK (manifest_sha256 ~ '^[0-9a-f]{64}$'),
  corpus text NOT NULL,
  corpus_version text NOT NULL,
  compiled_on date,
  source_commit text,
  source_dirty boolean NOT NULL DEFAULT false,
  document jsonb NOT NULL CHECK (jsonb_typeof(document) = 'object'),
  source_hash text NOT NULL CHECK (source_hash ~ '^[0-9a-f]{64}$'),
  managed_by text NOT NULL DEFAULT 'json_seed',
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  completed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

-- statement-breakpoint
CREATE TABLE IF NOT EXISTS bhashan.corpus_artifacts (
  id text PRIMARY KEY,
  import_id text NOT NULL REFERENCES bhashan.corpus_imports(id)
    DEFERRABLE INITIALLY DEFERRED,
  path text NOT NULL,
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  wrapper jsonb NOT NULL CHECK (jsonb_typeof(wrapper) = 'object'),
  document jsonb NOT NULL,
  source_text text NOT NULL,
  source_hash text NOT NULL CHECK (source_hash ~ '^[0-9a-f]{64}$'),
  managed_by text NOT NULL DEFAULT 'json_seed',
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (import_id, path),
  CHECK (document = source_text::jsonb)
);

-- statement-breakpoint
CREATE TABLE IF NOT EXISTS bhashan.parties (
  id text PRIMARY KEY,
  document jsonb NOT NULL CHECK (jsonb_typeof(document) = 'object'),
  name text GENERATED ALWAYS AS (document ->> 'name') STORED,
  scope text GENERATED ALWAYS AS (document ->> 'scope') STORED,
  ink text GENERATED ALWAYS AS (document ->> 'ink') STORED,
  import_id text REFERENCES bhashan.corpus_imports(id) DEFERRABLE INITIALLY DEFERRED,
  source_hash text CHECK (source_hash IS NULL OR source_hash ~ '^[0-9a-f]{64}$'),
  managed_by text NOT NULL DEFAULT 'admin' CHECK (managed_by IN ('admin', 'json_seed')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (document ->> 'id' = id),
  CHECK (
    (managed_by = 'json_seed' AND import_id IS NOT NULL AND source_hash IS NOT NULL)
    OR (managed_by = 'admin' AND import_id IS NULL AND source_hash IS NULL)
  )
);

-- statement-breakpoint
CREATE TABLE IF NOT EXISTS bhashan.politicians (
  id text PRIMARY KEY,
  document jsonb NOT NULL CHECK (jsonb_typeof(document) = 'object'),
  name text GENERATED ALWAYS AS (document ->> 'name') STORED,
  party_id text GENERATED ALWAYS AS (document ->> 'party') STORED,
  state text GENERATED ALWAYS AS (document ->> 'state') STORED,
  import_id text REFERENCES bhashan.corpus_imports(id) DEFERRABLE INITIALLY DEFERRED,
  source_hash text CHECK (source_hash IS NULL OR source_hash ~ '^[0-9a-f]{64}$'),
  managed_by text NOT NULL DEFAULT 'admin' CHECK (managed_by IN ('admin', 'json_seed')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (document ->> 'id' = id),
  CHECK (
    (managed_by = 'json_seed' AND import_id IS NOT NULL AND source_hash IS NOT NULL)
    OR (managed_by = 'admin' AND import_id IS NULL AND source_hash IS NULL)
  ),
  FOREIGN KEY (party_id) REFERENCES bhashan.parties(id) DEFERRABLE INITIALLY DEFERRED
);

-- statement-breakpoint
CREATE TABLE IF NOT EXISTS bhashan.statements (
  id text PRIMARY KEY,
  statement_number bigint GENERATED ALWAYS AS (
    substring(id from '^IN-([0-9]+)$')::bigint
  ) STORED,
  document jsonb NOT NULL CHECK (jsonb_typeof(document) = 'object'),
  speaker_id text GENERATED ALWAYS AS (document ->> 'speaker_id') STORED,
  party_at_time_id text GENERATED ALWAYS AS (document ->> 'party_at_time') STORED,
  status text GENERATED ALWAYS AS (document ->> 'status') STORED,
  language text GENERATED ALWAYS AS (document ->> 'language') STORED,
  import_id text REFERENCES bhashan.corpus_imports(id) DEFERRABLE INITIALLY DEFERRED,
  source_hash text CHECK (source_hash IS NULL OR source_hash ~ '^[0-9a-f]{64}$'),
  managed_by text NOT NULL DEFAULT 'admin' CHECK (managed_by IN ('admin', 'json_seed')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (statement_number),
  CHECK (id ~ '^IN-[0-9]{4,}$'),
  CHECK (
    id = 'IN-' || lpad(
      statement_number::text,
      greatest(4, length(statement_number::text)),
      '0'
    )
  ),
  CHECK (document ->> 'id' = id),
  CHECK (
    (managed_by = 'json_seed' AND import_id IS NOT NULL AND source_hash IS NOT NULL)
    OR (managed_by = 'admin' AND import_id IS NULL AND source_hash IS NULL)
  ),
  CHECK (status IN ('published', 'held_parity', 'held_review', 'withdrawn')),
  FOREIGN KEY (speaker_id) REFERENCES bhashan.politicians(id) DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (party_at_time_id) REFERENCES bhashan.parties(id) DEFERRABLE INITIALLY DEFERRED
);

-- statement-breakpoint
CREATE TABLE IF NOT EXISTS bhashan.rejections (
  id text PRIMARY KEY,
  position integer NOT NULL CHECK (position >= 0),
  document jsonb NOT NULL CHECK (jsonb_typeof(document) = 'object'),
  rule_code text GENERATED ALWAYS AS (document ->> 'rule') STORED,
  import_id text REFERENCES bhashan.corpus_imports(id) DEFERRABLE INITIALLY DEFERRED,
  source_hash text CHECK (source_hash IS NULL OR source_hash ~ '^[0-9a-f]{64}$'),
  managed_by text NOT NULL DEFAULT 'admin' CHECK (managed_by IN ('admin', 'json_seed')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (
    (managed_by = 'json_seed' AND import_id IS NOT NULL AND source_hash IS NOT NULL)
    OR (managed_by = 'admin' AND import_id IS NULL AND source_hash IS NULL)
  )
);

-- statement-breakpoint
CREATE TABLE IF NOT EXISTS bhashan.settings (
  key text PRIMARY KEY,
  document jsonb NOT NULL,
  import_id text REFERENCES bhashan.corpus_imports(id) DEFERRABLE INITIALLY DEFERRED,
  source_hash text CHECK (source_hash IS NULL OR source_hash ~ '^[0-9a-f]{64}$'),
  managed_by text NOT NULL DEFAULT 'admin' CHECK (managed_by IN ('admin', 'json_seed')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (
    (managed_by = 'json_seed' AND import_id IS NOT NULL AND source_hash IS NOT NULL)
    OR (managed_by = 'admin' AND import_id IS NULL AND source_hash IS NULL)
  )
);

-- statement-breakpoint
CREATE TABLE IF NOT EXISTS bhashan.audit_events (
  event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_key text UNIQUE,
  table_schema text NOT NULL,
  table_name text NOT NULL,
  target_id text,
  operation text NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE', 'IMPORT')),
  actor text NOT NULL CHECK (btrim(actor) <> ''),
  action text NOT NULL CHECK (btrim(action) <> ''),
  detail text NOT NULL CHECK (btrim(detail) <> ''),
  before_row jsonb,
  after_row jsonb,
  transaction_id bigint NOT NULL DEFAULT txid_current(),
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

-- statement-breakpoint
CREATE OR REPLACE FUNCTION bhashan.prepare_document_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, bhashan
AS $prepare$
DECLARE
  old_key text;
  new_key text;
  stamped_at timestamptz := clock_timestamp();
  action_value text := nullif(btrim(current_setting('bhashan.action', true)), '');
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.version := 1;
    NEW.created_at := coalesce(NEW.created_at, stamped_at);
    NEW.updated_at := NEW.created_at;
    RETURN NEW;
  END IF;

  old_key := coalesce(to_jsonb(OLD) ->> 'id', to_jsonb(OLD) ->> 'key');
  new_key := coalesce(to_jsonb(NEW) ->> 'id', to_jsonb(NEW) ->> 'key');
  IF new_key IS DISTINCT FROM old_key THEN
    RAISE EXCEPTION '% primary key is immutable (% -> %)', TG_TABLE_NAME, old_key, new_key;
  END IF;

  NEW.version := OLD.version + 1;
  NEW.created_at := OLD.created_at;
  NEW.updated_at := stamped_at;

  -- An application edit claims a seeded row. Later imports will refuse to
  -- overwrite it until the local and live versions are reconciled explicitly.
  IF OLD.managed_by = 'json_seed' AND action_value IS DISTINCT FROM 'seed' THEN
    NEW.managed_by := 'admin';
    NEW.import_id := NULL;
    NEW.source_hash := NULL;
  END IF;

  RETURN NEW;
END;
$prepare$;

-- statement-breakpoint
REVOKE ALL ON FUNCTION bhashan.prepare_document_mutation() FROM PUBLIC;

-- statement-breakpoint
CREATE OR REPLACE FUNCTION bhashan.audit_document_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, bhashan
AS $audit$
DECLARE
  actor_value text := nullif(current_setting('bhashan.actor', true), '');
  action_value text := nullif(current_setting('bhashan.action', true), '');
  detail_value text := nullif(current_setting('bhashan.detail', true), '');
  old_json jsonb;
  new_json jsonb;
  target_id text;
BEGIN
  IF actor_value IS NULL OR action_value IS NULL OR detail_value IS NULL THEN
    RAISE EXCEPTION
      'Audited writes require transaction-local bhashan.actor, bhashan.action, and bhashan.detail';
  END IF;

  IF TG_OP = 'INSERT' THEN
    new_json := to_jsonb(NEW);
    target_id := coalesce(new_json ->> 'id', new_json ->> 'key');
  ELSIF TG_OP = 'UPDATE' THEN
    old_json := to_jsonb(OLD);
    new_json := to_jsonb(NEW);
    target_id := coalesce(
      new_json ->> 'id',
      new_json ->> 'key',
      old_json ->> 'id',
      old_json ->> 'key'
    );
  ELSE
    old_json := to_jsonb(OLD);
    target_id := coalesce(old_json ->> 'id', old_json ->> 'key');
  END IF;

  INSERT INTO bhashan.audit_events (
    table_schema,
    table_name,
    target_id,
    operation,
    actor,
    action,
    detail,
    before_row,
    after_row
  ) VALUES (
    TG_TABLE_SCHEMA,
    TG_TABLE_NAME,
    target_id,
    TG_OP,
    actor_value,
    action_value,
    detail_value,
    old_json,
    new_json
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$audit$;

-- statement-breakpoint
REVOKE ALL ON FUNCTION bhashan.audit_document_change() FROM PUBLIC;

-- statement-breakpoint
CREATE OR REPLACE FUNCTION bhashan.prevent_history_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $immutable$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME;
END;
$immutable$;

-- statement-breakpoint
DO $install_audit_triggers$
DECLARE
  table_name_value text;
BEGIN
  FOREACH table_name_value IN ARRAY ARRAY[
    'parties',
    'politicians',
    'statements',
    'rejections',
    'settings'
  ]
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS prepare_document_mutation ON bhashan.%I',
      table_name_value
    );
    EXECUTE format(
      'CREATE TRIGGER prepare_document_mutation BEFORE INSERT OR UPDATE ON bhashan.%I FOR EACH ROW EXECUTE FUNCTION bhashan.prepare_document_mutation()',
      table_name_value
    );
    EXECUTE format(
      'DROP TRIGGER IF EXISTS audit_document_change ON bhashan.%I',
      table_name_value
    );
    EXECUTE format(
      'CREATE TRIGGER audit_document_change AFTER INSERT OR UPDATE OR DELETE ON bhashan.%I FOR EACH ROW EXECUTE FUNCTION bhashan.audit_document_change()',
      table_name_value
    );
  END LOOP;
END;
$install_audit_triggers$;

-- statement-breakpoint
DROP TRIGGER IF EXISTS prevent_audit_event_mutation ON bhashan.audit_events;

-- statement-breakpoint
CREATE TRIGGER prevent_audit_event_mutation
BEFORE UPDATE OR DELETE ON bhashan.audit_events
FOR EACH ROW EXECUTE FUNCTION bhashan.prevent_history_mutation();

-- statement-breakpoint
DROP TRIGGER IF EXISTS prevent_audit_event_truncate ON bhashan.audit_events;

-- statement-breakpoint
CREATE TRIGGER prevent_audit_event_truncate
BEFORE TRUNCATE ON bhashan.audit_events
FOR EACH STATEMENT EXECUTE FUNCTION bhashan.prevent_history_mutation();

-- statement-breakpoint
DO $install_import_history_triggers$
DECLARE
  table_name_value text;
BEGIN
  FOREACH table_name_value IN ARRAY ARRAY['corpus_imports', 'corpus_artifacts']
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS prevent_history_mutation ON bhashan.%I',
      table_name_value
    );
    EXECUTE format(
      'CREATE TRIGGER prevent_history_mutation BEFORE UPDATE OR DELETE ON bhashan.%I FOR EACH ROW EXECUTE FUNCTION bhashan.prevent_history_mutation()',
      table_name_value
    );
    EXECUTE format(
      'DROP TRIGGER IF EXISTS prevent_history_truncate ON bhashan.%I',
      table_name_value
    );
    EXECUTE format(
      'CREATE TRIGGER prevent_history_truncate BEFORE TRUNCATE ON bhashan.%I FOR EACH STATEMENT EXECUTE FUNCTION bhashan.prevent_history_mutation()',
      table_name_value
    );
  END LOOP;
END;
$install_import_history_triggers$;

-- statement-breakpoint
CREATE INDEX IF NOT EXISTS politicians_party_id_idx
  ON bhashan.politicians(party_id);

-- statement-breakpoint
CREATE INDEX IF NOT EXISTS statements_speaker_id_idx
  ON bhashan.statements(speaker_id);

-- statement-breakpoint
CREATE INDEX IF NOT EXISTS statements_party_at_time_id_idx
  ON bhashan.statements(party_at_time_id);

-- statement-breakpoint
CREATE INDEX IF NOT EXISTS statements_status_idx
  ON bhashan.statements(status);

-- statement-breakpoint
CREATE INDEX IF NOT EXISTS audit_events_target_idx
  ON bhashan.audit_events(table_name, target_id, occurred_at DESC);
