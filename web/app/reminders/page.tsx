import Link from 'next/link';
import { headers } from 'next/headers';
import { requireMe } from '@/lib/auth';
import { lookups, one, type SP } from '@/lib/page';
import { teamProjects } from '@/lib/plan';
import { reminderDrafts } from '@/lib/reminders';
import { ReminderCards } from '@/components/Reminders';

export const dynamic = 'force-dynamic';

export default async function Reminders({ searchParams }: { searchParams: SP }) {
  const me = await requireMe();
  const { d, isLead, isAdmin } = await lookups(me);
  if (!isLead && !isAdmin) return (<><h1>Reminders</h1><p className="lede">Only a lead drafts reminders.</p></>);
  const sp = await searchParams;
  const mode = one(sp.mode) === 'window' ? 'window' : 'overdue';
  const days = Math.min(Math.max(Number(one(sp.days) ?? 2) || 2, 1), 30);
  const projectId = one(sp.project);
  const h = await headers();
  const appUrl = `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host') ?? 'localhost:3100'}/me`;
  const [{ drafts, skipped }, projects] = await Promise.all([
    reminderDrafts(d, me.team.id, { mode, days, projectId }, appUrl),
    teamProjects(d, me.team.id),
  ]);
  const q = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const m = { mode, days: String(days), project: projectId, ...o };
    for (const [k, v] of Object.entries(m)) if (v) p.set(k, v);
    return `/reminders?${p}`;
  };
  return (
    <>
      <h1>Reminders</h1>
      <p className="lede">One draft email per person. It opens in your own Gmail; you press Send.</p>
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
          <select name="project" defaultValue={projectId ?? ''}>
            <option value="">All projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <button className="btn ghost">Apply</button>
      </form>
      {skipped.length > 0 && <p className="small dim">Not reminded, by choice: {skipped.join(', ')}.</p>}
      {drafts.length === 0 ? <div className="card"><p className="empty card-pad">Nothing to chase. Everyone is on time for this view.</p></div>
        : <ReminderCards drafts={drafts} />}
    </>
  );
}
