-- Better Auth database-backed rate limits must be shared by every serverless
-- instance. last_request stores Unix epoch milliseconds and therefore needs
-- bigint rather than a PostgreSQL timestamp or 32-bit integer.
CREATE TABLE IF NOT EXISTS public.auth_rate_limit (
  id text PRIMARY KEY,
  key text NOT NULL UNIQUE,
  count integer NOT NULL CHECK (count >= 0),
  last_request bigint NOT NULL CHECK (last_request >= 0)
);

-- statement-breakpoint
CREATE INDEX IF NOT EXISTS auth_rate_limit_last_request_idx
  ON public.auth_rate_limit (last_request);
