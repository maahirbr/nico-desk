// Applies the in-place schema steps from lib/db.ts (upgrade) to the hosted database named by DATABASE_URL.
// Keeps all data: each step is idempotent and only changes constraints. Run: npm run db:upgrade (reads .env.remote.local).
import { upgrade } from '../lib/db';
import { openRemote } from '../lib/pgRemote';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Set DATABASE_URL (npm run db:upgrade reads .env.remote.local).');
  process.exit(1);
}
const remote = openRemote(url);
try {
  await upgrade(remote);
  console.log(`Schema steps applied on ${new URL(url).hostname}. No data changed.`);
} finally {
  await remote.end();
}
