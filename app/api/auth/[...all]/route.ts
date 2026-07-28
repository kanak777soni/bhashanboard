import { toNextJsHandler } from "better-auth/next-js";
import {
  auth,
  authConfigurationIssues,
  transactionalMailIsReady,
} from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const handlers = toNextJsHandler(auth);
const MAIL_DEPENDENT_PATHS = new Set([
  "/api/auth/sign-up/email",
  "/api/auth/request-password-reset",
  "/api/auth/send-verification-email",
]);

function normalizedPath(request: Request): string {
  let pathname = new URL(request.url).pathname;
  try {
    pathname = decodeURIComponent(decodeURIComponent(pathname));
  } catch {
    // Leave malformed encoding to the auth router after the exact-path check.
  }
  return pathname.replace(/\/+$/, "").toLowerCase();
}

function configured(
  handler: (request: Request) => Promise<Response>
): (request: Request) => Promise<Response> {
  return async (request) => {
    const missing = authConfigurationIssues();
    if (missing.length) {
      return Response.json(
        {
          code: "AUTH_NOT_CONFIGURED",
          message: "Authentication is temporarily unavailable.",
        },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }
    if (MAIL_DEPENDENT_PATHS.has(normalizedPath(request)) && !transactionalMailIsReady()) {
      return Response.json(
        {
          code: "TRANSACTIONAL_MAIL_NOT_CONFIGURED",
          message: "Email-dependent account actions are temporarily unavailable.",
        },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }
    return handler(request);
  };
}

export const GET = configured(handlers.GET);
export const POST = configured(handlers.POST);
export const PATCH = configured(handlers.PATCH);
export const PUT = configured(handlers.PUT);
export const DELETE = configured(handlers.DELETE);
