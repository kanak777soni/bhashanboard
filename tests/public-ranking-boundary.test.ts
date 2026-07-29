import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { DEFAULTS } from "../lib/query";
import { mergeQueryUpdate } from "../components/QueryForm";

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

test("the public vote-state endpoint cannot resolve private or review records", () => {
  assert.match(
    source("lib/vote-store.ts"),
    /WHERE statement\.id = \$\{statementId\}\s+AND statement\.status = 'published'/
  );
  assert.match(
    source("lib/vote-store.ts"),
    /committeePublicationIssues\(row\.record_document\)\.length > 0/
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

test("standings omit movement until public rank history is persisted", () => {
  assert.doesNotMatch(source("lib/query.ts"), /s\.previousRank/);
  assert.doesNotMatch(source("components/QueryForm.tsx"), /Biggest climber/);
  const table = source("components/StandingsTable.tsx");
  assert.doesNotMatch(table, /showMovement|function Movement|c-move|&plusmn;/);
});

test("search and filter updates compose in either event order", () => {
  const filterThenSearch = mergeQueryUpdate(
    mergeQueryUpdate(DEFAULTS, { party: "INC" }),
    { q: "monsoon" }
  );
  assert.equal(filterThenSearch.party, "INC");
  assert.equal(filterThenSearch.q, "monsoon");

  const pendingSearchThenFilter = mergeQueryUpdate(
    DEFAULTS,
    { party: "BJP" },
    "committee"
  );
  assert.equal(pendingSearchThenFilter.party, "BJP");
  assert.equal(pendingSearchThenFilter.q, "committee");
});

test("QueryForm stages router destinations before later debounced updates", () => {
  const queryForm = source("components/QueryForm.tsx");
  assert.match(
    queryForm,
    /useEffect\(\(\) => \{\s*latestQuery\.current = query;\s*\}, \[query\]\)/
  );
  assert.match(
    queryForm,
    /latestQuery\.current = nextQuery;\s*router\.push/
  );
  assert.match(queryForm, /push\(\{ \[id\]: e\.target\.value \}[\s\S]*true/);
});

test("admin task links and research cards follow the clip-first workflow", () => {
  const overview = source("app/admin/page.tsx");
  const entries = source("app/admin/entries/page.tsx");
  const researchCard = source("components/public/ResearchEntryCard.tsx");

  assert.match(overview, /filter=ready/);
  assert.match(overview, /filter=novideo/);
  assert.match(
    entries,
    /ready:\s*\{[^}]*statementReadiness\(statement\)\.key\s*===\s*"ready"/s
  );
  assert.doesNotMatch(overview, /filter=unverified/);
  assert.doesNotMatch(entries, /verification\.stage\s*===\s*"text_sourced"/);
  assert.doesNotMatch(researchCard, /if\s*\(\s*statement\.held\s*\)/);
  assert.match(researchCard, /if\s*\(\s*statement\.video\s*\)/);
  assert.match(researchCard, /Clip wanted/);
});
