import { NextResponse } from "next/server";
import { ApiRateLimitError, enforceApiRateLimit } from "@/lib/api-rate-limit";
import { AuthGuardError, requireVerifiedUser } from "@/lib/auth-guards";
import {
  recordWatchHeartbeat,
  WatchStoreError,
  type WatchHeartbeatInput,
} from "@/lib/watch-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type HeartbeatResponse =
  | { ok: true; session: Awaited<ReturnType<typeof recordWatchHeartbeat>> }
  | { ok: false; error: { code: string; message: string } };

function failure(status: number, code: string, message: string, retryAfter?: number) {
  return NextResponse.json<HeartbeatResponse>(
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireVerifiedUser();
    await enforceApiRateLimit({
      scope: "watch-heartbeat",
      subject: `user:${user.id}`,
      limit: 40,
      windowSeconds: 60,
    });
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return failure(400, "INVALID_JSON", "Send a valid JSON request body.");
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return failure(400, "INVALID_HEARTBEAT", "Playback progress is required.");
    }
    const input = body as Record<string, unknown>;
    const heartbeat: WatchHeartbeatInput = {
      positionSeconds:
        typeof input.positionSeconds === "number" ? input.positionSeconds : Number.NaN,
      playerState:
        input.playerState === "playing" ||
        input.playerState === "paused" ||
        input.playerState === "ended"
          ? input.playerState
          : ("invalid" as WatchHeartbeatInput["playerState"]),
      visible: typeof input.visible === "boolean" ? input.visible : false,
    };
    const session = await recordWatchHeartbeat({
      sessionId: (await params).id,
      userId: user.id,
      heartbeat,
    });
    return NextResponse.json<HeartbeatResponse>(
      { ok: true, session },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof ApiRateLimitError) {
      return failure(error.status, error.code, error.message, error.retryAfterSeconds);
    }
    if (error instanceof AuthGuardError || error instanceof WatchStoreError) {
      return failure(error.status, error.code, error.message);
    }
    console.error("Failed to record statement watch progress", error);
    return failure(500, "INTERNAL_ERROR", "Playback progress could not be recorded.");
  }
}
