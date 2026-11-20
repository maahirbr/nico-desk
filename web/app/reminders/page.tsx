import { mayOversee } from '@/lib/roles';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { requireMe } from '@/lib/auth';
import { lookups, one, type SP } from '@/lib/page';
import { seenProjects } from '@/lib/visibility';
import { seesProject } from '@/lib/sight';
import { reminderDrafts } from '@/lib/reminders';
import { ReminderCards } from '@/components/Reminders';
import { RemindFind } from '@/components/RemindFind';
import { gmailSendEnabled, gmailStatus } from '@/lib/gmailSend';
import { resendFromLine, resendSendEnabled } from '@/lib/resendSend';
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
  not_allowed: 'Only leadership or an admin can connect Gmail for reminders.',
};

export default async function Reminders({ searchParams }: { searchParams: SP }) {
  const me = await requireMe();
  const { d, sight, people } = await lookups(me);
  if (!mayOversee(me.person.appRoles)) return (<><h1>Reminders</h1><p className="lede">Only leadership or an admin drafts reminders.</p></>);
  // Leadership reminds anyone (15 Nov, the PM's call): the drafts cover every team task, even on projects they cannot
  // open. They still open only their own projects; Personal tasks stay out (sight.hidden).
  const remindSight = me.person.appRoles.includes('leadership') ? { all: true as const, hidden: sight.hidden } : sight;
  const sp = await searchParams;
  const mode = one(sp.mode) === 'window' ? 'window' : 'overdue';
  const days = Math.min(Math.max(Number(one(sp.days) ?? 2) || 2, 1), 30);
  const projectId = one(sp.project);
  if (projectId && !seesProject(sight, projectId)) notFound(); // hidden reads as missing
  const h = await headers();
  const appUrl = `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host') ?? 'localhost:3100'}/me`;
  const gmailOn = gmailSendEnabled() && !me.viewingAs;
  const resendOn = resendSendEnabled() && !me.viewingAs; // Send without Gmail, through Resend (18 Nov)
  const sendOn = gmailOn || resendOn;
  const [{ drafts, skipped }, projects, link] = await Promise.all([
    reminderDrafts(d, me.team.id, { mode, days, projectId, sight: remindSight }, appUrl),
    seenProjects(d, me, sight),
    gmailOn ? gmailStatus(d, me.realPerson.id) : null,
  ]);
  const send = { enabled: gmailOn, connected: !!link?.connected, from: link?.email ?? me.person.email,
    resend: resendOn ? resendFromLine(me.realPerson.fullName ?? me.realPerson.displayName) : null };
  const gmail = GMAIL_SAID[one(sp.gmail) ?? ''];
  // "Waiting on a reply" (asks with no answer after 2 days) left Reminders on 20 Nov, the PM's call: the ask stays on the
  // task, and the person sees it on their Home until they answer.
  const q = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const m = { mode, days: String(days), project: projectId, ...o };
    for (const [k, v] of Object.entries(m)) if (v) p.set(k, v);
    return `/reminders?${p}`;
  };
  return (
    <>
      <h1>Reminders</h1>
      <p className="lede">{send.resend && !send.connected
        ? 'One draft email per person, sent under your name, with replies to you. Check it, then press Send, or open it in Gmail.'
        : sendOn
        ? 'One draft email per person, from the address you signed in with. Check it, then press Send, or open it in Gmail.'
        : 'One draft email per person. It opens in your Gmail, from the address you signed in with. Nothing goes out until you press Send.'}
        {/* Bulk send needs a project (19 Nov): said here, in the top line, rather than on a line of its own. */}
        {!projectId && !me.viewingAs && ' Pick a project to use Bulk send.'}</p>
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
            {projects.filter((p) => !p.personalFor && !p.archivedAt).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </label>
        <button className="btn ghost">Apply</button>
        {drafts.length > 1 && <RemindFind />}
      </form>
      {skipped.length > 0 && <p className="small dim">Not reminded, by choice: {skipped.join(', ')}.</p>}
      {drafts.length === 0 ? <div className="card"><p className="empty card-pad">Nothing to chase. Everyone is on time for this view.</p></div>
        : <ReminderCards drafts={drafts} appUrl={appUrl} send={send} sendAll={!!projectId}
            signOff={me.person.nickname?.trim() || me.person.displayName.split(' ')[0]}
            contacts={people.filter((p) => p.active && p.email).map((p) => ({ name: p.fullName ?? p.displayName, email: p.email }))} />}
    </>
  );
}
