import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ACTIVE_MARKS = [
  "logic_damage",
  "reality_gap",
  "straight_face",
  "rewatch_value",
] as const;

test("every corpus statement has a complete four-mark editorial profile", async () => {
  const document = JSON.parse(
    await readFile(new URL("../data/statements.json", import.meta.url), "utf8"),
  ) as {
    statements: Array<{
      id: string;
      axes: Record<string, unknown>;
    }>;
  };

  assert.equal(document.statements.length, 45);
  assert.equal(new Set(document.statements.map(({ id }) => id)).size, 45);

  for (const statement of document.statements) {
    for (const mark of ACTIVE_MARKS) {
      const value = statement.axes[mark];
      assert.equal(
        Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 5,
        true,
        `${statement.id} has an invalid ${mark} editorial mark`,
      );
    }
  }
});

test("the live database backfill carries the exact reviewed corpus marks", async () => {
  const [document, migration] = await Promise.all([
    readFile(new URL("../data/statements.json", import.meta.url), "utf8").then(
      (source) =>
        JSON.parse(source) as {
          statements: Array<{ id: string; axes: Record<string, number> }>;
        },
    ),
    readFile(
      new URL(
        "../db/migrations/0014_editorial_profile_backfill.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);
  const rows = [...migration.matchAll(
    /\('(IN-\d{4})',\s*([0-5]),\s*([0-5]),\s*([0-5]),\s*([0-5])\)/g,
  )];
  const backfill = new Map(
    rows.map(([, id, logic, reality, confidence, comic]) => [
      id,
      [logic, reality, confidence, comic].map(Number),
    ]),
  );

  assert.equal(rows.length, document.statements.length);
  assert.equal(backfill.size, document.statements.length);
  for (const statement of document.statements) {
    assert.deepEqual(backfill.get(statement.id), [
      statement.axes.logic_damage,
      statement.axes.reality_gap,
      statement.axes.straight_face,
      statement.axes.rewatch_value,
    ]);
  }
});
