import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

function source(file: string): string {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

test("public legacy surfaces cannot fall back to the editorial seed ladder", () => {
  const files = [
    "app/hall/page.tsx",
    "app/duel/page.tsx",
    "app/statement/[slug]/opengraph-image.tsx",
    "components/StatementFooterNav.tsx",
  ];

  for (const file of files) {
    const text = source(file);
    assert.doesNotMatch(text, /data\.rankedStatements\s*\(/, file);
    assert.doesNotMatch(text, /data\.rankOf\s*\(/, file);
  }

  assert.match(source("app/hall/page.tsx"), /inventory\.rankedVideos/);
  assert.match(source("app/duel/page.tsx"), /inventory\.liveVideos/);
  assert.match(
    source("app/statement/[slug]/opengraph-image.tsx"),
    /inventory\.publicRankBySlug\.get/
  );
  assert.match(
    source("components/StatementFooterNav.tsx"),
    /inventory\.rankedVideos/
  );
});

test("dormant exhibitions are omitted from discovery until two videos are live", () => {
  const sitemap = source("app/sitemap.ts");
  assert.match(sitemap, /inventory\.liveVideos\.length\s*>=\s*2/);
  assert.doesNotMatch(sitemap, /^\s*"\/duel",\s*$/m);
});

test("Hall induction is gated by public maturity and current hosted evidence", () => {
  const hall = source("app/admin/hall/page.tsx");
  const actions = source("app/admin/actions.ts");

  assert.match(hall, /publicRankedStatements\s*\(/);
  assert.match(hall, /statementReadiness\(s\)\.key\s*===\s*"live"/);
  assert.match(actions, /publicData\.publicRankOf\(publicStatement\.slug\)/);
  assert.match(actions, /verifyExistingCloudinaryVideo\(storedVideo\)/);
});

test("new filings and in-placement filings remain distinct in public copy", () => {
  for (const file of ["app/page.tsx", "components/Ticker.tsx"]) {
    const text = source(file);
    assert.match(text, /validVoteCount\s*===\s*0/, file);
    assert.match(text, /validVoteCount\s*>\s*0/, file);
    assert.match(text, /validVoteCount\s*<\s*10/, file);
  }
});

test("public movement never borrows the corpus's editorial previous rank", () => {
  assert.doesNotMatch(source("lib/query.ts"), /s\.previousRank/);
  assert.doesNotMatch(source("components/QueryForm.tsx"), /Biggest climber/);
  assert.match(source("components/StandingsTable.tsx"), /showMovement/);
});

test("debounced search merges into the latest filter state", () => {
  const queryForm = source("components/QueryForm.tsx");
  assert.match(queryForm, /latestQuery\.current\s*=\s*query/);
  assert.match(queryForm, /\.\.\.latestQuery\.current,\s*\.\.\.patch/);
});

test("admin task links and research cards preserve the state they describe", () => {
  const overview = source("app/admin/page.tsx");
  const entries = source("app/admin/entries/page.tsx");
  const researchCard = source("components/public/ResearchEntryCard.tsx");

  assert.match(overview, /filter=unverified/);
  assert.match(
    entries,
    /unverified:\s*\{[^}]*verification\.stage\s*===\s*"text_sourced"/s
  );
  assert.doesNotMatch(researchCard, /if\s*\(\s*statement\.held\s*\)/);
  assert.match(researchCard, /if\s*\(\s*statement\.video\s*\)/);
  assert.match(researchCard, /Awaiting verified footage/);
});
