// Adds the task_links table to the hosted database named by DATABASE_URL. Keeps all data; every statement is idempotent.
// Row level security goes on with no policies, like every other table, so the public anon key reads nothing.
// Run: npx tsx --env-file=.env.remote.local scripts/upgrade-task-links.ts
import { TASK_LINKS_UPGRADE } from '../lib/db';
import { openRemote } from '../lib/pgRemote';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Set DATABASE_URL (run with --env-file=.env.remote.local).');
  process.exit(1);
}
const remote = openRemote(url);
try {
  await remote.exec(TASK_LINKS_UPGRADE);
  await remote.exec(`ALTER TABLE public.task_links ENABLE ROW LEVEL SECURITY`);
  const { rows } = await remote.query<{ n: number }>(`SELECT count(*)::int AS n FROM task_links`);
  console.log(`task_links ready on ${new URL(url).hostname}: ${rows[0].n} links, row level security on, no policies. Nothing deleted.`);
} finally {
  await remote.end();
}
