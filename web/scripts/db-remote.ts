// Loads the schema and the synthetic fixtures, or the git-ignored roster.local.json and projects.local.json when present, into the hosted database named by DATABASE_URL.
// Run: npm run db:remote (reads .env.remote.local). Page loads never create or seed; app/api/cron/reseed runs the same body.
import { openRemote } from '../lib/pgRemote';
import path from 'node:path';
import { rosterFile } from '../lib/db';
import { reseed, schemaTables } from '../lib/reseed';
import { loadLocalProjects, loadRosterOverlay } from '../lib/seed';

const url = process.env.DATABASE_URL;
if (!process.argv.includes('--remote') || !url) {
  console.error('Refusing to run. This wipes the app tables in a hosted database.');
  console.error('Pass --remote and set DATABASE_URL (npm run db:remote reads .env.remote.local).');
  process.exit(1);
}

const tables = schemaTables();

console.log(`WARNING: dropping and recreating ${tables.length} tables (${tables.join(', ')}) on ${new URL(url).hostname}. Their data is lost.`);

const roster = rosterFile();
const overlay = loadRosterOverlay(roster);
const local = loadLocalProjects(path.join(path.dirname(roster), 'projects.local.json'));
console.log(local ? `Loading ${local.drop_samples ? 'only ' : ''}the local projects (${local.task_projects?.length ?? 0} task projects).` : 'Loading the synthetic fixtures.');

const remote = openRemote(url);
try {
  const n = await remote.transaction((tx) => reseed(tx, undefined, overlay, local));
  console.log(`Row level security on for ${n} tables, no policies.`);
  const { rows } = await remote.query<{ n: number }>(`SELECT count(*)::int AS n FROM tasks`);
  console.log(`Done. ${rows[0].n} tasks seeded.`);
} finally {
  await remote.end();
}
