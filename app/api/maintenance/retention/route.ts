import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runCloudinaryRetention } from "@/lib/cloudinary-retention";
import { runRetention } from "@/lib/retention";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || secret.length < 24 || supplied.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(secret));
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET?.trim()) {
    return NextResponse.json(
      { ok: false, error: "Retention is not configured." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
  if (!authorized(request)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized." },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const deleted = await runRetention();
    const cloudinary = await runCloudinaryRetention();
    if (cloudinary.status === "failed") {
      console.error(
        "Cloudinary retention reported a monitoring-visible failure",
        cloudinary
      );
      return NextResponse.json(
        {
          ok: false,
          error: "Cloudinary retention failed.",
          deleted,
          cloudinary,
        },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }
    return NextResponse.json(
      { ok: true, deleted, cloudinary },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Retention job failed", error);
    return NextResponse.json(
      { ok: false, error: "Retention failed." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
