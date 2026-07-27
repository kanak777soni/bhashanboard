import "server-only";
import { cookies, headers } from "next/headers";
import {
  ADMIN_SESSION_COOKIE,
  adminAuthConfig,
  adminSessionToken,
  basicPassword,
  safePasswordEqual,
  safeTokenEqual,
} from "./admin-session";

export interface AdminActor {
  id: string;
  label: string;
}

/**
 * Middleware protects the visible routes; every write action calls this again
 * so possession of a Server Action identifier cannot bypass authorization.
 */
export async function requireAdmin(): Promise<AdminActor> {
  const config = adminAuthConfig();
  if (config.mode === "insecure-local") {
    return { id: "local-insecure", label: "Committee (explicit insecure local admin)" };
  }
  if (config.mode === "misconfigured") {
    throw new Error(
      "Admin authentication is not configured. Set ADMIN_PASSWORD, or explicitly set ALLOW_INSECURE_ADMIN=true outside production."
    );
  }

  const expectedToken = await adminSessionToken(config.password);
  const cookieStore = await cookies();
  if (safeTokenEqual(cookieStore.get(ADMIN_SESSION_COOKIE)?.value, expectedToken)) {
    return { id: "shared-password", label: "Committee (authenticated admin)" };
  }

  const requestHeaders = await headers();
  const suppliedPassword = basicPassword(requestHeaders.get("authorization"));
  if (safePasswordEqual(suppliedPassword, config.password)) {
    return { id: "shared-password", label: "Committee (authenticated admin)" };
  }

  throw new Error("Unauthorized admin action.");
}
