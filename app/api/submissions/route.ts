import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import {
  ApiRateLimitError,
  enforceApiRateLimit,
  requestSubject,
} from "@/lib/api-rate-limit";
import {
  sendSubmissionAcknowledgement,
  transactionalMailIsReady,
} from "@/lib/brevo";
import {
  createPublicSubmission,
  setSubmissionAcknowledgement,
} from "@/lib/submission-store";
import {
  SubmissionValidationError,
  validatePublicSubmission,
} from "@/lib/submission-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = (
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    ""
  )
    .split(",")[0]
    ?.trim()
    .toLowerCase();
  if (!origin || !host) return false;
  try {
    return new URL(origin).host.toLowerCase() === host;
  } catch {
    return false;
  }
}

function reference(id: string): string {
  return `SUB-${id.replaceAll("-", "").slice(0, 12).toUpperCase()}`;
}

export async function POST(request: Request): Promise<NextResponse> {
  const noStore = { "Cache-Control": "no-store" };
  if (!sameOrigin(request)) {
    return NextResponse.json(
      { ok: false, message: "Submit this form from the Board." },
      { status: 403, headers: noStore }
    );
  }
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  ) {
    return NextResponse.json(
      { ok: false, message: "Unsupported submission format." },
      { status: 415, headers: noStore }
    );
  }
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (
    !Number.isFinite(contentLength) ||
    contentLength < 0 ||
    contentLength > 16_384
  ) {
    return NextResponse.json(
      { ok: false, message: "The submission is too large." },
      { status: 413, headers: noStore }
    );
  }

  let body: Record<string, unknown>;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 16_384) {
      return NextResponse.json(
        { ok: false, message: "The submission is too large." },
        { status: 413, headers: noStore }
      );
    }
    const parsed = JSON.parse(rawBody) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Invalid JSON object.");
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, message: "The form data could not be read." },
      { status: 400, headers: noStore }
    );
  }

  // A filled honeypot looks successful to a bot, but creates no record.
  if (typeof body.website === "string" && body.website.trim()) {
    return NextResponse.json(
      { ok: true, reference: "SUB-RECEIVED" },
      { status: 202, headers: noStore }
    );
  }

  try {
    const input = validatePublicSubmission(body);
    await Promise.all([
      enforceApiRateLimit({
        scope: "submission-ip",
        subject: requestSubject(request),
        limit: 5,
        windowSeconds: 60 * 60,
      }),
      enforceApiRateLimit({
        scope: "submission-email",
        subject: `email:${createHash("sha256")
          .update(input.contactEmail)
          .digest("hex")}`,
        limit: 3,
        windowSeconds: 24 * 60 * 60,
      }),
    ]);

    const created = await createPublicSubmission(input);
    const publicReference = reference(created.id);
    try {
      if (!transactionalMailIsReady()) {
        await setSubmissionAcknowledgement(created.id, "not_configured");
      } else {
        await sendSubmissionAcknowledgement({
          email: input.contactEmail,
          name: input.submitterName,
          reference: publicReference,
          siteUrl:
            process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "") ||
            new URL(request.url).origin,
        });
        await setSubmissionAcknowledgement(created.id, "sent");
      }
    } catch {
      // Mail and its receipt marker are best-effort. Once evidence is safely
      // queued, a provider outage must not invite a duplicate resubmission.
      try {
        await setSubmissionAcknowledgement(created.id, "failed");
      } catch {
        // The initial pending marker still accurately signals unfinished mail.
      }
    }

    return NextResponse.json(
      { ok: true, reference: publicReference },
      { status: 201, headers: noStore }
    );
  } catch (error) {
    if (error instanceof SubmissionValidationError) {
      return NextResponse.json(
        { ok: false, message: error.message, field: error.field },
        { status: 400, headers: noStore }
      );
    }
    if (error instanceof ApiRateLimitError) {
      return NextResponse.json(
        {
          ok: false,
          message: "Too many submissions. Please wait before trying again.",
        },
        {
          status: 429,
          headers: {
            ...noStore,
            "Retry-After": String(error.retryAfterSeconds),
          },
        }
      );
    }
    console.error(
      "Public submission failed:",
      error instanceof Error ? error.name : "UnknownError"
    );
    return NextResponse.json(
      {
        ok: false,
        message:
          "The evidence could not be queued right now. Please try again shortly.",
      },
      { status: 503, headers: noStore }
    );
  }
}
