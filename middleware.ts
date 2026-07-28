import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Route-level gate for the Committee Room. Server Actions independently call
 * requireAdmin(), so this is the first layer rather than the only layer.
 */
export async function middleware(req: NextRequest) {
  let normalizedPath = req.nextUrl.pathname;
  try {
    // Decode twice so an encoded route segment cannot bypass the generic
    // admin-endpoint closure before the catch-all auth route decodes it.
    normalizedPath = decodeURIComponent(decodeURIComponent(normalizedPath));
  } catch {
    // Better Auth will reject malformed path encoding; retain the raw path.
  }
  normalizedPath = normalizedPath.toLowerCase();

  // Better Auth's admin plugin supplies the role/ban schema and authoritative
  // session checks. Its generic mutation endpoints are intentionally closed:
  // user-management writes must pass through our audited Server Actions, which
  // also protect the final administrator and prevent self-lockout.
  if (
    normalizedPath === "/api/auth/admin" ||
    normalizedPath.startsWith("/api/auth/admin/")
  ) {
    return new NextResponse(null, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  // Core Better Auth endpoints perform their own origin, CSRF, rate-limit and
  // session checks. The remainder of this middleware is only for page routes.
  if (normalizedPath === "/api/auth" || normalizedPath.startsWith("/api/auth/")) {
    return NextResponse.next();
  }

  const returnPath = `${req.nextUrl.pathname}${req.nextUrl.search}`;
  const signInUrl = new URL("/sign-in", req.url);
  signInUrl.searchParams.set("callbackURL", returnPath);

  // Middleware is deliberately only an optimistic redirect. Every protected
  // layout, Server Action and API handler performs a full database-backed
  // session/role check, so a forged cookie never grants data or a mutation.
  if (getSessionCookie(req)) {
    return NextResponse.next();
  }

  if (req.nextUrl.pathname.startsWith("/account")) {
    return NextResponse.redirect(signInUrl);
  }

  // There is deliberately no network-facing bootstrap password. The first
  // verified administrator is promoted once with `npm run admin:promote --
  // email@example.com`; every browser request then uses a normal Better Auth
  // session and receives the full database-backed role check in the layout.
  return NextResponse.redirect(signInUrl);
}

export const config = {
  matcher: ["/admin/:path*", "/account/:path*", "/api/auth/:path*"],
};
