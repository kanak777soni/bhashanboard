"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";
import { getManagedUser } from "@/lib/user-admin-store";
import { excludeStatementVote } from "@/lib/vote-store";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function value(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function targetUserId(formData: FormData): string {
  const id = value(formData, "user_id");
  if (!id || id.length > 160) throw new Error("Invalid user identifier.");
  return id;
}

function voteId(formData: FormData): string {
  const id = value(formData, "vote_id");
  if (!UUID_PATTERN.test(id)) throw new Error("Invalid vote identifier.");
  return id;
}

export async function excludeUserVote(formData: FormData): Promise<void> {
  const actor = await requireAdmin();

  const userId = targetUserId(formData);
  const id = voteId(formData);
  const reason = value(formData, "reason");
  if (!reason) throw new Error("An exclusion reason is required.");
  if (reason.length > 500) {
    throw new Error("An exclusion reason cannot exceed 500 characters.");
  }

  const target = await getManagedUser(userId);
  if (!target) throw new Error("User not found.");
  const ownershipRows = await db()`
    SELECT id
    FROM bhashan.statement_votes
    WHERE id = ${id}::uuid
      AND user_id = ${userId}
    LIMIT 1
  `;
  if (!Array.isArray(ownershipRows) || ownershipRows.length === 0) {
    throw new Error("That vote does not belong to this account.");
  }

  await excludeStatementVote({
    voteId: id,
    actorUserId: actor.id,
    actorLabel: actor.label,
    reason,
  });

  revalidatePath("/");
  revalidatePath("/duel");
  revalidatePath("/hall");
  revalidatePath("/account/votes");
  revalidatePath("/statement/[slug]", "page");
  revalidatePath("/compare/[pair]", "page");
  revalidatePath("/admin");
  revalidatePath("/admin/audit");
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${encodeURIComponent(userId)}`);
}
