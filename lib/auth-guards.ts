import "server-only";

import { headers } from "next/headers";
import { assertAuthConfigured, auth } from "./auth";

export type AuthSession = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;
export type AuthUser = AuthSession["user"];

export class AuthGuardError extends Error {
  constructor(
    readonly status: 401 | 403,
    readonly code: "AUTH_REQUIRED" | "EMAIL_NOT_VERIFIED" | "ACCOUNT_BANNED" | "ADMIN_REQUIRED",
    message: string
  ) {
    super(message);
    this.name = "AuthGuardError";
  }
}

export async function getCurrentSession(): Promise<AuthSession | null> {
  assertAuthConfigured();
  return auth.api.getSession({ headers: await headers() });
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  return (await getCurrentSession())?.user ?? null;
}

function banIsActive(user: AuthUser): boolean {
  if (user.banned !== true) return false;
  if (!user.banExpires) return true;
  return new Date(user.banExpires).getTime() > Date.now();
}

export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthGuardError(401, "AUTH_REQUIRED", "Sign in to continue.");
  }
  if (banIsActive(user)) {
    throw new AuthGuardError(403, "ACCOUNT_BANNED", "This account is not permitted to continue.");
  }
  return user;
}

export async function requireVerifiedUser(): Promise<AuthUser> {
  const user = await requireUser();
  if (user.emailVerified !== true) {
    throw new AuthGuardError(403, "EMAIL_NOT_VERIFIED", "Verify your email before voting.");
  }
  return user;
}

export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireVerifiedUser();
  const roles = (user.role ?? "user")
    .split(",")
    .map((role) => role.trim().toLowerCase());
  if (!roles.includes("admin")) {
    throw new AuthGuardError(403, "ADMIN_REQUIRED", "Administrator access is required.");
  }
  return user;
}
