"use server";

import { revalidatePath } from "next/cache";
import { assertAuthConfigured, auth } from "@/lib/auth";
import { transactionalMailIsReady } from "@/lib/brevo";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";
import { getManagedUser } from "@/lib/user-admin-store";

function value(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function targetId(formData: FormData): string {
  const id = value(formData, "user_id");
  if (!id || id.length > 160) throw new Error("Invalid user identifier.");
  return id;
}

function detailText(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim().slice(0, 240);
}

function changed(result: unknown): boolean {
  return Array.isArray(result) && result.length > 0;
}

function refreshUsers(): void {
  revalidatePath("/admin/users");
  revalidatePath("/admin");
}

function activeBan(user: { banned: boolean; banExpires?: string }): boolean {
  if (!user.banned) return false;
  if (!user.banExpires) return true;
  return new Date(user.banExpires).getTime() > Date.now();
}

function assertManageable(user: { anonymizedAt?: string }): void {
  if (user.anonymizedAt) {
    throw new Error("An anonymized account has no credentials or profile to manage.");
  }
}

export async function setUserRole(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  const id = targetId(formData);
  const role = value(formData, "role");
  if (role !== "user" && role !== "admin") throw new Error("Invalid role.");
  if (actor.id === id && role !== "admin") {
    throw new Error("You cannot remove your own administrator role.");
  }

  const target = await getManagedUser(id);
  if (!target) throw new Error("User not found.");
  assertManageable(target);
  if (target.role === role) return;
  if (role === "admin" && (!target.emailVerified || activeBan(target))) {
    throw new Error("Only a verified, active account can become an administrator.");
  }

  const rows = await db()`
    WITH admin_registry_lock AS MATERIALIZED (
      SELECT pg_advisory_xact_lock(
        hashtextextended('bhashan:registered-admins', 0)
      ) AS acquired
    ), target AS (
      SELECT
        users.id,
        users.role,
        users."emailVerified" AS email_verified,
        users.banned,
        users."banExpires" AS ban_expires
      FROM public.auth_user users
      CROSS JOIN admin_registry_lock
      WHERE users.id = ${id}
      FOR UPDATE OF users
    ), updated AS (
      UPDATE public.auth_user users
      SET role = ${role}, "updatedAt" = clock_timestamp()
      FROM target
      WHERE users.id = target.id
        AND (
          ${role} <> 'admin'
          OR (
            target.email_verified = true
            AND (
              target.banned = false
              OR (target.ban_expires IS NOT NULL AND target.ban_expires <= clock_timestamp())
            )
          )
        )
        AND (
          ${role} = 'admin'
          OR target.role <> 'admin'
          OR EXISTS (
            SELECT 1
            FROM public.auth_user other
            WHERE other.id <> target.id
              AND other.role = 'admin'
              AND (
                other.banned = false
                OR (other."banExpires" IS NOT NULL AND other."banExpires" <= clock_timestamp())
              )
          )
        )
      RETURNING users.*
    ), logged AS (
      INSERT INTO bhashan.audit_events (
        table_schema, table_name, target_id, operation, actor, action, detail, after_row
      )
      SELECT
        'public', 'auth_user', id, 'UPDATE', ${actor.label}, 'user-role',
        ${`Changed a registered account from ${target.role} to ${role}.`},
        jsonb_build_object('id', updated.id, 'role', updated.role)
      FROM updated
    )
    SELECT id FROM updated
  `;
  if (!changed(rows)) {
    if (role === "admin") {
      throw new Error("Only a verified, active account can become an administrator.");
    }
    throw new Error("The final active administrator cannot be demoted.");
  }
  refreshUsers();
}

export async function banUser(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  const id = targetId(formData);
  if (actor.id === id) throw new Error("You cannot ban your own account.");

  const target = await getManagedUser(id);
  if (!target) throw new Error("User not found.");
  assertManageable(target);
  const reason = detailText(value(formData, "reason"));
  if (!reason) throw new Error("A ban reason is required.");
  const rawDays = value(formData, "days");
  const days = rawDays ? Number(rawDays) : undefined;
  if (days !== undefined && (!Number.isInteger(days) || days < 1 || days > 365)) {
    throw new Error("Ban duration must be between 1 and 365 days.");
  }
  const expires = days ? new Date(Date.now() + days * 86_400_000).toISOString() : null;

  const rows = await db()`
    WITH admin_registry_lock AS MATERIALIZED (
      SELECT pg_advisory_xact_lock(
        hashtextextended('bhashan:registered-admins', 0)
      ) AS acquired
    ), target AS (
      SELECT users.id, users.role
      FROM public.auth_user users
      CROSS JOIN admin_registry_lock
      WHERE users.id = ${id}
      FOR UPDATE OF users
    ), updated AS (
      UPDATE public.auth_user users
      SET
        banned = true,
        "banReason" = ${reason},
        "banExpires" = ${expires}::timestamptz,
        "updatedAt" = clock_timestamp()
      FROM target
      WHERE users.id = target.id
        AND (
          target.role <> 'admin'
          OR EXISTS (
            SELECT 1
            FROM public.auth_user other
            WHERE other.id <> target.id
              AND other.role = 'admin'
              AND (
                other.banned = false
                OR (other."banExpires" IS NOT NULL AND other."banExpires" <= clock_timestamp())
              )
          )
        )
      RETURNING users.*
    ), revoked AS (
      DELETE FROM public.auth_session sessions
      USING updated
      WHERE sessions."userId" = updated.id
      RETURNING sessions.id
    ), logged AS (
      INSERT INTO bhashan.audit_events (
        table_schema, table_name, target_id, operation, actor, action, detail, after_row
      )
      SELECT
        'public', 'auth_user', id, 'UPDATE', ${actor.label}, 'user-ban',
        ${`Banned a registered account. Reason: ${reason}`},
        jsonb_build_object(
          'id', updated.id,
          'banned', updated.banned,
          'banExpires', updated."banExpires"
        )
      FROM updated
    )
    SELECT id FROM updated
  `;
  if (!changed(rows)) throw new Error("The final active administrator cannot be banned.");
  refreshUsers();
}

export async function unbanUser(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  const id = targetId(formData);
  const target = await getManagedUser(id);
  if (!target) throw new Error("User not found.");
  assertManageable(target);

  await db()`
    WITH updated AS (
      UPDATE public.auth_user
      SET banned = false, "banReason" = NULL, "banExpires" = NULL, "updatedAt" = clock_timestamp()
      WHERE id = ${id}
      RETURNING *
    )
    INSERT INTO bhashan.audit_events (
      table_schema, table_name, target_id, operation, actor, action, detail, after_row
    )
    SELECT
      'public', 'auth_user', id, 'UPDATE', ${actor.label}, 'user-unban',
      'Restored access for a registered account.',
      jsonb_build_object('id', updated.id, 'banned', updated.banned)
    FROM updated
  `;
  refreshUsers();
}

export async function revokeUserSessions(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  const id = targetId(formData);
  if (actor.id === id) {
    throw new Error("You cannot revoke your own sessions from the administrator register.");
  }
  const target = await getManagedUser(id);
  if (!target) throw new Error("User not found.");
  assertManageable(target);

  await db()`
    WITH revoked AS (
      DELETE FROM public.auth_session
      WHERE "userId" = ${id}
      RETURNING id
    )
    INSERT INTO bhashan.audit_events (
      table_schema, table_name, target_id, operation, actor, action, detail
    ) VALUES (
      'public', 'auth_session', ${id}, 'DELETE', ${actor.label}, 'revoke-sessions',
      'Revoked all sessions for a registered account.'
    )
  `;
  refreshUsers();
}

export async function resendUserVerification(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  const id = targetId(formData);
  const target = await getManagedUser(id);
  if (!target) throw new Error("User not found.");
  assertManageable(target);
  if (target.emailVerified) return;

  assertAuthConfigured();
  if (!transactionalMailIsReady()) {
    throw new Error("Transactional email is not configured.");
  }
  await auth.api.sendVerificationEmail({
    body: { email: target.email, callbackURL: "/account" },
  });
  await db()`
    INSERT INTO bhashan.audit_events (
      table_schema, table_name, target_id, operation, actor, action, detail
    ) VALUES (
      'public', 'auth_verification', ${id}, 'INSERT', ${actor.label},
      'resend-verification', 'Resent verification for a registered account.'
    )
  `;
  refreshUsers();
}
