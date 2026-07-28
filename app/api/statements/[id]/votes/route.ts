import { NextResponse } from "next/server";
import {
  ApiRateLimitError,
  enforceApiRateLimit,
  requestSubject,
} from "@/lib/api-rate-limit";
import {
  AuthGuardError,
  getCurrentUser,
  requireVerifiedUser,
} from "@/lib/auth-guards";
import { isVoteValue } from "@/lib/rating";
import {
  getStatementVoteState,
  submitStatementVote,
  VoteStoreError,
} from "@/lib/vote-store";
import { WatchStoreError } from "@/lib/watch-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SubmitVoteResponse =
  | { ok: true; result: Awaited<ReturnType<typeof submitStatementVote>> }
  | { ok: false; error: { code: string; message: string } };

type GetVoteResponse =
  | { ok: true; state: Awaited<ReturnType<typeof getStatementVoteState>> }
  | { ok: false; error: { code: string; message: string } };

function failure(status: number, code: string, message: string, retryAfter?: number) {
  return NextResponse.json<SubmitVoteResponse>(
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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const [user, resolvedParams] = await Promise.all([getCurrentUser(), params]);
    await enforceApiRateLimit({
      scope: "vote-state",
      subject: user ? `user:${user.id}` : requestSubject(request),
      limit: 60,
      windowSeconds: 60,
    });
    const state = await getStatementVoteState({
      statementId: resolvedParams.id,
      userId: user?.id,
    });
    return NextResponse.json<GetVoteResponse>(
      { ok: true, state },
      {
        headers: {
          "Cache-Control": "private, no-store",
          Vary: "Cookie",
        },
      }
    );
  } catch (error) {
    if (error instanceof ApiRateLimitError) {
      return failure(error.status, error.code, error.message, error.retryAfterSeconds);
    }
    if (error instanceof VoteStoreError) {
      return failure(error.status, error.code, error.message);
    }
    console.error("Failed to read statement vote state", error);
    return failure(500, "INTERNAL_ERROR", "The voting record could not be loaded.");
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireVerifiedUser();
    await enforceApiRateLimit({
      scope: "vote-submit",
      subject: `user:${user.id}`,
      limit: 10,
      windowSeconds: 60,
    });
    const statementId = (await params).id;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return failure(400, "INVALID_JSON", "Send a valid JSON request body.");
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return failure(400, "INVALID_VOTE", "A rating and watch receipt are required.");
    }
    const input = body as Record<string, unknown>;
    if (!isVoteValue(input.value)) {
      return failure(400, "INVALID_VOTE", "Choose one of the five positions on the rating bar.");
    }
    if (typeof input.watchReceiptId !== "string") {
      return failure(400, "INVALID_RECEIPT_ID", "A valid watch receipt is required.");
    }

    const result = await submitStatementVote({
      userId: user.id,
      statementId,
      value: input.value,
      watchReceiptId: input.watchReceiptId,
    });
    return NextResponse.json<SubmitVoteResponse>(
      { ok: true, result },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (
      error instanceof ApiRateLimitError
    ) {
      return failure(error.status, error.code, error.message, error.retryAfterSeconds);
    }
    if (
      error instanceof AuthGuardError ||
      error instanceof WatchStoreError ||
      error instanceof VoteStoreError
    ) {
      return failure(error.status, error.code, error.message);
    }
    console.error("Failed to submit statement vote", error);
    return failure(500, "INTERNAL_ERROR", "The ruling could not be entered into the record.");
  }
}
