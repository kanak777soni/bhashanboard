import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const feedSource = fs.readFileSync(
  path.join(root, "components", "public", "WatchScreeningFeed.tsx"),
  "utf8"
);
const routeSource = fs.readFileSync(
  path.join(root, "app", "watch", "page.tsx"),
  "utf8"
);
const votingPanelSource = fs.readFileSync(
  path.join(root, "components", "StatementVotingPanel.tsx"),
  "utf8"
);

test("the watch route uses the compact screening shell", () => {
  assert.match(routeSource, /import ScreeningFrame/);
  assert.match(routeSource, /<ScreeningFrame>/);
});

test("the watch feed mounts exactly one voting player for its active filing", () => {
  assert.equal(
    (feedSource.match(/<StatementVotingPanel\b/g) ?? []).length,
    1
  );
  assert.match(feedSource, /const active = entries\[activeIndex\]/);
  assert.match(feedSource, /key=\{active\.statementId\}/);
  assert.doesNotMatch(
    feedSource,
    /entries\.map\([^)]*StatementVotingPanel/s
  );
  assert.match(feedSource, /resultsMode="after-vote"/);
  assert.match(feedSource, /resultAward=\{\{/);
});

test("feed shortcuts stay scoped away from media and interactive controls", () => {
  assert.doesNotMatch(feedSource, /window\.addEventListener\(\s*["']keydown/);
  assert.match(feedSource, /onKeyDown=\{handleFeedKeyDown\}/);
  for (const protectedTarget of ["a,", "button,", "video,", "iframe,", "[role]"]) {
    assert.ok(feedSource.includes(protectedTarget), protectedTarget);
  }
});

test("the active heading receives focus only after user navigation", () => {
  assert.match(feedSource, /userNavigatedRef\.current = true/);
  assert.match(
    feedSource,
    /if \(!userNavigatedRef\.current\) return;\s*headingRef\.current\?\.focus/
  );
});

test("Watch keeps aggregate results covered until the member has voted", () => {
  assert.match(
    votingPanelSource,
    /resultsMode === "always" \|\| Boolean\(currentVote\)/
  );
  assert.match(
    votingPanelSource,
    /revealPublicResults && rating\.validVoteCount > 0/
  );
  assert.match(
    votingPanelSource,
    /Results reveal after your vote/
  );
});
