-- Better Auth's tables use explicit, pool-safe names in the default schema.
-- Do not rely on a connection-level search_path: Neon's pooled endpoint
-- intentionally rejects that startup parameter.
CREATE TABLE IF NOT EXISTS public.auth_user (
  id text PRIMARY KEY,
  name text NOT NULL CHECK (btrim(name) <> ''),
  email text NOT NULL UNIQUE CHECK (btrim(email) <> ''),
  "emailVerified" boolean NOT NULL DEFAULT false,
  image text,
  "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  role text NOT NULL DEFAULT 'user',
  banned boolean NOT NULL DEFAULT false,
  "banReason" text,
  "banExpires" timestamptz,
  "newsletterOptIn" boolean NOT NULL DEFAULT false,
  "newsletterOptInAt" timestamptz,
  CHECK (role IN ('user', 'admin')),
  CHECK ("newsletterOptIn" OR "newsletterOptInAt" IS NULL)
);

-- statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS auth_user_email_lower_uidx
  ON public.auth_user (lower(email));

-- statement-breakpoint
CREATE TABLE IF NOT EXISTS public.auth_session (
  id text PRIMARY KEY,
  "expiresAt" timestamptz NOT NULL,
  token text NOT NULL UNIQUE,
  "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz NOT NULL,
  "ipAddress" text,
  "userAgent" text,
  "userId" text NOT NULL REFERENCES public.auth_user(id) ON DELETE CASCADE,
  "impersonatedBy" text
);

-- statement-breakpoint
CREATE INDEX IF NOT EXISTS auth_session_user_id_idx
  ON public.auth_session ("userId");

-- statement-breakpoint
CREATE INDEX IF NOT EXISTS auth_session_expires_at_idx
  ON public.auth_session ("expiresAt");

-- statement-breakpoint
CREATE TABLE IF NOT EXISTS public.auth_account (
  id text PRIMARY KEY,
  "accountId" text NOT NULL,
  "providerId" text NOT NULL,
  "userId" text NOT NULL REFERENCES public.auth_user(id) ON DELETE CASCADE,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  scope text,
  password text,
  "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz NOT NULL,
  UNIQUE ("providerId", "accountId")
);

-- statement-breakpoint
CREATE INDEX IF NOT EXISTS auth_account_user_id_idx
  ON public.auth_account ("userId");

-- statement-breakpoint
CREATE TABLE IF NOT EXISTS public.auth_verification (
  id text PRIMARY KEY,
  identifier text NOT NULL,
  value text NOT NULL,
  "expiresAt" timestamptz NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- statement-breakpoint
CREATE INDEX IF NOT EXISTS auth_verification_identifier_idx
  ON public.auth_verification (identifier);

-- statement-breakpoint
CREATE INDEX IF NOT EXISTS auth_verification_expires_at_idx
  ON public.auth_verification ("expiresAt");
