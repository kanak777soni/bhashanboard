import "server-only";
import { unstable_noStore as noStore } from "next/cache";
import { db } from "./db";

export type StatementStatus = "published" | "held_parity" | "held_review" | "withdrawn";

export interface StoredStatement {
  id: string;
  /** Optimistic-concurrency token from bhashan.statements.version. */
  version: number;
  status: StatementStatus;
  speaker_id: string;
  party_at_time: string;
  office_at_time: string;
  state: string;
  date: string;
  date_precision?: string;
  venue: string;
  language: string;
  category: string;
  neutral_title: string;
  quote: string | null;
  quote_translation?: string;
  quote_note?: string;
  claim: string;
  context?: string;
  counterpoint?: string;
  policy_note?: string;
  hall_of_fame?: boolean;
  video?: { platform?: string; id?: string; start?: number; end?: number };
  axes: Record<string, number>;
  verification: {
    stage: string;
    best_source_tier: string;
    needs?: string[];
    sources?: { tier?: string; publisher?: string; title?: string; url?: string }[];
  };
}

export type StatementDocument = Omit<StoredStatement, "id" | "version">;

export interface StoredPolitician {
  id: string;
  version: number;
  name: string;
  party: string;
  state: string;
  notes?: string;
}

export type PoliticianDocument = Omit<StoredPolitician, "id" | "version">;

export interface AuditEntry {
  at: string;
  actor: string;
  action: string;
  target: string;
  detail: string;
}

export interface AuditContext {
  actor: string;
  action: string;
  detail: string;
}

interface DocumentRow {
  id: unknown;
  document: unknown;
  version: unknown;
}

interface AuditRow {
  occurred_at: unknown;
  actor: unknown;
  action: unknown;
  target_id: unknown;
  detail: unknown;
}

