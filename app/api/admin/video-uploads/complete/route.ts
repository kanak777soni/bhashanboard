import { NextResponse } from "next/server";
import { ApiRateLimitError, enforceApiRateLimit } from "@/lib/api-rate-limit";
import { AuthConfigurationError } from "@/lib/auth";
import { AuthGuardError } from "@/lib/auth-guards";
import { completeR2Upload, R2VideoError } from "@/lib/r2";
import { requireAdmin } from "@/lib/require-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Validation streams and hashes up to 50 MiB, inspects the MP4 structure,
// promotes across buckets, and verifies the immutable destination.
export const maxDuration = 60;

type UploadCompleteResponse =
  | { ok: true; result: Awaited<ReturnType<typeof completeR2Upload>> }
  | { ok: false; error: { code: string; message: string } };

function failure(status: number, code: string, message: string, retryAfter?: number) {
  return NextResponse.json<UploadCompleteResponse>(
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
    const actor = await requireAdmin();
    await enforceApiRateLimit({
      scope: "video-upload-complete",
      subject: `user:${actor.id}`,
      limit: 20,
      windowSeconds: 10 * 60,
    });
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return failure(400, "INVALID_JSON", "Send a valid JSON request body.");
    }
    const uploadToken =
      body && typeof body === "object" && !Array.isArray(body)
        ? (body as Record<string, unknown>).uploadToken
        : undefined;
    if (typeof uploadToken !== "string") {
      return failure(400, "INVALID_UPLOAD_TOKEN", "A video upload token is required.");
    }
    const result = await completeR2Upload({ actorId: actor.id, uploadToken });
    return NextResponse.json<UploadCompleteResponse>(
      { ok: true, result },
      { headers: { "Cache-Control": "no-store" } }
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
    console.error("Failed to complete R2 video upload", error);
    return failure(500, "INTERNAL_ERROR", "The uploaded video could not be verified.");
  }
}
