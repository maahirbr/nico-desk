import Link from 'next/link';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { requireMe } from '@/lib/auth';
import { lookups, one, type SP } from '@/lib/page';
import { seenProjects } from '@/lib/visibility';
import { seesProject } from '@/lib/sight';
import { reminderDrafts } from '@/lib/reminders';
import { staleAsks, ASK_STALE_DAYS } from '@/lib/asks';
import { AskReminders } from '@/components/AskReminders';
import { ReminderCards } from '@/components/Reminders';
import { gmailSendEnabled, gmailStatus } from '@/lib/gmailSend';
import { Select } from '@/components/Select';

export const dynamic = 'force-dynamic';

// What the Gmail connect callback came back with (app/api/auth/google/gmail/callback).
const GMAIL_SAID: Record<string, string> = {
  connected: 'Gmail is connected. Send now goes out from your address.',
  cancelled: 'Gmail was not connected. You can still open each draft in Gmail.',
  scopes: 'Gmail was not connected: the send permission was unticked on Google\'s screen. Try again and leave it ticked.',
  mismatch: 'Gmail was not connected: pick the Google account you sign in to nico-desk with.',
  state: 'Gmail was not connected: the link expired. Try again.',
  no_refresh: 'Gmail was not connected. Try again.',
  google: 'Gmail was not connected: Google returned an error. Try again in a moment.',
  email: 'Gmail was not connected: Google did not confirm the address. Try again.',
  viewing_as: 'Gmail cannot be connected while you view as someone else.',
  not_allowed: 'Only a lead can connect Gmail.',
};

export default async function Reminders({ searchParams }: { searchParams: SP }) {
  const me = await requireMe();
  const { d, sight, isLead, isAdmin, names } = await lookups(me);
  if (!isLead && !isAdmin) return (<><h1>Reminders</h1><p className="lede">Only a lead drafts reminders.</p></>);
  const sp = await searchParams;
  const mode = one(sp.mode) === 'window' ? 'window' : 'overdue';
  const days = Math.min(Math.max(Number(one(sp.days) ?? 2) || 2, 1), 30);
  const projectId = one(sp.project);
  if (projectId && !seesProject(sight, projectId)) notFound(); // hidden reads as missing
  const h = await headers();
  const appUrl = `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host') ?? 'localhost:3100'}/me`;
  const sendOn = gmailSendEnabled() && !me.viewingAs;
  const [{ drafts, skipped }, projects, asks, link] = await Promise.all([
    reminderDrafts(d, me.team.id, { mode, days, projectId, sight }, appUrl),
    seenProjects(d, me, sight),
    staleAsks(d, me, projectId),
    sendOn ? gmailStatus(d, me.realPerson.id) : null,
  ]);
  const send = { enabled: sendOn, connected: !!link?.connected, from: link?.email ?? me.person.email };
  const gmail = GMAIL_SAID[one(sp.gmail) ?? ''];
  // Who each ask waits on, with the address a draft would go to (the same rule as the reminder drafts).
  const { rows: owners } = asks.length ? await d.query<{ id: string; email: string; contact_email: string | null }>(
    `SELECT id, email, contact_email FROM people WHERE id = ANY($1)`, [[...new Set(asks.map((a) => a.ownerId))]]) : { rows: [] };
  const mail = new Map(owners.map((o) => [o.id, o.contact_email ?? (o.email.endsWith('@example.test') ? null : o.email)]));
  const first = (id: string) => (names[id] ?? 'Someone').split(' ')[0];
  const q = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const m = { mode, days: String(days), project: projectId, ...o };
    for (const [k, v] of Object.entries(m)) if (v) p.set(k, v);
    return `/reminders?${p}`;
  };
  return (
    <>
      <h1>Reminders</h1>
      <p className="lede">{sendOn
        ? 'One draft email per person, from the address you signed in with. Check it, then press Send, or open it in Gmail.'
        : 'One draft email per person. It opens in your Gmail, from the address you signed in with. Nothing is sent until you check it and press Send.'}</p>
      {gmail && <p className="small" role="status">{gmail}</p>}
      <form className="bar" action="/reminders" method="get">
        <span className="seg" role="group" aria-label="What to include">
          <Link href={q({ mode: 'overdue' })} className={`seg-link${mode === 'overdue' ? ' on' : ''}`}>Overdue only</Link>
          <Link href={q({ mode: 'window' })} className={`seg-link${mode === 'window' ? ' on' : ''}`}>Overdue + due soon</Link>
        </span>
        {mode === 'window' && (
          <label className="f" style={{ flex: '0 1 120px' }}><span>Due within (days)</span>
            <input type="number" name="days" min={1} max={30} defaultValue={days} />
          </label>
        )}
        <input type="hidden" name="mode" value={mode} />
        <label className="f" style={{ flex: '0 1 240px' }}><span>Project</span>
          <Select name="project" aria-label="Project" defaultValue={projectId ?? ''}>
            <option value="">All projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </label>
        <button className="btn ghost">Apply</button>
      </form>
      {asks.length > 0 && <AskReminders appUrl={appUrl} days={ASK_STALE_DAYS} items={asks.map((a) => ({
        id: a.id, taskId: a.taskId, title: a.title, ownerId: a.ownerId, ownerName: first(a.ownerId), askerName: first(a.askerId), question: a.question, days: a.days, to: mail.get(a.ownerId) ?? null,
      }))} />}
      {skipped.length > 0 && <p className="small dim">Not reminded, by choice: {skipped.join(', ')}.</p>}
      {drafts.length === 0 ? <div className="card"><p className="empty card-pad">Nothing to chase. Everyone is on time for this view.</p></div>
        : <ReminderCards drafts={drafts} appUrl={appUrl} send={send} />}
    </>
  );
}