function objectDocument(value: unknown, table: string, id: string): Record<string, unknown> {
  let parsed = value;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      throw new Error(`${table} ${id} has invalid JSON in document.`);
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${table} ${id} has a non-object document.`);
  }
  return parsed as Record<string, unknown>;
}

function rowVersion(value: unknown, table: string, id: string): number {
  const version = Number(value);
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new Error(`${table} ${id} has invalid version ${String(value)}.`);
  }
  return version;
}

function mapStatement(row: DocumentRow): StoredStatement {
  const id = String(row.id);
  const document = objectDocument(row.document, "Statement", id);
  return {
    ...(document as unknown as StatementDocument),
    id,
    version: rowVersion(row.version, "Statement", id),
  };
}

function mapPolitician(row: DocumentRow): StoredPolitician {
  const id = String(row.id);
  const document = objectDocument(row.document, "Politician", id);
  return {
    ...(document as unknown as PoliticianDocument),
    id,
    version: rowVersion(row.version, "Politician", id),
  };
}

function statementJson(document: StatementDocument): string {
  return JSON.stringify(document);
}

function politicianJson(document: PoliticianDocument): string {
  return JSON.stringify(document);
}

function mutationRow(rows: unknown, table: string, id: string): DocumentRow {
  const list = rows as DocumentRow[];
  if (!Array.isArray(list) || list.length !== 1) {
    throw new Error(`${table} ${id} is missing or was changed by another admin. Reload and try again.`);
  }
  return list[0];
}

function auditValues(audit: AuditContext): [string, string, string] {
  const actor = audit.actor.trim();
  const action = audit.action.trim();
  const detail = audit.detail.trim();
  if (!actor || !action || !detail) {
    throw new Error("Audited mutations require actor, action, and detail.");
  }
  return [actor, action, detail];
}

// ── reads ────────────────────────────────────────────────────────────

export async function getStatements(): Promise<StoredStatement[]> {
  noStore();
  const rows = await db()`
    SELECT id, document, version
    FROM bhashan.statements
    ORDER BY id
  `;
  return (rows as unknown as DocumentRow[]).map(mapStatement);
}

export async function getStatement(id: string): Promise<StoredStatement | undefined> {
  noStore();
  const rows = await db()`
    SELECT id, document, version
    FROM bhashan.statements
    WHERE id = ${id}
    LIMIT 1
  `;
  const row = (rows as unknown as DocumentRow[])[0];
  return row ? mapStatement(row) : undefined;
}

export async function getPoliticians(): Promise<StoredPolitician[]> {
  noStore();
  const rows = await db()`
    SELECT id, document, version
    FROM bhashan.politicians
    ORDER BY id
  `;
  return (rows as unknown as DocumentRow[]).map(mapPolitician);
}

export async function getParties(): Promise<{ id: string; name: string; ink?: string }[]> {
  noStore();
  const rows = await db()`
    SELECT id, document
    FROM bhashan.parties
    ORDER BY id
  `;
  return (rows as unknown as Pick<DocumentRow, "id" | "document">[]).map((row) => {
    const id = String(row.id);
    const document = objectDocument(row.document, "Party", id);
    return {
      id,
      name: String(document.name ?? id),
      ink: typeof document.ink === "string" ? document.ink : undefined,
    };
  });
}

export async function getAudit(limit = 1000): Promise<AuditEntry[]> {
  noStore();
  const requestedLimit = Number.isFinite(limit) ? Math.trunc(limit) : 1000;
  const safeLimit = Math.min(Math.max(requestedLimit, 1), 1000);
  const rows = await db()`
    SELECT occurred_at, actor, action, target_id, detail
    FROM bhashan.audit_events
    ORDER BY occurred_at DESC, event_id DESC
    LIMIT ${safeLimit}
  `;
  return (rows as unknown as AuditRow[]).map((row) => {
    const date = row.occurred_at instanceof Date ? row.occurred_at : new Date(String(row.occurred_at));
    if (Number.isNaN(date.getTime())) throw new Error("Audit event has an invalid occurred_at timestamp.");
    return {
      at: date.toISOString(),
      actor: String(row.actor),
      action: String(row.action),
      target: String(row.target_id),
      detail: String(row.detail),
    };
  });
}

// ── audited row mutations ───────────────────────────────────────────

export async function createStatementRecord(
  document: StatementDocument,
  audit: AuditContext
): Promise<StoredStatement> {
  const [actor, action, detail] = auditValues(audit);
  const payload = statementJson(document);
  const result = await db().transaction((tx) => [
    tx`SELECT set_config('bhashan.actor', ${actor}, true)`,
    tx`SELECT set_config('bhashan.action', ${action}, true)`,
    tx`SELECT set_config('bhashan.detail', ${detail}, true)`,
    tx`
      WITH next_statement AS (
        SELECT
          'IN-' || lpad(nextval('bhashan.statement_number_seq')::text, 4, '0') AS id
      )
      INSERT INTO bhashan.statements (id, document)
      SELECT
        id,
        jsonb_set(${payload}::jsonb, '{id}', to_jsonb(id), true)
      FROM next_statement
      RETURNING id, document, version
    `,
  ]);
  return mapStatement(mutationRow(result[3], "Statement", "new"));
}

export async function updateStatementRecord(
  id: string,
  document: StatementDocument,
  expectedVersion: number,
  audit: AuditContext
): Promise<StoredStatement> {
  const [actor, action, detail] = auditValues(audit);
  const payload = statementJson(document);
  const result = await db().transaction((tx) => [
    tx`SELECT set_config('bhashan.actor', ${actor}, true)`,
    tx`SELECT set_config('bhashan.action', ${action}, true)`,
    tx`SELECT set_config('bhashan.detail', ${detail}, true)`,
    tx`
      UPDATE bhashan.statements
      SET
        document = jsonb_set(${payload}::jsonb, '{id}', to_jsonb(id), true),
        version = version + 1,
        updated_at = now()
      WHERE id = ${id} AND version = ${expectedVersion}
      RETURNING id, document, version
    `,
  ]);
  return mapStatement(mutationRow(result[3], "Statement", id));
}

export async function setStatementStatus(
  id: string,
  status: StatementStatus,
  expectedVersion: number,
  audit: AuditContext
): Promise<StoredStatement> {
  const [actor, action, detail] = auditValues(audit);
  const result = await db().transaction((tx) => [
    tx`SELECT set_config('bhashan.actor', ${actor}, true)`,
    tx`SELECT set_config('bhashan.action', ${action}, true)`,
    tx`SELECT set_config('bhashan.detail', ${detail}, true)`,
    tx`
      UPDATE bhashan.statements
      SET
        document = jsonb_set(document, '{status}', to_jsonb(${status}::text), true),
        version = version + 1,
        updated_at = now()
      WHERE id = ${id} AND version = ${expectedVersion}
      RETURNING id, document, version
    `,
  ]);
  return mapStatement(mutationRow(result[3], "Statement", id));
}

export async function setStatementHallOfFame(
  id: string,
  value: boolean,
  expectedVersion: number,
  audit: AuditContext
): Promise<StoredStatement> {
  const [actor, action, detail] = auditValues(audit);
  const result = await db().transaction((tx) => [
    tx`SELECT set_config('bhashan.actor', ${actor}, true)`,
    tx`SELECT set_config('bhashan.action', ${action}, true)`,
    tx`SELECT set_config('bhashan.detail', ${detail}, true)`,
    tx`
      UPDATE bhashan.statements
      SET
        document = jsonb_set(document, '{hall_of_fame}', to_jsonb(${value}::boolean), true),
        version = version + 1,
        updated_at = now()
      WHERE id = ${id} AND version = ${expectedVersion}
      RETURNING id, document, version
    `,
  ]);
  return mapStatement(mutationRow(result[3], "Statement", id));
}

export async function createPoliticianRecord(
  id: string,
  document: PoliticianDocument,
  audit: AuditContext
): Promise<StoredPolitician> {
  const [actor, action, detail] = auditValues(audit);
  const payload = politicianJson(document);
  const result = await db().transaction((tx) => [
    tx`SELECT set_config('bhashan.actor', ${actor}, true)`,
    tx`SELECT set_config('bhashan.action', ${action}, true)`,
    tx`SELECT set_config('bhashan.detail', ${detail}, true)`,
    tx`
      INSERT INTO bhashan.politicians (id, document)
      VALUES (
        ${id},
        jsonb_set(${payload}::jsonb, '{id}', to_jsonb(${id}::text), true)
      )
      RETURNING id, document, version
    `,
  ]);
  return mapPolitician(mutationRow(result[3], "Politician", id));
}

// ── derived ranking ─────────────────────────────────────────────────

export const AXIS_WEIGHTS: Record<string, number> = {
  logic_damage: 0.3,
  straight_face: 0.2,
  rewatch_value: 0.2,
  crowd_complicity: 0.15,
  consequence: 0.15,
};

export const AXIS_LABELS: Record<string, string> = {
  logic_damage: "Logic damage",
  straight_face: "Straight face",
  rewatch_value: "Rewatch value",
  crowd_complicity: "Crowd complicity",
  consequence: "Consequence (5 = nothing happened)",
};

export function weightedScore(axes: Record<string, number>): number {
  return Object.entries(AXIS_WEIGHTS).reduce((sum, [key, weight]) => sum + (axes[key] ?? 0) * weight, 0);
}

const BANDS: [number, number, number][] = [
  [0.025, 1875, 1960],
  [0.08, 1750, 1868],
  [0.16, 1600, 1742],
  [0.21, 1450, 1590],
  [0.24, 1300, 1440],
  [1, 1150, 1290],
];

export function computeLadder(statements: StoredStatement[]): { id: string; gp: number; rank: number }[] {
  const live = statements.filter((statement) => statement.status === "published");
  const ordered = [...live].sort((a, b) => weightedScore(b.axes) - weightedScore(a.axes));
  const out: { id: string; gp: number; rank: number }[] = [];
  let index = 0;
  for (const [share, low, high] of BANDS) {
    const wanted = share === 1 ? ordered.length - index : Math.round(ordered.length * share);
    const count = Math.min(Math.max(wanted, 0), ordered.length - index);
    for (let offset = 0; offset < count; offset++) {
      const gp =
        count === 1 ? high : Math.round(high - ((high - low) * offset) / Math.max(count - 1, 1));
      out.push({ id: ordered[index + offset].id, gp, rank: index + offset + 1 });
    }
    index += count;
    if (index >= ordered.length) break;
  }
  return out;
}

export function coverage(statements: StoredStatement[]): { party: string; count: number; pct: number }[] {
  const live = statements.filter((statement) => statement.status === "published");
  const counts = new Map<string, number>();
  live.forEach((statement) =>
    counts.set(statement.party_at_time, (counts.get(statement.party_at_time) ?? 0) + 1)
  );
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([party, count]) => ({
      party,
      count,
      pct: Math.round((count / (live.length || 1)) * 100),
    }));
}
