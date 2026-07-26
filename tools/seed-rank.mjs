#!/usr/bin/env node
/**
 * seed-rank — validate the seed corpus, enforce the parity cap, and derive a
 * provisional ladder from the published rubric.
 *
 *   node tools/seed-rank.mjs          # validate + report, write nothing
 *   node tools/seed-rank.mjs --write  # also write data/generated/leaderboard.json
 *
 * WHY THIS EXISTS. Placement is supposed to come from duels (docs/02 §2.3), and
 * duels need a corpus, and a corpus needs a ladder to be worth duelling over.
 * This script breaks that circle exactly once: it converts published rubric
 * scores into a starting ladder calibrated to the target tier rarities, so the
 * board shows Bronze through Kohinoor on day one instead of a wall of Gold.
 *
 * Every rating it produces is provisional and is overwritten by Elo the moment
 * real duels land. It is scaffolding. Delete it when the duel engine ships.
 *
 * No dependencies, no network. Node 18+.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));

/* ── the rubric ────────────────────────────────────────────────────────────
   Published, because an undisclosed editorial taste is indefensible and a
   written criterion is not (docs/04-legal-and-safety.md §4.2). Weights sum
   to 1. Change them here and the whole ladder recomputes — that is the point.  */
const WEIGHTS = {
  logic_damage: 0.30,     // was a checkable claim about reality broken, and how badly
  straight_face: 0.20,    // delivered as settled fact, in an official setting
  rewatch_value: 0.20,    // does it survive retelling without the video
  crowd_complicity: 0.15, // did the room go along with it
  consequence: 0.15       // 5 = no consequence or promoted since; 0 = resigned or sacked
};

/* Target rarities from docs/02-ranking-system.md §2.4, low tier first. */
const TIERS = [
  { key: "participation", name: "Participation Certificate", rarity: 28.0, lo: 1150, hi: 1299 },
  { key: "bronze",        name: "Bronze Bhashan",            rarity: 24.0, lo: 1300, hi: 1449 },
  { key: "silver",        name: "Silver Tongue",             rarity: 21.0, lo: 1450, hi: 1599 },
  { key: "gold",          name: "Gold Standard",             rarity: 16.0, lo: 1600, hi: 1749 },
  { key: "diamond",       name: "Diamond Gyan",              rarity:  8.0, lo: 1750, hi: 1874 },
  { key: "kohinoor",      name: "Kohinoor Class",            rarity:  2.5, lo: 1875, hi: 1975 }
];

const PARTY_CAP = 0.30; // docs/03-content-pipeline.md §3.4 — no party above 30% of the seed

/* ── load ─────────────────────────────────────────────────────────────────── */
const corpus = read("data/statements.json");
const parties = new Map(read("data/parties.json").parties.map((p) => [p.id, p]));
const politicians = new Map(read("data/politicians.json").politicians.map((p) => [p.id, p]));
const statements = corpus.statements;

const errors = [];
const warnings = [];
const err = (id, m) => errors.push(`${id}: ${m}`);
const warn = (id, m) => warnings.push(`${id}: ${m}`);

/* ── validate ─────────────────────────────────────────────────────────────── */
const seen = new Set();
const TIER_RANK = { A: 3, B: 2, C: 1, D: 0 };

for (const s of statements) {
  if (seen.has(s.id)) err(s.id, "duplicate id");
  seen.add(s.id);

  if (!politicians.has(s.speaker_id)) err(s.id, `unknown speaker_id "${s.speaker_id}"`);
  if (!parties.has(s.party_at_time)) err(s.id, `unknown party_at_time "${s.party_at_time}"`);

  // The verbatim doctrine, enforced rather than asserted.
  if (s.quote === null && !s.quote_note) err(s.id, "quote is null and quote_note is missing — say why, and say what is needed");
  if (typeof s.quote === "string" && s.quote.trim() === "") err(s.id, 'empty quote string — use null, not ""');

  // A title that renders a verdict is a defamation problem, not a style problem.
  if (!/^On /.test(s.neutral_title)) warn(s.id, `neutral_title should state what was claimed ("On …"), got "${s.neutral_title}"`);

  const v = s.verification;
  if (!v.sources?.length) err(s.id, "no sources");
  const best = v.sources.reduce((a, x) => (TIER_RANK[x.tier] > TIER_RANK[a] ? x.tier : a), "D");
  if (best !== v.best_source_tier) err(s.id, `best_source_tier is "${v.best_source_tier}" but the best source listed is "${best}"`);
  if (TIER_RANK[best] < TIER_RANK.B) warn(s.id, `no Tier A or B source — unpublishable under §3.2 until one is found`);
  if (v.sources.length < 2) warn(s.id, "single-sourced — §3.2 requires corroboration below Tier A");
  if (v.stage !== "committee_passed") warn(s.id, `stage is "${v.stage}" — not publishable`);

  for (const [axis, val] of Object.entries(s.axes)) {
    if (!(axis in WEIGHTS)) err(s.id, `unknown axis "${axis}"`);
    if (!Number.isInteger(val) || val < 0 || val > 5) err(s.id, `axis ${axis} must be an integer 0–5, got ${val}`);
  }
  for (const axis of Object.keys(WEIGHTS)) if (!(axis in s.axes)) err(s.id, `missing axis "${axis}"`);
}

