import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const routes = [
  "app/netas/page.tsx",
  "app/neta/[slug]/page.tsx",
  "app/party/[code]/page.tsx",
  "app/category/[slug]/page.tsx",
  "app/compare/[pair]/page.tsx",
];

const sourceByRoute = new Map(
  routes.map((route) => [
    route,
    readFileSync(path.join(process.cwd(), route), "utf8"),
  ])
);

test("legacy public entity routes never use the editorial seed ladder", () => {
  for (const [route, source] of sourceByRoute) {
    assert.doesNotMatch(source, /data\.rankedStatements\s*\(/, route);
    assert.doesNotMatch(source, /data\.rankOf\s*\(/, route);
    assert.doesNotMatch(source, /@\/components\/Medal/, route);
    assert.doesNotMatch(source, /@\/lib\/tiers/, route);
    assert.doesNotMatch(source, /\bCareer GP\b|\bPeak rating\b/, route);
  }
});

test("rank-capable legacy routes use only public inventory selectors", () => {
  for (const route of [
    "app/neta/[slug]/page.tsx",
    "app/party/[code]/page.tsx",
    "app/category/[slug]/page.tsx",
    "app/compare/[pair]/page.tsx",
  ]) {
    const source = sourceByRoute.get(route) ?? "";
    assert.match(
      source,
      /data\s*\.\s*publicRankedStatements\s*\(/,
      route
    );
    assert.match(source, /data\s*\.\s*publicRankOf\s*\(/, route);
  }
  assert.match(
    sourceByRoute.get("app/netas/page.tsx") ?? "",
    /data\.publicInventory\s*\(/
  );
});

test("all five routes retain the complete visible corpus for research browsing", () => {
  for (const [route, source] of sourceByRoute) {
    assert.match(source, /data\.CORPUS/, route);
  }
});
