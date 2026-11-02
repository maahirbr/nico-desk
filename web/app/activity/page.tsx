import { notFound } from 'next/navigation';
import { requireMe } from '@/lib/auth';
import { mayReadActivity, teamAdoption } from '@/lib/activity';
import { db, scoped } from '@/lib/db';
import { today } from '@/lib/time';
import { ActivityView } from '@/components/ActivityView';

export const dynamic = 'force-dynamic';

// Who is using NicoDesk, for the admins running the pilot (lib/activity.ts mayReadActivity). Anyone else gets a 404.
export default async function Activity() {
  const me = await requireMe();
  if (!mayReadActivity(me)) notFound();
  const rows = await teamAdoption(scoped(await db(), me.team.id), me.team.id);
  const signedIn = rows.filter((r) => r.status !== 'never').length;
  return (
    <>
      <div className="page-head"><h1>Activity</h1></div>
      <p className="lede">{signedIn} of {rows.length} people have signed in. Press a tile to see only those people.</p>
      <ActivityView rows={rows} today={today()} readOnly={!!me.viewingAs} />
    </>
  );
}
