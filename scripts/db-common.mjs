import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const MIGRATIONS_DIR = join(ROOT, "db", "migrations");

const FILE_SPECS = [
  ["data/statements.json", "statements"],
  ["data/politicians.json", "politicians"],
  ["data/parties.json", "parties"],
  ["data/rejected.json", "rejected"],
  ["data/audit.json", "audit"],
  ["data/generated/leaderboard.json", "entries"],
  ["data/schema/statement.schema.json", null],
];

export function loadRepoEnv() {
  if (
    process.env.MIGRATION_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.database_url
  ) return;
  const candidates = [join(ROOT, ".env"), join(ROOT, "..", ".env")];
  const envPath = candidates.find(existsSync);
  if (envPath) process.loadEnvFile(envPath);
}

export function getDatabaseUrl() {
  loadRepoEnv();
  const value =
    process.env.MIGRATION_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.database_url;
  if (!value) {
    throw new Error(
      "MIGRATION_DATABASE_URL or DATABASE_URL is missing. Add a Neon PostgreSQL URL to .env."
    );
  }
  if (!/^postgres(?:ql)?:\/\//i.test(value)) {
    throw new Error("DATABASE_URL must be a PostgreSQL URL.");
  }
  return value;
}

export function safeErrorMessage(error) {
  let message = error instanceof Error ? error.message : String(error);
  for (const value of [
    process.env.MIGRATION_DATABASE_URL,
    process.env.DATABASE_URL,
    process.env.database_url,
  ]) {
    if (value) message = message.split(value).join("[redacted database URL]");
  }
  return message
    .replace(/postgres(?:ql)?:\/\/[^\s'"`]+/gi, "postgresql://[redacted]")
    .replace(/\s+/g, " ")
    .slice(0, 1200);
}

export async function createSqlClient() {
  const { neon } = await import("@neondatabase/serverless");
  return neon(getDatabaseUrl());
}

export function rowsOf(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.rows)) return result.rows;
  return [];
}

function sortJson(value) {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortJson(value[key])])
    );
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(sortJson(value));
}

export function sha256(value) {
  const input = Buffer.isBuffer(value) ? value : Buffer.from(String(value));
  return createHash("sha256").update(input).digest("hex");
}

/** Repository text is canonically LF so checksums are stable on Windows. */
function canonicalRepoText(value) {
  return String(value).replace(/\r\n?/g, "\n");
}

export function hashDocument(document) {
  return sha256(canonicalJson(document));
}

function readArtifact(path, payloadKey) {
  const absolutePath = join(ROOT, path);
  const sourceText = canonicalRepoText(readFileSync(absolutePath, "utf8"));
  const bytes = Buffer.from(sourceText, "utf8");
  const document = JSON.parse(sourceText);
  const wrapper = payloadKey
    ? Object.fromEntries(Object.entries(document).filter(([key]) => key !== payloadKey))
    : document;
  return {
    path: path.replace(/\\/g, "/"),
    payloadKey,
    sha256: sha256(bytes),
    sourceText,
    document,
    wrapper,
  };
}

function gitMetadata() {
  try {
    const commit = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: ROOT,
      encoding: "utf8",
    }).trim();
    const dirty =
      execFileSync("git", ["status", "--porcelain"], {
        cwd: ROOT,
        encoding: "utf8",
      }).trim().length > 0;
    return { commit, dirty };
  } catch {
    return { commit: null, dirty: true };
  }
}

function uniqueIds(rows, label) {
  const seen = new Set();
  for (const row of rows) {
    if (!row?.id || typeof row.id !== "string") {
      throw new Error(`${label} contains a row without a string id.`);
    }
    if (seen.has(row.id)) throw new Error(`${label} contains duplicate id ${row.id}.`);
    seen.add(row.id);
  }
  return seen;
}

function assertSameSet(actual, expected, label) {
  const missing = [...expected].filter((id) => !actual.has(id));
  const extra = [...actual].filter((id) => !expected.has(id));
  if (missing.length || extra.length) {
    throw new Error(
      `${label} IDs disagree (missing ${missing.join(",") || "none"}; extra ${
        extra.join(",") || "none"
      }).`
    );
  }
}

