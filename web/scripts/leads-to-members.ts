// One-off (15 Nov, the PM's call): the team Lead role is retired. Everyone who holds it becomes a Member (their member
// row stays; only the lead row goes). Admins stay admins. Leadership is given later, by an admin, on the Roster.
// Run once on the hosted database, after `npm run db:upgrade`:
//   npm run db:leads-to-members            lists who would change, changes nothing
//   npm run db:leads-to-members -- --apply  makes the change
// Rollback: give each listed person the role back, e.g. INSERT INTO team_members (team_id, person_id, app_role)
// VALUES ('<team>', '<person>', 'lead'); the list this prints is the record of who they were.
import { openRemote } from '../lib/pgRemote';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Set DATABASE_URL (npm run db:leads-to-members reads .env.remote.local).');
  process.exit(1);
}
const apply = process.argv.includes('--apply');
const remote = openRemote(url);
try {
  const { rows } = await remote.query<{ team_id: string; person_id: string; name: string; admin: boolean }>(
    `SELECT m.team_id, m.person_id, p.display_name AS name,
            EXISTS (SELECT 1 FROM team_members a WHERE a.team_id = m.team_id AND a.person_id = m.person_id AND a.app_role = 'admin') AS admin
       FROM team_members m JOIN people p ON p.id = m.person_id WHERE m.app_role = 'lead' ORDER BY p.display_name`);
  if (!rows.length) console.log('No one holds the Lead role. Nothing to do.');
  for (const r of rows) console.log(`${r.team_id}  ${r.person_id}  ${r.name}${r.admin ? '  (admin: stays admin)' : '  -> Member'}`);
  if (rows.length && apply) {
    await remote.query(`DELETE FROM team_members WHERE app_role = 'lead'`);
    console.log(`Done on ${new URL(url).hostname}: ${rows.length} lead ${rows.length === 1 ? 'row' : 'rows'} removed.`);
  } else if (rows.length) console.log('Listed only. Add -- --apply to make the change.');
} finally {
  await remote.end();
}
