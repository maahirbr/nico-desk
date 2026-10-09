import Link from 'next/link';
import { requireMe } from '@/lib/auth';
import { lookups } from '@/lib/page';
import { projectCounts, projectMembers, teamProjects } from '@/lib/plan';
import { countdown } from '@/lib/planUtil';
import { fmtDate, today } from '@/lib/time';
import { Avatar } from '@/components/chips';
import { NewProjectButton } from '@/components/ProjectForm';

export const dynamic = 'force-dynamic';

export default async function Projects() {
  const me = await requireMe();
  const { d, names, activeOpts, isLead, isAdmin } = await lookups(me);
  const [projects, counts] = await Promise.all([teamProjects(d, me.team.id), projectCounts(d, me.team.id)]);
  const t = today();
  const sorted = [...projects].sort((a, b) => (a.launchOn ?? '9999').localeCompare(b.launchOn ?? '9999'));
  const members = Object.fromEntries(await Promise.all(projects.map(async (p) => [p.id, await projectMembers(d, p.id)] as const)));
  const STATUS: Record<string, { word: string; c: string }> = {
    on_track: { word: 'On track', c: 'var(--green)' }, at_risk: { word: 'At risk', c: 'var(--amber)' }, off_track: { word: 'Off track', c: 'var(--red)' },
  };
  return (
    <div className="calm">
      <header className="page-head">
        <div><h1>Projects</h1><p className="summary">{projects.length} projects · soonest date first</p></div>
        {(isLead || isAdmin) && <NewProjectButton people={activeOpts} meId={me.person.id} />}
      </header>
      <div className="pcards">
        {sorted.map((p) => {
          const c = counts[p.id] ?? { open: 0, overdue: 0, done: 0 };
          const total = c.open + c.done;
          const cd = p.launchOn ? countdown(t, p.launchOn) : null;
          const team = [p.ownerId, ...(members[p.id] ?? []).map((m) => m.personId)];
          const st = STATUS[p.status];
          return (
            <Link key={p.id} href={`/projects/${p.id}`} className="pcard">
              <div className="pcard-top">
                <span className="kind-tag">{p.kind === 'plan' ? `Plan · ${p.partnerName ?? 'partner'}` : 'Task board'}</span>
                <span className="st" style={{ '--c': st.c } as React.CSSProperties}>{st.word}</span>
              </div>
              <h2 className="pcard-name">{p.name}</h2>
              {p.eyebrow && <div className="pcard-eyebrow">{p.eyebrow}</div>}
              {p.intro && <p className="pcard-goal">{p.intro}</p>}
              <div className="pcard-progress">
                <span className="pbar" aria-hidden><span style={{ width: `${total ? Math.round((100 * c.done) / total) : 0}%` }} /></span>
                <span className="small"><b>{c.done}</b> done · <b>{c.open}</b> open{c.overdue > 0 && <span className="late-text"> · {c.overdue} overdue</span>}</span>
              </div>
              <div className="pcard-foot">
                <span className="avs" title={team.map((id) => names[id]).join(', ')}>
                  {team.slice(0, 5).map((id) => <Avatar key={id} name={names[id] ?? '?'} />)}
                  {team.length > 5 && <span className="av more">+{team.length - 5}</span>}
                </span>
                {p.launchOn ? (
                  <span className="pcard-date">
                    <b>{fmtDate(p.launchOn)}</b>
                    <span className={cd?.past ? 'late-text' : 'dim'}>{cd?.past ? 'passed' : `${cd?.months ? `${cd.months} mo ` : ''}${cd?.days} d to go`}</span>
                  </span>
                ) : <span className="dim small">No date</span>}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
