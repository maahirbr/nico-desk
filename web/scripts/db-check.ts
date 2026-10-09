import { sql } from "drizzle-orm";
import { getDb, getClient, isHostedDb, rowsOf } from "../lib/db/client";
import { runMigrations } from "../lib/db/migrate";

async function main() {
  // Migrating is a write, so a hosted database needs --remote, as with the seed.
  if (isHostedDb() && !process.argv.includes("--remote")) {
    console.error("db-check refused: DATABASE_URL is set. Pass --remote to check that database, or unset it for the local one.");
    process.exitCode = 1;
    return;
  }
  await runMigrations();
  const res = await getDb().execute(sql`select 1 as ok`);
  console.log(rowsOf(res)[0]?.ok === 1 ? "ok" : "fail");
  await getClient().close();
}
main();
