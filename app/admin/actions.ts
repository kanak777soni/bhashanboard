"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/require-admin";
import {
  createPoliticianRecord,
  createStatementRecord,
  getStatement,
  setStatementHallOfFame,
  setStatementStatus,
  updateStatementRecord,
  type PoliticianDocument,
  type StatementDocument,
  type StatementStatus,
  type StoredStatement,
} from "@/lib/store";

const STATUSES: readonly StatementStatus[] = [
  "published",
  "held_parity",
  "held_review",
  "withdrawn",
];

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

function num(fd: FormData, key: string): number {
  const value = Number(fd.get(key));
  return Number.isFinite(value) ? value : 0;
}

function refresh() {
  revalidatePath("/", "layout");
}

function statementStatus(fd: FormData, fallback?: StatementStatus): StatementStatus {
  const value = str(fd, "status") || fallback;
  if (!value || !STATUSES.includes(value as StatementStatus)) {
    throw new Error(`Invalid statement status "${String(value ?? "")}".`);
  }
  return value as StatementStatus;
}

function formVersion(fd: FormData): number {
  const raw = str(fd, "version");
  const version = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(version) || version < 1) {
    throw new Error("This edit has no valid version. Reload the entry and try again.");
  }
  return version;
}

/** Parse "https://youtu.be/ID", "watch?v=ID" or a bare id. */
function parseVideo(input: string): { platform: string; id: string } | undefined {
  const value = input.trim();
  if (!value) return undefined;
  const match =
    value.match(/(?:youtube\.com\/.*[?&]v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/) ??
    value.match(/^([\w-]{6,})$/);
  return match ? { platform: "youtube", id: match[1] } : undefined;
}

function toSeconds(value: string): number | undefined {
  const input = value.trim();
  if (!input) return undefined;
  if (/^\d+$/.test(input)) return Number(input);
  const parts = input.split(":").map(Number);
  if (parts.some(Number.isNaN)) return undefined;
  return parts.reduce((total, part) => total * 60 + part, 0);
}

function collectVideo(fd: FormData): StoredStatement["video"] {
  const video = parseVideo(str(fd, "video"));
  return video
    ? {
        ...video,
        start: toSeconds(str(fd, "video_start")),
        end: toSeconds(str(fd, "video_end")),
      }
    : undefined;
}

function collectAxes(fd: FormData): Record<string, number> {
  const axes = {
    logic_damage: num(fd, "logic_damage"),
    straight_face: num(fd, "straight_face"),
    rewatch_value: num(fd, "rewatch_value"),
    crowd_complicity: num(fd, "crowd_complicity"),
    consequence: num(fd, "consequence"),
  };
  for (const [axis, value] of Object.entries(axes)) {
    if (!Number.isInteger(value) || value < 0 || value > 5) {
      throw new Error(`Axis ${axis} must be an integer from 0 to 5.`);
    }
  }
  return axes;
}

function collectSources(fd: FormData) {
  const sources: { tier: string; publisher: string; title: string; url: string }[] = [];
  for (let index = 0; index < 4; index++) {
    const publisher = str(fd, `src_publisher_${index}`);
    const url = str(fd, `src_url_${index}`);
    if (!publisher && !url) continue;
    sources.push({
      tier: str(fd, `src_tier_${index}`) || "C",
      publisher,
      title: str(fd, `src_title_${index}`),
      url,
    });
  }
  return sources;
}

function assertQuoteIntegrity({
  language,
  quote,
  quoteTranslation,
  quoteNote,
}: {
  language: string;
  quote: string | null;
  quoteTranslation?: string;
  quoteNote?: string;
}) {
  if (quote && language !== "English" && !quoteTranslation?.trim()) {
    throw new Error("A non-English verbatim quote requires a faithful English translation.");
  }
  if (quoteTranslation?.trim() && (!quote || language === "English")) {
    throw new Error("English translations are only valid alongside a non-English verbatim quote.");
  }
  if (!quote && !quoteNote?.trim()) {
    throw new Error("An entry without an established quote requires a note explaining what is missing.");
  }
}

function collectQuoteFields(fd: FormData) {
  const language = str(fd, "language") || "Hindi";
  const quote = str(fd, "quote");
  const quoteNote = str(fd, "quote_note");
  const suppliedTranslation = str(fd, "quote_translation");

  assertQuoteIntegrity({
    language,
    quote: quote || null,
    quoteTranslation: suppliedTranslation || undefined,
    quoteNote: quoteNote || undefined,
  });

  return {
    language,
    quote: quote || null,
    quoteTranslation:
      quote && language !== "English" ? suppliedTranslation || undefined : undefined,
    quoteNote: quoteNote || undefined,
  };
}

function collectVerification(
  fd: FormData,
  fallback?: StoredStatement["verification"]
): StoredStatement["verification"] {
  const needs = str(fd, "needs")
    ? str(fd, "needs")
        .split("\n")
        .map((need) => need.trim())
        .filter(Boolean)
    : [];
  return {
    stage: str(fd, "stage") || fallback?.stage || "text_sourced",
    best_source_tier: str(fd, "best_source_tier") || fallback?.best_source_tier || "C",
    needs,
    sources: collectSources(fd),
  };
}

function statementDocument(
  fd: FormData,
  quoteFields: ReturnType<typeof collectQuoteFields>,
  status: StatementStatus,
  fallback?: StoredStatement
): StatementDocument {
  return {
    status,
    speaker_id: str(fd, "speaker_id") || fallback?.speaker_id || "",
    party_at_time: str(fd, "party_at_time") || fallback?.party_at_time || "",
    office_at_time: str(fd, "office_at_time"),
    state: str(fd, "state"),
    date: str(fd, "date"),
    date_precision: str(fd, "date_precision") || "day",
    venue: str(fd, "venue"),
    language: quoteFields.language,
    category: str(fd, "category"),
    neutral_title: str(fd, "neutral_title"),
    quote: quoteFields.quote,
    quote_translation: quoteFields.quoteTranslation,
    quote_note: quoteFields.quoteNote,
    claim: str(fd, "claim"),
    context: str(fd, "context") || undefined,
    counterpoint: str(fd, "counterpoint") || undefined,
    policy_note: fallback?.policy_note,
    hall_of_fame: fallback ? fd.get("hall_of_fame") === "on" : false,
    video: collectVideo(fd),
    axes: collectAxes(fd),
    verification: collectVerification(fd, fallback?.verification),
  };
}

// ── statements ──────────────────────────────────────────────────────

export async function createStatement(fd: FormData) {
  const actor = await requireAdmin();
  const quoteFields = collectQuoteFields(fd);
  const status = statementStatus(fd, "held_review");
  const entry = statementDocument(fd, quoteFields, status);

  const created = await createStatementRecord(entry, {
    actor: actor.label,
    action: "create",
    detail: `Added "${entry.neutral_title}" — ${entry.party_at_time}, status ${entry.status}${
      entry.quote ? "" : ", no verbatim quote established"
    }.`,
  });

  refresh();
  redirect(`/admin/entries/${created.id}`);
}

export async function updateStatement(fd: FormData) {
  const actor = await requireAdmin();
  const id = str(fd, "id");
  const expectedVersion = formVersion(fd);
  const before = await getStatement(id);
  if (!before) throw new Error(`Statement ${id} no longer exists.`);
  if (before.version !== expectedVersion) {
    throw new Error(`Statement ${id} was changed by another admin. Reload and try again.`);
  }

  const quoteFields = collectQuoteFields(fd);
  const status = statementStatus(fd, before.status);
  const entry = statementDocument(fd, quoteFields, status, before);
  const axes = entry.axes;

  const axesChanged = Object.keys(axes).filter((key) => axes[key] !== before.axes[key]);
  const notes: string[] = [];
  if (status !== before.status) notes.push(`status ${before.status} → ${status}`);
  if (axesChanged.length) {
    notes.push(
      "axes " +
        axesChanged.map((key) => `${key} ${before.axes[key]}→${axes[key]}`).join(", ") +
        " — rating recomputed"
    );
  }
  if (!!before.hall_of_fame !== !!entry.hall_of_fame) {
    notes.push(entry.hall_of_fame ? "inducted into the Hall of Fame" : "removed from the Hall of Fame");
  }

  await updateStatementRecord(id, entry, expectedVersion, {
    actor: actor.label,
    action: "update",
    detail: notes.length ? `${notes.join("; ")}.` : `Edited "${entry.neutral_title}".`,
  });
  refresh();
}

export async function setStatus(fd: FormData) {
  const actor = await requireAdmin();
  const id = str(fd, "id");
  const status = statementStatus(fd);
  const before = await getStatement(id);
  if (!before) throw new Error(`Statement ${id} no longer exists.`);

  if (status === "published") {
    assertQuoteIntegrity({
      language: before.language,
      quote: before.quote,
      quoteTranslation: before.quote_translation,
      quoteNote: before.quote_note,
    });
  }
  if (status === before.status) return;

  await setStatementStatus(id, status, before.version, {
    actor: actor.label,
    action: status === "withdrawn" ? "withdraw" : "status",
    detail: `"${before.neutral_title}" — status ${before.status} → ${status}.`,
  });
  refresh();
}

export async function toggleHallOfFame(fd: FormData) {
  const actor = await requireAdmin();
  const id = str(fd, "id");
  const before = await getStatement(id);
  if (!before) throw new Error(`Statement ${id} no longer exists.`);

  const requested = str(fd, "value");
  if (requested && requested !== "true" && requested !== "false") {
    throw new Error("Invalid Hall of Fame value.");
  }
  const desired = requested ? requested === "true" : !before.hall_of_fame;
  if (desired && before.status !== "published") {
    throw new Error("Only a published statement can be inducted into the Hall of Fame.");
  }
  if (desired === !!before.hall_of_fame) return;

  await setStatementHallOfFame(id, desired, before.version, {
    actor: actor.label,
    action: "hall-of-fame",
    detail: `"${before.neutral_title}" ${
      desired ? "inducted into" : "removed from"
    } the Hall of Fame.`,
  });
  refresh();
}

// ── politicians ─────────────────────────────────────────────────────

export async function createPolitician(fd: FormData) {
  const actor = await requireAdmin();
  const name = str(fd, "name");
  const id =
    str(fd, "id") ||
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  if (!id || !name) throw new Error("Representative name and identifier are required.");

  const politician: PoliticianDocument = {
    name,
    party: str(fd, "party"),
    state: str(fd, "state"),
    notes: str(fd, "notes") || undefined,
  };
  await createPoliticianRecord(id, politician, {
    actor: actor.label,
    action: "create",
    detail: `Added representative ${name} (${politician.party}).`,
  });
  refresh();
}
