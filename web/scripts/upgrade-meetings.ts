// Adds the meeting rhythm to the hosted database named by DATABASE_URL: four columns on projects (meet_every,
// meet_day, meet_next, meet_last). Keeps all data; every statement is idempotent. No new table, so no new RLS step
// (projects already has row level security on with no policies).
// Run: npx tsx --env-file=.env.remote.local scripts/upgrade-meetings.ts
import { MEETINGS_UPGRADE } from '../lib/db';
import { openRemote } from '../lib/pgRemote';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Set DATABASE_URL (run with --env-file=.env.remote.local).');
  process.exit(1);
}
const remote = openRemote(url);
try {
  await remote.exec(MEETINGS_UPGRADE);
  const { rows } = await remote.query<{ n: number }>(`SELECT count(*)::int AS n FROM projects WHERE meet_every IS NOT NULL`);
  console.log(`Meeting rhythm ready on ${new URL(url).hostname}: ${rows[0].n} projects with a rhythm. Nothing deleted.`);
} finally {
  await remote.end();
}
