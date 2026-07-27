import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  adminAuthConfig,
  adminSessionToken,
  basicPassword,
  safePasswordEqual,
  safeTokenEqual,
} from "@/lib/admin-session";

/**
 * Route-level gate for the Committee Room. Server Actions independently call
 * requireAdmin(), so this is the first layer rather than the only layer.
 */
export async function middleware(req: NextRequest) {
  const config = adminAuthConfig();

  if (config.mode === "insecure-local") {
    return NextResponse.next();
  }

  if (config.mode === "misconfigured") {
    return new NextResponse("The Committee Room is unavailable: admin authentication is not configured.", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const expectedToken = await adminSessionToken(config.password);
  if (safeTokenEqual(req.cookies.get(ADMIN_SESSION_COOKIE)?.value, expectedToken)) {
    return NextResponse.next();
  }

  const suppliedPassword = basicPassword(req.headers.get("authorization"));
  if (safePasswordEqual(suppliedPassword, config.password)) {
    const response = NextResponse.next();
    response.cookies.set(ADMIN_SESSION_COOKIE, expectedToken, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/admin",
      maxAge: 60 * 60 * 8,
    });
    return response;
  }

  return new NextResponse("The Committee Room is closed.", {
    status: 401,
    headers: {
      "Cache-Control": "no-store",
      "WWW-Authenticate": 'Basic realm="The Committee Room", charset="UTF-8"',
    },
  });
}

export const config = { matcher: ["/admin/:path*"] };