export function validateSnapshot(snapshot) {
  const { statements, politicians, parties, rejections, audit, leaderboard } =
    snapshot.documents;
  if (!Array.isArray(statements.statements)) {
    throw new Error("statements.json has no statements array.");
  }
  if (!Array.isArray(politicians.politicians)) {
    throw new Error("politicians.json has no politicians array.");
  }
  if (!Array.isArray(parties.parties)) {
    throw new Error("parties.json has no parties array.");
  }
  if (!Array.isArray(rejections.rejected)) {
    throw new Error("rejected.json has no rejected array.");
  }
  if (
    !rejections.rules ||
    typeof rejections.rules !== "object" ||
    Array.isArray(rejections.rules)
  ) {
    throw new Error("rejected.json has no rules object.");
  }
  if (!Array.isArray(audit.audit)) throw new Error("audit.json has no audit array.");
  if (!Array.isArray(leaderboard.entries)) {
    throw new Error("leaderboard.json has no entries array.");
  }

  const partyIds = uniqueIds(parties.parties, "parties.json");
  const politicianIds = uniqueIds(politicians.politicians, "politicians.json");
  uniqueIds(statements.statements, "statements.json");
  const leaderboardIds = uniqueIds(leaderboard.entries, "leaderboard.json");
  const statuses = new Set([
    "published",
    "held_parity",
    "held_review",
    "private_draft",
    "withdrawn",
  ]);
  const tierRank = { A: 4, B: 3, C: 2, D: 1 };
  const statementNumbers = [];

  for (const politician of politicians.politicians) {
    if (!partyIds.has(politician.party)) {
      throw new Error(
        `Politician ${politician.id} references unknown party ${politician.party}.`
      );
    }
  }

  for (const statement of statements.statements) {
    if (!/^IN-[0-9]{4,}$/.test(statement.id)) {
      throw new Error(`Invalid statement id ${statement.id}.`);
    }
    statementNumbers.push(Number(statement.id.slice(3)));
    if (!politicianIds.has(statement.speaker_id)) {
      throw new Error(`Statement ${statement.id} references unknown speaker.`);
    }
    if (!partyIds.has(statement.party_at_time)) {
      throw new Error(`Statement ${statement.id} references unknown party.`);
    }
    if (!statuses.has(statement.status)) {
      throw new Error(`Statement ${statement.id} has invalid status.`);
    }
    // Inspect both locations independently. An invalid root placeholder must
    // not hide uploaded evidence that runtime fallback would accept. Uploaded
    // assets must always enter through the actor-bound administrator workflow,
    // never through a repository corpus import.
    for (const importedVideo of [statement.video, statement.verification?.embed]) {
      if (
        importedVideo &&
        typeof importedVideo === "object" &&
        !Array.isArray(importedVideo) &&
        (
          importedVideo.platform === "r2" ||
          importedVideo.platform === "cloudinary" ||
          (typeof importedVideo.id === "string" &&
            importedVideo.id.startsWith("statement-videos/")) ||
          (typeof importedVideo.id === "string" &&
            importedVideo.id.startsWith("bhashanboard/statement-videos/")) ||
          Object.hasOwn(importedVideo, "assetId") ||
          Object.hasOwn(importedVideo, "derivedBytes")
        )
      ) {
        throw new Error(
          `Statement ${statement.id} cannot import an uploaded video from JSON; use the actor-bound administrator upload workflow.`
        );
      }
    }
    const sources = statement.verification?.sources;
    if (!Array.isArray(sources) || sources.length < 1 || sources.length > 4) {
      throw new Error(`Statement ${statement.id} must have one to four sources.`);
    }
    for (const source of sources) {
      if (
        !["A", "B", "C"].includes(source.tier) ||
        typeof source.url !== "string" ||
        source.url.trim().length === 0
      ) {
        throw new Error(`Statement ${statement.id} has an invalid source.`);
      }
    }
    const best = sources.reduce(
      (value, source) =>
        tierRank[source.tier] > tierRank[value] ? source.tier : value,
      "D"
    );
    if (best !== statement.verification.best_source_tier) {
      throw new Error(
        `Statement ${statement.id} has inconsistent source tier metadata.`
      );
    }
    if (statement.quote === null && !statement.quote_note?.trim()) {
      throw new Error(`Statement ${statement.id} needs quote_note for a null quote.`);
    }
    if (statement.quote === null && statement.quote_translation) {
      throw new Error(`Statement ${statement.id} has a translation without a quote.`);
    }
    if (
      statement.quote &&
      statement.language !== "English" &&
      !statement.quote_translation?.trim()
    ) {
      throw new Error(
        `Statement ${statement.id} has a non-English quote without an English translation.`
      );
    }
  }

  statementNumbers.sort((left, right) => left - right);
  for (let index = 0; index < statementNumbers.length; index++) {
    if (statementNumbers[index] !== index + 1) {
      throw new Error(
        `Statement numbers are not contiguous at IN-${String(index + 1).padStart(4, "0")}.`
      );
    }
  }

  const rejectionIds = new Set();
  for (const rejection of rejections.rejected) {
    if (!Object.hasOwn(rejections.rules, rejection.rule)) {
      throw new Error(`Rejection references unknown rule ${String(rejection.rule)}.`);
    }
    for (const key of ["rule", "attributed_to", "date", "descriptor"]) {
      if (typeof rejection[key] !== "string" || rejection[key].trim().length === 0) {
        throw new Error(`Rejection identity field ${key} is missing.`);
      }
    }
    const id = rejectionId(rejection);
    if (rejectionIds.has(id)) {
      throw new Error(`Rejections contain duplicate stable identity ${id}.`);
    }
    rejectionIds.add(id);
  }

  for (const [index, event] of audit.audit.entries()) {
    if (!event || typeof event !== "object" || Array.isArray(event)) {
      throw new Error(`audit.json event ${index} is not an object.`);
    }
    for (const key of ["at", "actor", "action", "target", "detail"]) {
      if (typeof event[key] !== "string" || event[key].trim().length === 0) {
        throw new Error(`audit.json event ${index} has no ${key}.`);
      }
    }
    if (Number.isNaN(Date.parse(event.at))) {
      throw new Error(`audit.json event ${index} has an invalid date.`);
    }
  }

  const publishedIds = new Set(
    statements.statements
      .filter((row) => row.status === "published")
      .map((row) => row.id)
  );
  assertSameSet(
    leaderboardIds,
    publishedIds,
    "Generated leaderboard vs published statements"
  );
  if (
    leaderboard.entries.some(
      (row) => row.provisional !== true || row.duels !== 0
    )
  ) {
    throw new Error(
      "Generated leaderboard contains a non-provisional or dueled row."
    );
  }
}

