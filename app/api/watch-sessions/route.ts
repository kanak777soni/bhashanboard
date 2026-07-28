import { NextResponse } from "next/server";
import { ApiRateLimitError, enforceApiRateLimit } from "@/lib/api-rate-limit";
import { AuthGuardError, requireVerifiedUser } from "@/lib/auth-guards";
import { createWatchSession, WatchStoreError } from "@/lib/watch-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StartWatchResponse =
  | { ok: true; session: Awaited<ReturnType<typeof createWatchSession>> }
  | { ok: false; error: { code: string; message: string } };

function failure(status: number, code: string, message: string, retryAfter?: number) {
  return NextResponse.json<StartWatchResponse>(
    { ok: false, error: { code, message } },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        ...(retryAfter ? { "Retry-After": String(retryAfter) } : {}),
      },
    }
  );
}

export async function POST(request: Request) {
  try {
    const user = await requireVerifiedUser();
    await enforceApiRateLimit({
      scope: "watch-start",
      subject: `user:${user.id}`,
      limit: 10,
      windowSeconds: 60,
    });
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return failure(400, "INVALID_JSON", "Send a valid JSON request body.");
    }
    const statementId =
      body && typeof body === "object" && !Array.isArray(body)
        ? (body as Record<string, unknown>).statementId
        : undefined;
    if (typeof statementId !== "string") {
      return failure(400, "INVALID_STATEMENT_ID", "A statement identifier is required.");
    }

    const session = await createWatchSession({ userId: user.id, statementId });
    return NextResponse.json<StartWatchResponse>(
      { ok: true, session },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof ApiRateLimitError) {
      return failure(error.status, error.code, error.message, error.retryAfterSeconds);
    }
    if (error instanceof AuthGuardError || error instanceof WatchStoreError) {
      return failure(error.status, error.code, error.message);
    }
    console.error("Failed to start statement watch session", error);
    return failure(500, "INTERNAL_ERROR", "The watch session could not be started.");
  }
}
