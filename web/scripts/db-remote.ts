// Loads the schema and the synthetic fixtures into the hosted database named by DATABASE_URL.
// Run: npm run db:remote (reads .env.remote.local). Page loads never create or seed; the weekly cron (app/api/cron/reseed) runs the same body.
import { openRemote } from '../lib/pgRemote';
import { reseed, schemaTables } from '../lib/reseed';

const url = process.env.DATABASE_URL;
if (!process.argv.includes('--remote') || !url) {
  console.error('Refusing to run. This wipes the app tables in a hosted database.');
  console.error('Pass --remote and set DATABASE_URL (npm run db:remote reads .env.remote.local).');
  process.exit(1);
}

const tables = schemaTables();

console.log(`WARNING: dropping and recreating ${tables.length} tables (${tables.join(', ')}) on ${new URL(url).hostname}. Their data is lost.`);

const remote = openRemote(url);
try {
  const n = await remote.transaction((tx) => reseed(tx));
  console.log(`Row level security on for ${n} tables, no policies.`);
  const { rows } = await remote.query<{ n: number }>(`SELECT count(*)::int AS n FROM tasks`);
  console.log(`Done. ${rows[0].n} tasks seeded.`);
} finally {
  await remote.end();
}
