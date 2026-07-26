import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Runtime read/write over the corpus files.
 *
 * The public site imports the JSON directly, which is bundled at build
 * time and stays fast and static. The admin needs to *write*, so it goes
 * through here instead — plain fs against `data/`.
 *
 * Writing to git-tracked JSON rather than a database is deliberate at this
 * stage: every admin edit becomes a reviewable diff with history, which is
 * exactly what an archive whose product is provenance wants. See the
 * database note in docs/06-roadmap.md.
 */

const DATA = path.join(process.cwd(), "data");

export interface StoredStatement {
  id: string;
  status: "published" | "held_parity" | "held_review" | "withdrawn";
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

export interface StoredPolitician {
  id: string;
  name: string;
  party: string;
  state: string;
  notes?: string;
}

export interface AuditEntry {
  at: string;
  actor: string;
  action: string;
  target: string;
  detail: string;
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await fs.readFile(path.join(DATA, file), "utf8")) as T;
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await fs.writeFile(path.join(DATA, file), JSON.stringify(value, null, 2) + "\n", "utf8");
}

// ── statements ───────────────────────────────────────────────────────

export async function getStatements(): Promise<StoredStatement[]> {
  const doc = await readJson<{ statements: StoredStatement[] }>("statements.json");
  return doc.statements;
}

export async function saveStatements(statements: StoredStatement[]): Promise<void> {
  const doc = await readJson<Record<string, unknown>>("statements.json");
  doc.statements = statements;
  await writeJson("statements.json", doc);
}

export async function getStatement(id: string): Promise<StoredStatement | undefined> {
  return (await getStatements()).find((s) => s.id === id);
}

/** Next free id in the IN-#### series. */
export async function nextStatementId(): Promise<string> {
  const nums = (await getStatements())
    .map((s) => Number(s.id.replace(/\D/g, "")))
    .filter((n) => !Number.isNaN(n));
  return `IN-${String(Math.max(0, ...nums) + 1).padStart(4, "0")}`;
}

// ── politicians & parties ────────────────────────────────────────────

export async function getPoliticians(): Promise<StoredPolitician[]> {
  const doc = await readJson<{ politicians: StoredPolitician[] }>("politicians.json");
  return doc.politicians;
}

export async function savePoliticians(politicians: StoredPolitician[]): Promise<void> {
  const doc = await readJson<Record<string, unknown>>("politicians.json");
  doc.politicians = politicians;
  await writeJson("politicians.json", doc);
}

export async function getParties(): Promise<{ id: string; name: string; ink?: string }[]> {
  const doc = await readJson<{ parties: { id: string; name: string; ink?: string }[] }>("parties.json");
  return doc.parties;
}

// ── audit ────────────────────────────────────────────────────────────

/**
 * Every write goes through here. The project's own rule is that it keeps
 * score of itself; an admin that can silently change a rating would make
 * the published ledger a lie. Ratings remain editable — the record of who
 * changed them is what keeps that honest.
 */
export async function audit(entry: Omit<AuditEntry, "at">): Promise<void> {
  let log: { audit: AuditEntry[] };
  try {
    log = await readJson<{ audit: AuditEntry[] }>("audit.json");
  } catch {
    log = { audit: [] };
  }
  log.audit.unshift({ at: new Date().toISOString(), ...entry });
  log.audit = log.audit.slice(0, 1000);
  await writeJson("audit.json", log);
}

export async function getAudit(): Promise<AuditEntry[]> {
  try {
    return (await readJson<{ audit: AuditEntry[] }>("audit.json")).audit;
  } catch {
    return [];
  }
}

// ── derived ranking ──────────────────────────────────────────────────
// Same maths as tools/seed-rank.mjs and lib/corpus.ts: weighted axes give
// an order, GP is interpolated inside the tier bands so the spread matches
// the target rarities rather than bunching at the top.

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
  return Object.entries(AXIS_WEIGHTS).reduce((sum, [k, w]) => sum + (axes[k] ?? 0) * w, 0);
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
  const live = statements.filter((s) => s.status === "published");
  const ordered = [...live].sort((a, b) => weightedScore(b.axes) - weightedScore(a.axes));
  const out: { id: string; gp: number; rank: number }[] = [];
  let index = 0;
  for (const [share, lo, hi] of BANDS) {
    const want = share === 1 ? ordered.length - index : Math.round(ordered.length * share);
    const n = Math.min(Math.max(want, 0), ordered.length - index);
    for (let k = 0; k < n; k++) {
      const gp = n === 1 ? hi : Math.round(hi - ((hi - lo) * k) / Math.max(n - 1, 1));
      out.push({ id: ordered[index + k].id, gp, rank: index + k + 1 });
    }
    index += n;
    if (index >= ordered.length) break;
  }
  return out;
}

/** Party share of the live ladder — the coverage figure published on the site. */
export function coverage(statements: StoredStatement[]): { party: string; count: number; pct: number }[] {
  const live = statements.filter((s) => s.status === "published");
  const counts = new Map<string, number>();
  live.forEach((s) => counts.set(s.party_at_time, (counts.get(s.party_at_time) ?? 0) + 1));
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([party, count]) => ({ party, count, pct: Math.round((count / (live.length || 1)) * 100) }));
}
