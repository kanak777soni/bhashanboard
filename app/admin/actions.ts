"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  audit,
  getPoliticians,
  getStatements,
  nextStatementId,
  savePoliticians,
  saveStatements,
  type StoredStatement,
} from "@/lib/store";

const ACTOR = "Committee (local admin)";

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}
function num(fd: FormData, key: string): number {
  const n = Number(fd.get(key));
  return Number.isFinite(n) ? n : 0;
}

function refresh() {
  revalidatePath("/", "layout");
}

/** Parse "https://youtu.be/ID", "watch?v=ID" or a bare id. */
function parseVideo(input: string): { platform: string; id: string } | undefined {
  const v = input.trim();
  if (!v) return undefined;
  const m =
    v.match(/(?:youtube\.com\/.*[?&]v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/) ??
    v.match(/^([\w-]{6,})$/);
  return m ? { platform: "youtube", id: m[1] } : undefined;
}

function toSeconds(v: string): number | undefined {
  const s = v.trim();
  if (!s) return undefined;
  if (/^\d+$/.test(s)) return Number(s);
  const parts = s.split(":").map(Number);
  if (parts.some(Number.isNaN)) return undefined;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

function collectAxes(fd: FormData): Record<string, number> {
  return {
    logic_damage: num(fd, "logic_damage"),
    straight_face: num(fd, "straight_face"),
    rewatch_value: num(fd, "rewatch_value"),
    crowd_complicity: num(fd, "crowd_complicity"),
    consequence: num(fd, "consequence"),
  };
}

function collectSources(fd: FormData) {
  const out: { tier: string; publisher: string; title: string; url: string }[] = [];
  for (let i = 0; i < 4; i++) {
    const publisher = str(fd, `src_publisher_${i}`);
    const url = str(fd, `src_url_${i}`);
    if (!publisher && !url) continue;
    out.push({
      tier: str(fd, `src_tier_${i}`) || "C",
      publisher,
      title: str(fd, `src_title_${i}`),
      url,
    });
  }
  return out;
}

// ── create ───────────────────────────────────────────────────────────

export async function createStatement(fd: FormData) {
  const statements = await getStatements();
  const id = await nextStatementId();
  const quote = str(fd, "quote");

  const entry: StoredStatement = {
    id,
    status: (str(fd, "status") || "held_review") as StoredStatement["status"],
    speaker_id: str(fd, "speaker_id"),
    party_at_time: str(fd, "party_at_time"),
    office_at_time: str(fd, "office_at_time"),
    state: str(fd, "state"),
    date: str(fd, "date"),
    date_precision: str(fd, "date_precision") || "day",
    venue: str(fd, "venue"),
    language: str(fd, "language") || "Hindi",
    category: str(fd, "category"),
    neutral_title: str(fd, "neutral_title"),
    // Empty means the wording was never established. It stays null, and the
    // site renders the neutral title unquoted rather than inventing a quote.
    quote: quote || null,
    quote_note: str(fd, "quote_note") || undefined,
    claim: str(fd, "claim"),
    context: str(fd, "context") || undefined,
    counterpoint: str(fd, "counterpoint") || undefined,
    video: parseVideo(str(fd, "video")) && {
      ...parseVideo(str(fd, "video"))!,
      start: toSeconds(str(fd, "video_start")),
      end: toSeconds(str(fd, "video_end")),
    },
    axes: collectAxes(fd),
    verification: {
      stage: str(fd, "stage") || "text_sourced",
      best_source_tier: str(fd, "best_source_tier") || "C",
      needs: str(fd, "needs") ? str(fd, "needs").split("\n").map((n) => n.trim()).filter(Boolean) : [],
      sources: collectSources(fd),
    },
  };

  statements.push(entry);
  await saveStatements(statements);
  await audit({
    actor: ACTOR,
    action: "create",
    target: id,
    detail: `Added "${entry.neutral_title}" — ${entry.party_at_time}, status ${entry.status}${
      entry.quote ? "" : ", no verbatim quote established"
    }.`,
  });
  refresh();
  redirect(`/admin/entries/${id}`);
}

// ── update ───────────────────────────────────────────────────────────

export async function updateStatement(fd: FormData) {
  const id = str(fd, "id");
  const statements = await getStatements();
  const i = statements.findIndex((s) => s.id === id);
  if (i === -1) return;

  const before = statements[i];
  const quote = str(fd, "quote");
  const axes = collectAxes(fd);

  const axesChanged = Object.keys(axes).filter((k) => axes[k] !== before.axes[k]);
  const statusChanged = str(fd, "status") !== before.status;

  statements[i] = {
    ...before,
    status: (str(fd, "status") || before.status) as StoredStatement["status"],
    speaker_id: str(fd, "speaker_id") || before.speaker_id,
    party_at_time: str(fd, "party_at_time") || before.party_at_time,
    office_at_time: str(fd, "office_at_time"),
    state: str(fd, "state"),
    date: str(fd, "date"),
    date_precision: str(fd, "date_precision") || "day",
    venue: str(fd, "venue"),
    language: str(fd, "language"),
    category: str(fd, "category"),
    neutral_title: str(fd, "neutral_title"),
    quote: quote || null,
    quote_note: str(fd, "quote_note") || undefined,
    claim: str(fd, "claim"),
    context: str(fd, "context") || undefined,
    counterpoint: str(fd, "counterpoint") || undefined,
    hall_of_fame: fd.get("hall_of_fame") === "on",
    video: parseVideo(str(fd, "video"))
      ? { ...parseVideo(str(fd, "video"))!, start: toSeconds(str(fd, "video_start")), end: toSeconds(str(fd, "video_end")) }
      : undefined,
    axes,
    verification: {
      stage: str(fd, "stage") || before.verification.stage,
      best_source_tier: str(fd, "best_source_tier") || before.verification.best_source_tier,
      needs: str(fd, "needs") ? str(fd, "needs").split("\n").map((n) => n.trim()).filter(Boolean) : [],
      sources: collectSources(fd),
    },
  };

  await saveStatements(statements);

  const notes: string[] = [];
  if (statusChanged) notes.push(`status ${before.status} → ${statements[i].status}`);
  if (axesChanged.length) {
    // Axis edits move the rating. Recording which axis moved, and by how
    // much, is what stops the ladder from being quietly steerable.
    notes.push(
      "axes " + axesChanged.map((k) => `${k} ${before.axes[k]}→${axes[k]}`).join(", ") + " — rating recomputed"
    );
  }
  if (!!before.hall_of_fame !== !!statements[i].hall_of_fame) {
    notes.push(statements[i].hall_of_fame ? "inducted into the Hall of Fame" : "removed from the Hall of Fame");
  }

  await audit({
    actor: ACTOR,
    action: "update",
    target: id,
    detail: notes.length ? notes.join("; ") + "." : `Edited "${statements[i].neutral_title}".`,
  });
  refresh();
}

// ── status shortcuts ─────────────────────────────────────────────────

export async function setStatus(fd: FormData) {
  const id = str(fd, "id");
  const status = str(fd, "status") as StoredStatement["status"];
  const statements = await getStatements();
  const s = statements.find((x) => x.id === id);
  if (!s) return;
  const before = s.status;
  s.status = status;
  await saveStatements(statements);
  await audit({
    actor: ACTOR,
    action: status === "withdrawn" ? "withdraw" : "status",
    target: id,
    detail: `"${s.neutral_title}" — status ${before} → ${status}.`,
  });
  refresh();
}

export async function toggleHallOfFame(fd: FormData) {
  const id = str(fd, "id");
  const statements = await getStatements();
  const s = statements.find((x) => x.id === id);
  if (!s) return;
  s.hall_of_fame = !s.hall_of_fame;
  await saveStatements(statements);
  await audit({
    actor: ACTOR,
    action: "hall-of-fame",
    target: id,
    detail: `"${s.neutral_title}" ${s.hall_of_fame ? "inducted into" : "removed from"} the Hall of Fame.`,
  });
  refresh();
}

// ── politicians ──────────────────────────────────────────────────────

export async function createPolitician(fd: FormData) {
  const politicians = await getPoliticians();
  const name = str(fd, "name");
  const id = str(fd, "id") || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!id || politicians.some((p) => p.id === id)) return;
  politicians.push({ id, name, party: str(fd, "party"), state: str(fd, "state"), notes: str(fd, "notes") || undefined });
  await savePoliticians(politicians);
  await audit({ actor: ACTOR, action: "create", target: id, detail: `Added representative ${name} (${str(fd, "party")}).` });
  refresh();
}
