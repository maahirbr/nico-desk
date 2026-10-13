import Link from 'next/link';
import { requireMe } from '@/lib/auth';
import { lookups } from '@/lib/page';
import { projectMembers, projectSplits } from '@/lib/plan';
import { seenProjects } from '@/lib/visibility';
import { countdown } from '@/lib/planUtil';
import { emptySplit } from '@/lib/progress';
import { fmtDate, today } from '@/lib/time';
import { Avatar } from '@/components/chips';
import type { HelpTerm } from '@/components/help';
import { Help } from '@/components/HelpMode';
import { NewProjectButton } from '@/components/ProjectForm';
import { Stagger } from '@/components/motion-ui';
import { StatusBar } from '@/components/ProjectVisuals';

export const dynamic = 'force-dynamic';

export default async function Projects() {
  const me = await requireMe();
  const { d, sight, names, activeOpts, isLead, isAdmin, readOnly } = await lookups(me);
  const [projects, splits] = await Promise.all([seenProjects(d, me, sight), projectSplits(d, me.team.id)]);
  const t = today();
  const bySoonest = (a: (typeof projects)[number], b: (typeof projects)[number]) => (a.launchOn ?? '9999').localeCompare(b.launchOn ?? '9999');
  const live = projects.filter((p) => !p.archivedAt).sort(bySoonest);
  const archived = projects.filter((p) => p.archivedAt).sort(bySoonest); // closed projects: out of the main list, still readable
  const members = Object.fromEntries(await Promise.all(projects.map(async (p) => [p.id, await projectMembers(d, p.id)] as const)));
  const STATUS: Record<string, { word: string; tone: string; help: HelpTerm }> = {
    on_track: { word: 'On track', tone: 'ok', help: 'project_on_track' }, at_risk: { word: 'At risk', tone: 'risk', help: 'project_at_risk' }, off_track: { word: 'Off track', tone: 'late', help: 'project_off_track' },
  };
  const card = (p: (typeof projects)[number]) => {
    const split = splits[p.id] ?? emptySplit();
    const cd = p.launchOn ? countdown(t, p.launchOn) : null;
    const team = [...new Set([p.ownerId, p.leadId, ...(members[p.id] ?? []).map((m) => m.personId)])];
    const st = STATUS[p.status];
    return (
      <Link key={p.id} href={`/projects/${p.id}`} className="pcard">
        <div className="pcard-top">
          <h2 className="pcard-name">{p.name}</h2>
          {p.archivedAt ? <Help term="project_archived" host><span className="st st-status tone-idle">Archived</span></Help> : <Help term={st.help} host><span className={`st st-status tone-${st.tone}`}>{st.word}</span></Help>}
        </div>
        <div className="kind-tag">
          <Help term={p.kind === 'plan' ? 'project_partner' : 'project_internal'} host><span className="kind-word">{p.kind === 'plan' ? `Partner · ${p.partnerName ?? 'partner'}` : 'Internal'}</span></Help>
          {p.eyebrow && <span className="kind-eyebrow">{p.eyebrow}</span>}
        </div>
        {p.intro && <p className="pcard-goal">{p.intro}</p>}
        <div className="pcard-progress">
          <Help term="project_progress" host><StatusBar split={split} what={p.kind === 'plan' ? 'plan lines' : 'tasks'} viewKey="projects-bars" /></Help>
        </div>
        <div className="pcard-foot">
          <span className="avs" title={team.map((id) => names[id]).join(', ')}>
            {team.slice(0, 5).map((id) => <Avatar key={id} id={id} name={names[id] ?? '?'} />)}
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
  };
  return (
    <div className="calm">
      <header className="page-head">
        <div><h1>Projects</h1><p className="summary">{live.length} projects · soonest date first{archived.length > 0 && <> · {archived.length} archived</>}</p></div>
        {(isLead || isAdmin) && !readOnly && <NewProjectButton people={activeOpts} meId={me.person.id} />}
      </header>
      <Stagger id="projects" className="pcards">
        {live.map(card)}
      </Stagger>
      {archived.length > 0 && (
        <details className="archived-group">
          <summary><Help term="project_archived" host><span>Archived</span></Help> <span className="count-badge">{archived.length}</span></summary>
          <div className="pcards">{archived.map(card)}</div>
        </details>
      )}
    </div>
  );
}
