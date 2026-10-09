// Reads fixtures/*.json. Each file is named after its table and holds an array of rows
// whose keys are the DDL column names.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const FIXTURES_DIR = process.env.FIXTURES_DIR ?? path.join(process.cwd(), "..", "fixtures");
export const FIXTURE_NAMES = [
  "people",
  "teams",
  "team_members",
  "projects",
  "tasks",
  "events",
  "notes",
] as const;
export type FixtureName = (typeof FIXTURE_NAMES)[number];
export type Fixtures = Record<FixtureName, Record<string, unknown>[]>;

export function missingFixtures(): string[] {
  return FIXTURE_NAMES.filter((n) => !existsSync(path.join(FIXTURES_DIR, `${n}.json`))).map((n) => `${n}.json`);
}

export function readFixture(name: FixtureName): Record<string, unknown>[] {
  const rows = JSON.parse(readFileSync(path.join(FIXTURES_DIR, `${name}.json`), "utf8"));
  if (!Array.isArray(rows)) throw new Error(`fixtures/${name}.json must hold an array of rows`);
  return rows;
}

export function readAllFixtures(): Fixtures {
  return Object.fromEntries(FIXTURE_NAMES.map((n) => [n, readFixture(n)])) as Fixtures;
}
