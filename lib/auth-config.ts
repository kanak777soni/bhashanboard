export interface AuthEnvironment {
  DATABASE_URL?: string;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  NEXT_PUBLIC_SITE_URL?: string;
  NODE_ENV?: string;
}

const SECRET_PLACEHOLDER =
  /replace[-_ ]?with|placeholder|configuration[-_ ]?missing|build[-_ ]?only/i;

export function authSecretIsAcceptable(value: string | undefined): boolean {
  const secret = value?.trim();
  if (!secret || SECRET_PLACEHOLDER.test(secret)) return false;
  if (new TextEncoder().encode(secret).byteLength < 32) return false;
  return !/^(.)\1+$/.test(secret);
}

function isLoopback(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

/** Return an origin-only site URL, or undefined when the value is unsafe. */
export function canonicalSiteOrigin(
  candidate: string | undefined,
  environment: Pick<AuthEnvironment, "NODE_ENV"> = process.env
): string | undefined {
  candidate = candidate?.trim();
  if (!candidate) return undefined;

  try {
    const url = new URL(candidate);
    const secureProtocol =
      url.protocol === "https:" ||
      (url.protocol === "http:" &&
        (environment.NODE_ENV !== "production" || isLoopback(url.hostname)));
    if (
      !secureProtocol ||
      url.username ||
      url.password ||
      (url.pathname !== "/" && url.pathname !== "") ||
      url.search ||
      url.hash
    ) {
      return undefined;
    }
    return url.origin;
  } catch {
    return undefined;
  }
}

/** Return an origin-only URL suitable for auth callbacks, or undefined. */
export function canonicalAuthSiteUrl(
  environment: AuthEnvironment = process.env
): string | undefined {
  return (
    canonicalSiteOrigin(environment.BETTER_AUTH_URL, environment) ??
    canonicalSiteOrigin(environment.NEXT_PUBLIC_SITE_URL, environment)
  );
}

export function authConfigurationIssues(
  environment: AuthEnvironment = process.env
): string[] {
  const issues: string[] = [];
  if (!environment.DATABASE_URL?.trim()) issues.push("DATABASE_URL");
  if (!authSecretIsAcceptable(environment.BETTER_AUTH_SECRET)) {
    issues.push("BETTER_AUTH_SECRET (32+ random bytes)");
  }

  const suppliedPublicUrl = environment.NEXT_PUBLIC_SITE_URL?.trim();
  const suppliedAuthUrl = environment.BETTER_AUTH_URL?.trim();
  const publicOrigin = canonicalSiteOrigin(suppliedPublicUrl, environment);
  const authOrigin = canonicalSiteOrigin(suppliedAuthUrl, environment);

  if (environment.NODE_ENV === "production" && !suppliedPublicUrl) {
    issues.push("NEXT_PUBLIC_SITE_URL");
  } else if (suppliedPublicUrl && !publicOrigin) {
    issues.push("a valid HTTPS NEXT_PUBLIC_SITE_URL");
  }
  if (suppliedAuthUrl && !authOrigin) {
    issues.push("a valid HTTPS BETTER_AUTH_URL");
  }
  if (publicOrigin && authOrigin && publicOrigin !== authOrigin) {
    issues.push("matching BETTER_AUTH_URL and NEXT_PUBLIC_SITE_URL origins");
  }
  return issues;
}

export function resolvedAuthSiteUrl(
  environment: AuthEnvironment = process.env
): string {
  return canonicalAuthSiteUrl(environment) ?? "http://localhost:3000";
}

export function resolvedPublicSiteUrl(
  environment: AuthEnvironment = process.env
): string {
  return (
    canonicalSiteOrigin(environment.NEXT_PUBLIC_SITE_URL, environment) ??
    "https://bhashanboard.example"
  );
}
