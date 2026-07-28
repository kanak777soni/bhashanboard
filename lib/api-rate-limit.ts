import "server-only";

import { createHash } from "node:crypto";
import { db } from "./db";

interface RateLimitRow {
  count: unknown;
  last_request: unknown;
}

export class ApiRateLimitError extends Error {
  readonly code = "RATE_LIMITED";
  readonly status = 429;

  constructor(readonly retryAfterSeconds: number) {
    super("Too many requests. Wait a moment and try again.");
    this.name = "ApiRateLimitError";
  }
}

export function requestSubject(request: Request): string {
  const forwarded =
    request.headers.get("x-vercel-forwarded-for") ||
    request.headers.get("x-forwarded-for") ||
    "unknown";
  const address = forwarded.split(",")[0]?.trim() || "unknown";
  // Store neither a raw IP nor an email/user-facing identifier in the shared
  // limiter. This digest is only a stable bucket key.
  return `ip:${createHash("sha256").update(address).digest("hex")}`;
}

export async function enforceApiRateLimit({
  scope,
  subject,
  limit,
  windowSeconds,
}: {
  scope: string;
  subject: string;
  limit: number;
  windowSeconds: number;
}): Promise<void> {
  if (!/^[a-z0-9-]{1,48}$/.test(scope)) throw new Error("Invalid rate-limit scope.");
  if (!subject || subject.length > 256) throw new Error("Invalid rate-limit subject.");
  if (!Number.isSafeInteger(limit) || limit < 1) throw new Error("Invalid rate limit.");
  if (!Number.isSafeInteger(windowSeconds) || windowSeconds < 1) {
    throw new Error("Invalid rate-limit window.");
  }

  const key = `bhashan-api:${scope}:${subject}`;
  const id = createHash("sha256").update(key).digest("hex");
  const now = Date.now();
  const windowMilliseconds = windowSeconds * 1000;
  const resetBefore = now - windowMilliseconds;
  const rows = await db()`
    INSERT INTO public.auth_rate_limit (id, key, count, last_request)
    VALUES (${id}, ${key}, 1, ${now})
    ON CONFLICT (key) DO UPDATE SET
      count = CASE
        WHEN public.auth_rate_limit.last_request <= ${resetBefore} THEN 1
        ELSE least(public.auth_rate_limit.count + 1, ${limit + 1})
      END,
      last_request = CASE
        WHEN public.auth_rate_limit.last_request <= ${resetBefore} THEN ${now}
        ELSE public.auth_rate_limit.last_request
      END
    RETURNING count, last_request
  `;
  const row = (rows as unknown as RateLimitRow[])[0];
  const count = Number(row?.count);
  const windowStartedAt = Number(row?.last_request);
  if (!Number.isSafeInteger(count) || !Number.isSafeInteger(windowStartedAt)) {
    throw new Error("The shared rate limiter returned invalid state.");
  }
  if (count > limit) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((windowStartedAt + windowMilliseconds - now) / 1000)
    );
    throw new ApiRateLimitError(retryAfterSeconds);
  }
}
