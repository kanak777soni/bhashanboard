import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

function source(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("the Ledger exists only inside the protected Board Desk", () => {
  const navigation = source("lib/site-navigation.ts");
  const adminLayout = source("app/admin/layout.tsx");
  const adminLedger = source("app/admin/ledger/page.tsx");
  const sitemap = source("app/sitemap.ts");
  const robots = source("app/robots.ts");

  assert.doesNotMatch(navigation, /href:\s*["']\/ledger["']/);
  assert.match(adminLayout, /href:\s*["']\/admin\/ledger["']/);
  assert.match(adminLedger, /await requireAdmin\(\)/);
  assert.doesNotMatch(sitemap, /["']\/ledger["']/);
  assert.match(robots, /["']\/admin["']/);
  assert.equal(
    existsSync(new URL("../app/ledger/page.tsx", import.meta.url)),
    false,
  );
});

test("public pages no longer send visitors to the protected Ledger", () => {
  const publicSources = [
    source("components/CoverageNote.tsx"),
    source("app/party/[code]/page.tsx"),
    source("app/terms/page.tsx"),
  ].join("\n");

  assert.doesNotMatch(publicSources, /href=["']\/ledger["']/);
});
