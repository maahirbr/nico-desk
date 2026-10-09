import { sql } from "drizzle-orm";
import { getDb, getClient } from "../lib/db/client";
import { runMigrations } from "../lib/db/migrate";

async function main() {
  await runMigrations();
  const res = await getDb().execute(sql`select 1 as ok`);
  console.log(res.rows[0]?.ok === 1 ? "ok" : "fail");
  await getClient().close();
}
main();
