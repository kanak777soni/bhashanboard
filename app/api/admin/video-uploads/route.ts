import { NextResponse } from "next/server";
import { ApiRateLimitError, enforceApiRateLimit } from "@/lib/api-rate-limit";
import { AuthConfigurationError } from "@/lib/auth";
import { AuthGuardError } from "@/lib/auth-guards";
import { createR2UploadAuthorization, R2VideoError } from "@/lib/r2";
import { requireAdmin } from "@/lib/require-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UploadStartResponse =
  | {
      ok: true;
      upload: Awaited<ReturnType<typeof createR2UploadAuthorization>>;
    }
  | { ok: false; error: { code: string; message: string } };

function failure(status: number, code: string, message: string, retryAfter?: number) {
  return NextResponse.json<UploadStartResponse>(
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

function objectBody(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export async function POST(request: Request) {
  try {
    const actor = await requireAdmin();
    await enforceApiRateLimit({
      scope: "video-upload-start",
      subject: `user:${actor.id}`,
      limit: 12,
      windowSeconds: 10 * 60,
    });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return failure(400, "INVALID_JSON", "Send a valid JSON request body.");
    }
    const input = objectBody(body);
    const fileName = typeof input?.fileName === "string" ? input.fileName.trim() : "";
    const contentType =
      typeof input?.contentType === "string" ? input.contentType.trim().toLowerCase() : "";
    const bytes = Number(input?.bytes);
    const rightsAttested = input?.rightsAttested === true;
    const upload = await createR2UploadAuthorization({
      actorId: actor.id,
      fileName,
      contentType,
      bytes,
      rightsAttested,
    });
    return NextResponse.json<UploadStartResponse>(
      { ok: true, upload },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof ApiRateLimitError) {
      return failure(error.status, error.code, error.message, error.retryAfterSeconds);
    }
    if (error instanceof AuthConfigurationError) {
      return failure(error.status, "AUTH_NOT_CONFIGURED", "Authentication is not configured.");
    }
    if (error instanceof AuthGuardError || error instanceof R2VideoError) {
      return failure(error.status, error.code, error.message);
    }
    console.error("Failed to authorize R2 video upload", error);
    return failure(500, "INTERNAL_ERROR", "The video upload could not be authorized.");
  }
}
