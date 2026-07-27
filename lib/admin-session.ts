export const ADMIN_SESSION_COOKIE = "bb-admin";

export type AdminAuthConfig =
  | { mode: "password"; password: string }
  | { mode: "insecure-local" }
  | { mode: "misconfigured" };

/**
 * Production is always fail-closed. Local passwordless access must be an
 * explicit choice so a missing environment variable cannot publish a writable
 * admin by accident.
 */
export function adminAuthConfig(): AdminAuthConfig {
  const password = process.env.ADMIN_PASSWORD;
  if (typeof password === "string" && password.length > 0) {
    return { mode: "password", password };
  }
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.ALLOW_INSECURE_ADMIN === "true"
  ) {
    return { mode: "insecure-local" };
  }
  return { mode: "misconfigured" };
}

function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** A password rotation invalidates every existing session cookie. */
export async function adminSessionToken(password: string): Promise<string> {
  const material = new TextEncoder().encode(`bhashan-admin-session:v1:${password}`);
  return hex(await crypto.subtle.digest("SHA-256", material));
}

/**
 * Avoid early-return comparison. Web Crypto has no portable timing-safe string
 * helper shared by Edge and Node runtimes, so compare the fixed-length digest
 * without exposing which byte differed.
 */
export function safeTokenEqual(left: string | undefined, right: string): boolean {
  if (!left || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < right.length; index++) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function decodeBasic(encoded: string): string | undefined {
  try {
    const binary = atob(encoded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return undefined;
  }
}

/** Returns only the password portion; usernames are intentionally ignored. */
export function basicPassword(header: string | null): string | undefined {
  if (!header) return undefined;
  const match = /^Basic\s+([A-Za-z0-9+/=]+)$/i.exec(header.trim());
  if (!match) return undefined;
  const decoded = decodeBasic(match[1]);
  if (decoded === undefined) return undefined;
  const separator = decoded.indexOf(":");
  if (separator < 0) return undefined;
  return decoded.slice(separator + 1);
}

export function safePasswordEqual(left: string | undefined, right: string): boolean {
  if (left === undefined) return false;
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  let difference = leftBytes.length ^ rightBytes.length;
  const length = Math.max(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index++) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return difference === 0;
}
