import { notFound } from 'next/navigation';
import { requireMe } from '@/lib/auth';
import { mayReadActivity, teamActivity, type Counts } from '@/lib/activity';
import { db, scoped } from '@/lib/db';
import { Person } from '@/components/chips';
import { fmtDate, fmtStamp } from '@/lib/time';

export const dynamic = 'force-dynamic';

// The activity log, for the admins running the pilot (lib/activity.ts mayReadActivity). Anyone else gets a 404.
export default async function Activity() {
  const me = await requireMe();
  if (!mayReadActivity(me)) notFound();
  const { rows, since } = await teamActivity(scoped(await db(), me.team.id), me.team.id);
  const opened = rows.filter((r) => r.days.week > 0).length;
  const acted = rows.filter((r) => r.changes.week + r.comments.week + r.chat.week > 0).length;
  const n = (c: Counts) => <>{c.week}{'\u00a0'}<span className="dim">/{'\u00a0'}{c.month}</span></>; // never wraps
  return (
    <>
      <div className="page-head"><h1>Activity</h1></div>
      <p className="lede">
        In the last 7 days, {opened} of {rows.length} people opened the app and {acted} changed, commented or chatted.
        Each column shows the last 7 days, then the last 30.{' '}
        {since ? `Visits count from ${fmtDate(since)}.` : 'Visits count from the first sign-in after this page went live.'}
      </p>
      <div className="card table-card"><table className="stacked">
        <thead><tr><th>Name</th><th>Days opened</th><th>Last opened</th><th>Changes</th><th>Comments</th><th>Chat</th><th>Last change or comment</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td><Person name={r.name} id={r.id} /></td>
              <td data-label="Days opened">{n(r.days)}</td>
              <td className="due" data-label="Last opened">{r.lastVisit ? fmtDate(r.lastVisit) : <span className="dim">not yet</span>}</td>
              <td data-label="Changes">{n(r.changes)}</td>
              <td data-label="Comments">{n(r.comments)}</td>
              <td data-label="Chat">{n(r.chat)}</td>
              <td className="due" data-label="Last change">{r.lastAction ? fmtStamp(r.lastAction) : <span className="dim">none</span>}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </>
  );
}
