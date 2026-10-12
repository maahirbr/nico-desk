// Adds project archiving to the hosted database named by DATABASE_URL: two columns on projects, and the
// reassigned_away notice kind. Keeps all data; every statement is idempotent. No new table, so no new RLS step
// (projects and notices already have row level security on with no policies).
// Run: npx tsx --env-file=.env.remote.local scripts/upgrade-project-archive.ts
import { PROJECT_ARCHIVE_UPGRADE } from '../lib/db';
import { openRemote } from '../lib/pgRemote';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Set DATABASE_URL (run with --env-file=.env.remote.local).');
  process.exit(1);
}
const remote = openRemote(url);
try {
  await remote.exec(PROJECT_ARCHIVE_UPGRADE);
  const { rows } = await remote.query<{ n: number }>(`SELECT count(*)::int AS n FROM projects WHERE archived_at IS NOT NULL`);
  console.log(`Project archive ready on ${new URL(url).hostname}: ${rows[0].n} archived projects. Nothing deleted.`);
} finally {
  await remote.end();
}
