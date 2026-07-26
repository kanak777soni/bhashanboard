import { NextResponse, type NextRequest } from "next/server";

/**
 * Gate on /admin.
 *
 * Set ADMIN_PASSWORD in .env.local to enable it. Without it the dashboard
 * is open, which is fine on your own machine and is why the layout says so
 * loudly — but the moment this is deployed anywhere reachable, the
 * variable has to be set. Real accounts arrive with Supabase auth.
 */
export function middleware(req: NextRequest) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return NextResponse.next();

  if (req.cookies.get("bb-admin")?.value === password) return NextResponse.next();

  const header = req.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    const [, pass] = atob(header.slice(6)).split(":");
    if (pass === password) {
      const res = NextResponse.next();
      res.cookies.set("bb-admin", password, { httpOnly: true, sameSite: "lax", path: "/admin" });
      return res;
    }
  }

  return new NextResponse("The Committee Room is closed.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="The Committee Room", charset="UTF-8"' },
  });
}

export const config = { matcher: ["/admin/:path*"] };