/* ── score and rank the published set ─────────────────────────────────────── */
const score = (s) => Object.entries(WEIGHTS).reduce((t, [k, w]) => t + (s.axes[k] ?? 0) * w, 0);

const published = statements
  .filter((s) => s.status === "published")
  .map((s) => ({ s, score: score(s) }))
  // ascending, so percentile 0 is the bottom of the ladder. Ties break on id for determinism.
  .sort((a, b) => a.score - b.score || a.s.id.localeCompare(b.s.id));

const totalRarity = TIERS.reduce((t, x) => t + x.rarity, 0);
let acc = 0;
const bands = TIERS.map((t) => {
  const from = acc / totalRarity;
  acc += t.rarity;
  return { ...t, from, to: acc / totalRarity };
});

const N = published.length;
const ladder = published.map((row, i) => {
  const p = N === 1 ? 0.5 : (i + 0.5) / N;
  const band = bands.find((b) => p >= b.from && p < b.to) ?? bands.at(-1);
  const within = (p - band.from) / (band.to - band.from);
  const gp = Math.round(band.lo + within * (band.hi - band.lo));
  return { ...row, gp, tier: band.key, tierName: band.name };
});

// Rank 1 is the top of the board.
ladder.reverse().forEach((row, i) => (row.rank = i + 1));