function rejectionId(document) {
  const identity = {
    rule: document.rule ?? null,
    attributed_to: document.attributed_to ?? null,
    date: document.date ?? null,
    descriptor: document.descriptor ?? null,
  };
  return `RJ-${hashDocument(identity)}`;
}

function row(id, document, extra = {}) {
  return { id, document, source_hash: hashDocument(document), ...extra };
}

export function buildLocalSnapshot() {
  const artifacts = FILE_SPECS.map(([path, payloadKey]) =>
    readArtifact(path, payloadKey)
  );
  const byPath = Object.fromEntries(
    artifacts.map((artifact) => [artifact.path, artifact.document])
  );
  const documents = {
    statements: byPath["data/statements.json"],
    politicians: byPath["data/politicians.json"],
    parties: byPath["data/parties.json"],
    rejections: byPath["data/rejected.json"],
    audit: byPath["data/audit.json"],
    leaderboard: byPath["data/generated/leaderboard.json"],
    statementSchema: byPath["data/schema/statement.schema.json"],
  };
  const git = gitMetadata();
  const manifestDocument = {
    format: "bhashan-corpus-manifest/v1",
    corpus: documents.statements.corpus,
    version: documents.statements.version,
    compiled: documents.statements.compiled,
    schema: documents.statements.$schema,
    files: artifacts.map(({ path, sha256: hash }) => ({ path, sha256: hash })),
    counts: {
      parties: documents.parties.parties.length,
      politicians: documents.politicians.politicians.length,
      statements: documents.statements.statements.length,
      rejections: documents.rejections.rejected.length,
      audit: documents.audit.audit.length,
      leaderboard: documents.leaderboard.entries.length,
      settings: 1,
      artifacts: artifacts.length,
    },
  };
  const manifestSha = hashDocument(manifestDocument);
  const importId = `corpus:${documents.statements.corpus}:${manifestSha}`;
  const entityRows = {
    parties: documents.parties.parties.map((document) =>
      row(document.id, document)
    ),
    politicians: documents.politicians.politicians.map((document) =>
      row(document.id, document)
    ),
    statements: documents.statements.statements.map((document) =>
      row(document.id, document)
    ),
    rejections: documents.rejections.rejected.map((document, position) =>
      row(rejectionId(document), document, { position })
    ),
    settings: [
      row("rejection_rules", documents.rejections.rules ?? {}),
    ],
  };
  const artifactRows = artifacts.map((artifact) => ({
    id: `artifact:${manifestSha}:${artifact.path}`,
    path: artifact.path,
    sha256: artifact.sha256,
    wrapper: artifact.wrapper,
    document: artifact.document,
    source_text: artifact.sourceText,
    source_hash: artifact.sha256,
  }));
  const legacyAuditRows = documents.audit.audit.map((document) => ({
    event_key: `legacy:${hashDocument(document)}`,
    target_id: document.target ?? null,
    actor: document.actor || "legacy-json",
    action: document.action || "import",
    detail: document.detail || "Imported legacy audit event.",
    after_row: document,
    occurred_at: document.at || null,
  }));
  const snapshot = {
    documents,
    artifacts,
    manifestDocument,
    manifestSha,
    importId,
    git,
    entityRows,
    artifactRows,
    legacyAuditRows,
  };
  validateSnapshot(snapshot);
  return snapshot;
}

export function listMigrationFiles() {
  if (!existsSync(MIGRATIONS_DIR)) return [];
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => /^[0-9]+_[a-z0-9_-]+\.sql$/.test(name))
    .sort()
    .map((name) => ({
      name,
      path: join(MIGRATIONS_DIR, name),
      sql: canonicalRepoText(readFileSync(join(MIGRATIONS_DIR, name), "utf8")),
    }));
}

export function splitMigration(sqlText) {
  return sqlText
    .split(/^\s*--\s*statement-breakpoint\s*$/m)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function shortHash(hash) {
  return hash.slice(0, 12);
}

export function conciseIds(ids, limit = 12) {
  const values = [...ids];
  return values.length <= limit
    ? values.join(", ")
    : `${values.slice(0, limit).join(", ")} (+${values.length - limit})`;
}
