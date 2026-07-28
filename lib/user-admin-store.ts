import "server-only";

import { unstable_noStore as noStore } from "next/cache";
import { db } from "./db";

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role: "user" | "admin";
  banned: boolean;
  banReason?: string;
  banExpires?: string;
  newsletterOptIn: boolean;
  anonymizedAt?: string;
  createdAt: string;
  updatedAt: string;
  activeSessions: number;
  validVotes: number;
  qualifiedWatches: number;
  totalCount: number;
}

interface UserRow {
  id: unknown;
  name: unknown;
  email: unknown;
  email_verified: unknown;
  role: unknown;
  banned: unknown;
  ban_reason: unknown;
  ban_expires: unknown;
  newsletter_opt_in: unknown;
  anonymized_at: unknown;
  created_at: unknown;
  updated_at: unknown;
  active_sessions: unknown;
  valid_votes: unknown;
  qualified_watches: unknown;
  total_count: unknown;
}

function bool(value: unknown): boolean {
  return value === true || value === "true";
}

function integer(value: unknown): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function iso(value: unknown, name: string): string {
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid ${name} in the user register.`);
  return date.toISOString();
}

function optionalIso(value: unknown): string | undefined {
  return value == null ? undefined : iso(value, "ban expiry");
}

function mapUser(row: UserRow): ManagedUser {
  const role = String(row.role ?? "user");
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    emailVerified: bool(row.email_verified),
    role: role === "admin" ? "admin" : "user",
    banned: bool(row.banned),
    banReason: row.ban_reason == null ? undefined : String(row.ban_reason),
    banExpires: optionalIso(row.ban_expires),
    newsletterOptIn: bool(row.newsletter_opt_in),
    anonymizedAt:
      row.anonymized_at == null ? undefined : iso(row.anonymized_at, "anonymized date"),
    createdAt: iso(row.created_at, "created date"),
    updatedAt: iso(row.updated_at, "updated date"),
    activeSessions: integer(row.active_sessions),
    validVotes: integer(row.valid_votes),
    qualifiedWatches: integer(row.qualified_watches),
    totalCount: integer(row.total_count),
  };
}

export async function listManagedUsers({
  search = "",
  limit = 50,
  offset = 0,
}: {
  search?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<ManagedUser[]> {
  noStore();
  const safeSearch = search.trim().slice(0, 120);
  const pattern = `%${safeSearch}%`;
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
  const safeOffset = Math.max(Math.trunc(offset), 0);
  const rows = await db()`
    SELECT
      users.id,
      users.name,
      users.email,
      users."emailVerified" AS email_verified,
      users.role,
      users.banned,
      users."banReason" AS ban_reason,
      users."banExpires" AS ban_expires,
      users."newsletterOptIn" AS newsletter_opt_in,
      users."anonymizedAt" AS anonymized_at,
      users."createdAt" AS created_at,
      users."updatedAt" AS updated_at,
      count(*) OVER () AS total_count,
      (
        SELECT count(*)
        FROM public.auth_session sessions
        WHERE sessions."userId" = users.id
          AND sessions."expiresAt" > clock_timestamp()
      ) AS active_sessions,
      (
        SELECT count(*)
        FROM bhashan.statement_votes votes
        LEFT JOIN bhashan.statement_vote_exclusions exclusions
          ON exclusions.vote_id = votes.id
        WHERE votes.user_id = users.id
          AND exclusions.vote_id IS NULL
      ) AS valid_votes,
      (
        SELECT count(*)
        FROM bhashan.statement_watch_receipts receipts
        WHERE receipts.user_id = users.id
      ) AS qualified_watches
    FROM public.auth_user users
    WHERE ${safeSearch === ""}
      OR users.email ILIKE ${pattern}
      OR users.name ILIKE ${pattern}
    ORDER BY users."createdAt" DESC, users.id
    LIMIT ${safeLimit}
    OFFSET ${safeOffset}
  `;
  return (rows as unknown as UserRow[]).map(mapUser);
}

export async function getManagedUser(userId: string): Promise<ManagedUser | undefined> {
  noStore();
  const rows = await db()`
    SELECT
      users.id,
      users.name,
      users.email,
      users."emailVerified" AS email_verified,
      users.role,
      users.banned,
      users."banReason" AS ban_reason,
      users."banExpires" AS ban_expires,
      users."newsletterOptIn" AS newsletter_opt_in,
      users."anonymizedAt" AS anonymized_at,
      users."createdAt" AS created_at,
      users."updatedAt" AS updated_at,
      1 AS total_count,
      (
        SELECT count(*) FROM public.auth_session sessions
        WHERE sessions."userId" = users.id AND sessions."expiresAt" > clock_timestamp()
      ) AS active_sessions,
      (
        SELECT count(*)
        FROM bhashan.statement_votes votes
        LEFT JOIN bhashan.statement_vote_exclusions exclusions ON exclusions.vote_id = votes.id
        WHERE votes.user_id = users.id AND exclusions.vote_id IS NULL
      ) AS valid_votes,
      (
        SELECT count(*) FROM bhashan.statement_watch_receipts receipts
        WHERE receipts.user_id = users.id
      ) AS qualified_watches
    FROM public.auth_user users
    WHERE users.id = ${userId}
    LIMIT 1
  `;
  const row = (rows as unknown as UserRow[])[0];
  return row ? mapUser(row) : undefined;
}
