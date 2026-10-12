'use client';

import Link from 'next/link';
import type { Task } from '@/lib/derive';
import type { OnTimeRecord, PersonProject } from '@/lib/service';
import { Avatar, PersonLink } from './chips';
import { CopyLink } from './CopyLink';
import { useOpenTask } from './taskUrl';
import { TaskDrawer, TaskRow, dueText, type Opt } from './task-ui';

// One teammate's page: their open work by project, who waits on them and whom they wait on, what changed lately,
// their on-time record (only where the viewer may see it) and their projects. Every row links on: a task opens in
// the side panel (and gets a ?task= address), a project and a person open their own page.

export type PersonLogItem = { id: string; at: string; whoId: string | null; who: string; text: string; taskId: string; task: string };

export function PersonPage({ personId, name, role, department, active, meId, isLead, today, names, projectNames, people, workstreamsByProject, projects, open, waitingOnThem, waitingOnOthers, recent, record }: {
  personId: string; name: string; role: string; department: string; active: boolean; meId: string; isLead: boolean; today: string;
  names: Record<string, string>; projectNames: Record<string, string>; people: Opt[]; workstreamsByProject: Record<string, string[]>;
  projects: PersonProject[]; open: Task[]; waitingOnThem: Task[]; waitingOnOthers: Task[]; recent: PersonLogItem[]; record: OnTimeRecord | null;
}) {
  const [openId, setOpenId] = useOpenTask();
  const mine = personId === meId;
  const byProject = new Map<string, Task[]>();
  for (const t of open) byProject.set(t.projectId ?? '', [...(byProject.get(t.projectId ?? '') ?? []), t]);
  const all = [...open, ...waitingOnThem, ...waitingOnOthers];
  const opened = all.find((t) => t.id === openId);
  const first = name.split(' ')[0];
  const late = open.filter((t) => t.dueOn < today).length;

  return (
    <div className="calm">
      <Link className="crumb" href="/team">← Team</Link>
      <header className="page-head">
        <div className="pp-head">
          <Avatar name={name} lg you={mine} />
          <div>
            <h1>{name}{mine && <span className="dim"> (you)</span>}</h1>
            <p className="person-meta">{[role, department, active ? '' : 'Not active'].filter(Boolean).join(' · ')}</p>
          </div>
        </div>
        <div className="head-side">
        <p className="summary">
          {open.length ? <>{open.length} open{late > 0 && <> · <span className="late-text">{late} late</span></>}</> : 'Nothing open'}
          {waitingOnThem.length > 0 && <> · {waitingOnThem.length} waiting on {first}</>}
        </p>
          <CopyLink path={`/people/${personId}`} what="person" />
        </div>
      </header>

      {record && (
        <section className="card card-pad">
          <p className="section-title">On-time record, last 4 weeks</p>
          <div className="stats tiles">
            <div className="card stat"><div className="stat-n">{record.ahead}</div><div className="stat-l">Done ahead</div></div>
            <div className="card stat"><div className="stat-n">{record.onTime}</div><div className="stat-l">Done on time</div></div>
            <div className={`card stat${record.late ? ' warn' : ''}`}><div className="stat-n">{record.late}</div><div className="stat-l">Done late</div></div>
            <div className={`card stat${record.openPastDue ? ' warn' : ''}`}><div className="stat-n">{record.openPastDue}</div><div className="stat-l">Open and past due</div></div>
            <div className="card stat"><div className="stat-n">{record.renegotiated}</div><div className="stat-l">Date moves</div></div>
          </div>
          <p className="small dim">Judged against the first date given. <Link className="rlink" href={`/ledger?person=${personId}`}>See the ledger for {mine ? 'you' : first}</Link></p>
        </section>
      )}

      <section className="group">
        <h2>Open work <span className="n">{open.length}</span></h2>
        {open.length === 0 && <p className="small dim">{first} has nothing open.</p>}
        {[...byProject.entries()].map(([pid, items]) => (
          <div key={pid || 'none'}>
            <p className="pg-proj">{pid ? <Link className="rlink" href={`/projects/${pid}`}>{projectNames[pid] ?? 'Project'}</Link> : 'No project'}</p>
            <div className="tlist">
              {items.map((t) => (
                <TaskRow key={t.id} t={t} today={today} sub={t.workstream ?? ''} canTick={false} onOpen={() => setOpenId(t.id)} />
              ))}
            </div>
          </div>
        ))}
      </section>

      <div className="pg-grid">
        <section className="card card-pad">
          <p className="section-title">Waiting on {mine ? 'you' : first}</p>
          {waitingOnThem.length === 0 ? <p className="small dim">No one is waiting on {mine ? 'you' : first}.</p> : (
            <ul className="pg-list">
              {waitingOnThem.map((t) => (
                <li key={t.id}>
                  <span className="pg-main">
                    <PersonLink id={t.ownerId}><b>{names[t.ownerId]?.split(' ')[0]}</b></PersonLink>{' '}
                    <button className="callout-link" onClick={() => setOpenId(t.id)}>needs: {t.blocked?.ask}<span className="dim"> · for “{t.title}”</span></button>
                  </span>
                  <span className="pg-side">{dueText(t, today).text}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card card-pad">
          <p className="section-title">{mine ? 'You are' : `${first} is`} waiting on others</p>
          {waitingOnOthers.length === 0 ? <p className="small dim">Not waiting on anyone.</p> : (
            <ul className="pg-list">
              {waitingOnOthers.map((t) => (
                <li key={t.id}>
                  <span className="pg-main">
                    <button className="callout-link" onClick={() => setOpenId(t.id)}>{t.title}</button>
                    <span className="dim"> · waits on </span>
                    <PersonLink id={t.blocked?.onId}><b>{t.blocked?.onId ? names[t.blocked.onId] : ''}</b></PersonLink>
                  </span>
                  <span className="pg-side">{dueText(t, today).text}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="pg-grid">
        <section className="card card-pad">
          <p className="section-title">Projects</p>
          {projects.length === 0 ? <p className="small dim">Not on a project yet.</p> : (
            <ul className="pg-list">
              {projects.map((p) => (
                <li key={p.id}>
                  <span className="pg-main"><Link className="rlink" href={`/projects/${p.id}`}>{p.name}</Link></span>
                  <span className="pg-side">{p.role}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card card-pad">
          <p className="section-title">Recent updates</p>
          {recent.length === 0 ? <p className="small dim">No updates yet.</p> : (
            <ul className="pg-list">
              {recent.map((e) => (
                <li key={e.id}>
                  <span className="pg-main">
                    <PersonLink id={e.whoId}><b>{e.who}</b></PersonLink> {e.text}{' '}
                    <button className="callout-link" onClick={() => setOpenId(e.taskId)}>on “{e.task}”</button>
                  </span>
                  <span className="pg-side">{e.at}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {openId && (
        <TaskDrawer key={openId} id={openId} meId={meId} isLead={isLead} people={people} today={today} projectNames={projectNames}
          workstreams={workstreamsByProject[opened?.projectId ?? ''] ?? []} onClose={() => setOpenId(null)} />
      )}
    </div>
  );
}
