// Loads the schema and the synthetic fixtures into the hosted database named by DATABASE_URL.
// Run: npm run db:remote (reads .env.remote.local). The hosted app never creates or seeds on its own.
import { fixturesDir } from '../lib/db';
import { openRemote } from '../lib/pgRemote';
import { SCHEMA } from '../lib/schema';
import { seed } from '../lib/seed';

const url = process.env.DATABASE_URL;
if (!process.argv.includes('--remote') || !url) {
  console.error('Refusing to run. This wipes the app tables in a hosted database.');
  console.error('Pass --remote and set DATABASE_URL (npm run db:remote reads .env.remote.local).');
  process.exit(1);
}

// Only what SCHEMA itself creates is dropped, so other tables in the database stay.
const tables = [...SCHEMA.matchAll(/^CREATE TABLE (\w+)/gm)].map((m) => m[1]);
const functions = [...SCHEMA.matchAll(/^CREATE FUNCTION (\w+)/gm)].map((m) => m[1]);

console.log(`WARNING: dropping and recreating ${tables.length} tables (${tables.join(', ')}) on ${new URL(url).hostname}. Their data is lost.`);

const remote = openRemote(url);
try {
  await remote.transaction(async (tx) => {
    await tx.exec(`DROP TABLE IF EXISTS ${tables.join(', ')} CASCADE`);
    for (const f of functions) await tx.exec(`DROP FUNCTION IF EXISTS ${f}() CASCADE`);
    await tx.exec(SCHEMA);
    await seed(tx, fixturesDir());
    // The app connects as the table owner, which RLS does not bind. With no policies, the public anon key reads nothing.
    const { rows } = await tx.query<{ tablename: string }>(`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`);
    for (const { tablename } of rows) await tx.exec(`ALTER TABLE public."${tablename}" ENABLE ROW LEVEL SECURITY`);
    console.log(`Row level security on for ${rows.length} tables, no policies.`);
  });
  const { rows } = await remote.query<{ n: number }>(`SELECT count(*)::int AS n FROM tasks`);
  console.log(`Done. ${rows[0].n} tasks seeded.`);
} finally {
  await remote.end();
}