/* ── parity ───────────────────────────────────────────────────────────────── */
const tally = (list) => {
  const m = new Map();
  for (const s of list) m.set(s.party_at_time, (m.get(s.party_at_time) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};

const pubParty = tally(published.map((r) => r.s));
for (const [party, n] of pubParty) {
  const share = n / N;
  if (share > PARTY_CAP + 1e-9) {
    err("PARITY", `${party} is ${(share * 100).toFixed(1)}% of the published seed — the cap is ${PARTY_CAP * 100}%. Hold entries (status: held_parity) or source more from other parties.`);
  }
}

/* Counting parity is not the same as position parity. A board that is 30/30 by
   headcount but whose entire top tier belongs to one party reads as partisan on
   sight, because nobody counts — they look at the podium. Measured here so it
   cannot be quietly ignored; it is a warning rather than an error because the
   fix is more corpus, never a thumb on the ladder. */
const HEAD = Math.max(3, Math.ceil(ladder.length / 3));
const headTally = tally(ladder.slice(0, HEAD).map((r) => r.s));
const [headParty, headCount] = headTally[0] ?? [null, 0];
if (headParty && headCount / HEAD > 0.5) {
  warn("LADDER-HEAD", `${headParty} holds ${headCount} of the top ${HEAD} places (${pct0(headCount, HEAD)}). Headcount parity is satisfied; position parity is not. Source higher-scoring entries from other parties — do not adjust ratings.`);
}
function pct0(n, d) { return `${((n / d) * 100).toFixed(0)}%`; }

/* ── report ───────────────────────────────────────────────────────────────── */
const pct = (n, d) => `${((n / d) * 100).toFixed(1)}%`;
const held = statements.filter((s) => s.status !== "published");

console.log(`\nTHE BHASHAN BOARD — seed corpus report`);
console.log(`corpus ${corpus.corpus} · version ${corpus.version} · compiled ${corpus.compiled}\n`);
console.log(`  entries indexed      ${statements.length}`);
console.log(`  published            ${N}`);
console.log(`  held for parity      ${statements.filter((s) => s.status === "held_parity").length}`);
console.log(`  held for review      ${statements.filter((s) => s.status === "held_review").length}`);
console.log(`  distinct speakers    ${new Set(statements.map((s) => s.speaker_id)).size}`);
console.log(`  distinct parties     ${new Set(statements.map((s) => s.party_at_time)).size}`);
console.log(`  distinct states      ${new Set(statements.map((s) => s.state)).size}`);
console.log(`  distinct languages   ${new Set(statements.map((s) => s.language)).size}`);
console.log(`  verbatim quotes      ${statements.filter((s) => s.quote).length} of ${statements.length}`);

console.log(`\nPARTY PARITY — published set (cap ${PARTY_CAP * 100}%)`);
for (const [party, n] of pubParty) {
  const flag = n / N > PARTY_CAP + 1e-9 ? "  ✗ OVER CAP" : "";
  console.log(`  ${party.padEnd(8)} ${String(n).padStart(3)}  ${pct(n, N).padStart(6)}${flag}`);
}
if (held.length) {
  console.log(`\n  held (not on the ladder)`);
  for (const [party, n] of tally(held)) console.log(`  ${party.padEnd(8)} ${String(n).padStart(3)}`);
}

console.log(`\nTIER SPREAD — provisional, seeded from the rubric`);
for (const t of [...bands].reverse()) {
  const n = ladder.filter((r) => r.tier === t.key).length;
  console.log(`  ${t.name.padEnd(26)} ${String(n).padStart(3)}  ${pct(n, N).padStart(6)}  target ${t.rarity}%`);
}

console.log(`\nLADDER`);
console.log(`  ${"#".padStart(3)}  ${"GP".padStart(5)}  ${"TIER".padEnd(12)} ${"PARTY".padEnd(8)} ENTRY`);
for (const r of ladder) {
  const who = politicians.get(r.s.speaker_id)?.name ?? r.s.speaker_id;
  console.log(`  ${String(r.rank).padStart(3)}  ${String(r.gp).padStart(5)}  ${r.tier.padEnd(12)} ${r.s.party_at_time.padEnd(8)} ${r.s.neutral_title} — ${who}`);
}

if (warnings.length) {
  console.log(`\nWARNINGS (${warnings.length}) — outstanding work, not failures`);
  const byKind = new Map();
  for (const w of warnings) {
    const kind = w.split(": ").slice(1).join(": ").replace(/"[^"]*"/g, "…");
    byKind.set(kind, [...(byKind.get(kind) ?? []), w]);
  }
  for (const [kind, list] of [...byKind.entries()].sort((a, b) => b[1].length - a[1].length)) {
    // One-offs are the interesting ones — print them in full rather than tallying them away.
    if (list.length === 1) console.log(`    1 × ${list[0]}`);
    else console.log(`  ${String(list.length).padStart(3)} × ${kind}`);
  }
}

if (errors.length) {
  console.log(`\nERRORS (${errors.length})`);
  for (const e of errors) console.log(`  ✗ ${e}`);
}

/* ── write ────────────────────────────────────────────────────────────────── */
if (process.argv.includes("--write")) {
  const out = {
    $comment: "GENERATED by tools/seed-rank.mjs — do not edit. Provisional ratings seeded from the published rubric, not from duels. Every entry here is `provisional: true` and is superseded the moment the Elo engine has real ballots.",
    generated_from: `data/statements.json@${corpus.version}`,
    method: "seed_rubric_v1",
    weights: WEIGHTS,
    party_cap: PARTY_CAP,
    entries: ladder.map((r) => ({
      id: r.s.id,
      rank: r.rank,
      gp: r.gp,
      tier: r.tier,
      tier_name: r.tierName,
      rubric_score: Number(r.score.toFixed(4)),
      provisional: true,
      duels: 0,
      speaker_id: r.s.speaker_id,
      party_at_time: r.s.party_at_time,
      neutral_title: r.s.neutral_title,
      category: r.s.category
    }))
  };
  const dest = join(ROOT, "data/generated/leaderboard.json");
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, JSON.stringify(out, null, 2) + "\n");
  console.log(`\nwrote data/generated/leaderboard.json`);
}

console.log("");
process.exit(errors.length ? 1 : 0);
