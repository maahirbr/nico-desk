'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Task } from '@/lib/derive';
import { oneOf } from '@/lib/remember';
import { personCounts } from '@/lib/planUtil';
import { addDays, fmtDate, fmtStamp, istInstant, istLocal } from '@/lib/time';
import { Avatar, PersonLink } from './chips';
import { Help } from './HelpMode';
import { useOpenTask } from './taskUrl';
import { useRemembered, useRememberedParam, useUrlText } from './remember';
import { Select } from './Select';
import { STATUS, statusKey, TaskDrawer, TaskRow, type Opt, type RowAction, type StatusKey } from './task-ui';
import { Stagger } from './motion-ui';
import { EmptyMark, ICON } from './icons';

type Person = { id: string; name: string; role: string };

export function TeamView({ tasks, later, added, weekStart, thisWeek, today, view, people, names, projectNames, projects, workstreamsByProject, meId, isLead, opts }: {
  tasks: Task[]; later: Task[]; added: string | null; weekStart: string; thisWeek: string; today: string; view: 'person' | 'status'; people: Person[];
  names: Record<string, string>; projectNames: Record<string, string>; projects: Opt[]; workstreamsByProject: Record<string, string[]>;
  meId: string; isLead: boolean; opts: Opt[];
}) {
  useRememberedParam('team-tab', 'view', view, ['person', 'status']);
  const [kept, keep] = useRemembered('team', { project: '' }, (raw) => ({ project: oneOf(raw.project, projects.map((p) => p.id), '') }), ['project']);
  const project = kept.project;
  const setProject = (v: string) => keep('project', v);
  const [openId, setOpenId] = useOpenTask();
  const [startStatus, setStartStatus] = useState<RowAction | undefined>();
  const [q, setQ] = useUrlText('q');
  const [more, setMore] = useState<Record<string, boolean>>({});
  const needle = q.trim().toLowerCase();
  const found = (p: Person) => !needle || p.name.toLowerCase().includes(needle) || p.role.toLowerCase().includes(needle);
  const foundIds = new Set(people.filter(found).map((p) => p.id));
  const inProject = (t: Task) => !project || t.projectId === project;
  // With "added since", tasks come in the order they were made, which is the order the meeting agreed them.
  const list = tasks.filter((t) => inProject(t) && (!needle || foundIds.has(t.ownerId)));
  if (!added) list.sort((a, b) => a.dueOn.localeCompare(b.dueOn));
  const ahead = later.filter(inProject).sort((a, b) => a.dueOn.localeCompare(b.dueOn));
  const open = list.filter((t) => t.statusCategory === 'open');
  const overdue = open.filter((t) => t.dueOn < today).length;
  const done = list.filter((t) => t.statusCategory === 'done').length;
  const href = (o: Record<string, string>) => {
    // The project and the search follow the week and the tab, so a link keeps the view as it is.
    const p = new URLSearchParams({ week: weekStart, view, ...(added ? { added } : {}), ...o });
    if (!p.get('added')) p.delete('added');
    if (project) p.set('project', project);
    if (q) p.set('q', q);
    return `/team?${p}`;
  };
  const sub = (t: Task) => [t.projectId ? projectNames[t.projectId] : '', t.workstream ?? ''].filter(Boolean).join(' · ');
  const row = (t: Task, owner?: string) => (
    <TaskRow key={t.id} t={t} today={today} sub={sub(t)} owner={owner} canTick={!t.readOnly && (t.ownerId === meId || isLead)} canBlock={!t.readOnly && (t.ownerId === meId || isLead)} canReassign={!t.readOnly && isLead}
      onOpen={() => { setOpenId(t.id); setStartStatus(undefined); }} onStatus={(s) => { setOpenId(t.id); setStartStatus(s); }} />
  );
  const opened = [...tasks, ...later].find((t) => t.id === openId);
  // Only people with something in view get a card: open work this week, or coming up. Nobody else is listed.
  const hasWork = (p: Person) => added ? list.some((t) => t.ownerId === p.id) : list.some((t) => t.ownerId === p.id && t.statusCategory === 'open') || ahead.some((t) => t.ownerId === p.id);
  const shownPeople = people.filter((p) => found(p) && hasWork(p));
  const SOON = 3; // coming-up tasks shown per person before the show-more button
  const ORDER: StatusKey[] = ['blocked', 'todo', 'doing', 'done'];
  const router = useRouter();
  // The presets are worked out at the moment of the click, from the clock on this device, in India time.
  const since = (v: string) => router.push(href({ added: v === 'h1' ? istLocal(new Date(Date.now() - 3600_000)) : v === 'h2' ? istLocal(new Date(Date.now() - 7200_000)) : v === 'today' ? `${today}T00:00` : v }));
  const cutoff = added ? istInstant(added) : null;

  return (
    <div className="calm">
      <header className="page-head">
        <div>
          <h1>Team</h1>
          <p className="summary">
            {cutoff ? <>{list.length} added since {fmtStamp(cutoff.toISOString())}</> : <>
              {open.length} open this week{overdue > 0 && <span className="late-text"> · {overdue} late</span>}{view === 'status' && <> · {done} done</>}
            </>}
          </p>
        </div>
      </header>


      <div className="toolbar2">
        {!added && <span className="weeknav">
          <Link className="iconbtn" href={href({ week: addDays(weekStart, -7) })} aria-label="Previous week">‹</Link>
          <span className="wk">{weekStart === thisWeek ? 'This week' : `Week of ${fmtDate(weekStart)}`}</span>
          <Link className="iconbtn" href={href({ week: addDays(weekStart, 7) })} aria-label="Next week">›</Link>
        </span>}
        <span className="seg" role="group" aria-label="View">
          <Help term="team_by_person" host><Link className={`seg-link${view === 'person' ? ' on' : ''}`} href={href({ view: 'person' })}>By person</Link></Help>
          <Help term="team_by_status" host><Link className={`seg-link${view === 'status' ? ' on' : ''}`} href={href({ view: 'status' })}>By status</Link></Help>
        </span>
        <Select value={project} aria-label="Project" onChange={setProject}>
          <option value="">All projects</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
        <Help term="team_added" host><span className="added-since">
          <Select value={added ?? ''} aria-label="Added since" onChange={since}>
            <option value="">Added any time</option>
            <option value="h1">Added in the last hour</option>
            <option value="h2">Added in the last 2 hours</option>
            <option value="today">Added today</option>
            {cutoff && <option value={added!}>Added since {fmtStamp(cutoff.toISOString())}</option>}
          </Select>
          {added && <input type="datetime-local" value={added} aria-label="Added since, exact time (India)" max={`${today}T23:59`}
            onChange={(e) => { if (istInstant(e.target.value)) router.replace(href({ added: e.target.value })); }} />}
        </span></Help>
        <input className="find-person" type="search" value={q} placeholder="Find a person" aria-label="Find a person by name or role"
          onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') setQ(''); }} />
      </div>

      {needle && people.filter(found).length === 0 && <div className="empty-state"><EmptyMark d={ICON['/search']} /><p>No one matches “{q.trim()}”.</p><button className="btn ghost" onClick={() => setQ('')}>Clear search</button></div>}
      {view === 'person' && shownPeople.length === 0 && (needle ? people.filter(found).length > 0 : true) && (
        <div className="empty-state"><EmptyMark d={ICON[needle ? '/search' : '/status']} /><p>{needle ? 'No tasks for that search.' : added ? 'Nothing added since then.' : 'Nothing open or coming up.'}</p>{needle ? <button className="btn ghost" onClick={() => setQ('')}>Clear search</button> : <Link className="btn" href="/tasks/new">Add a task</Link>}</div>
      )}
      {!needle && view === 'status' && list.length === 0 && <div className="empty-state"><EmptyMark d={ICON['/week']} /><p>{added ? 'Nothing added since then.' : 'Nothing due this week.'}</p><Link className="btn" href="/tasks/new">Add a task</Link></div>}

      {view === 'person' ? shownPeople.map((p) => {
        const o = list.filter((t) => t.ownerId === p.id && t.statusCategory === 'open');
        const overdueN = o.filter((t) => t.dueOn < today);
        const week = o.filter((t) => t.dueOn >= today);
        const soon = ahead.filter((t) => t.ownerId === p.id);
        const counts = personCounts(o, soon, today);
        const soonShown = more[p.id] ? soon : soon.slice(0, SOON);
        if (added) {
          const mine = list.filter((t) => t.ownerId === p.id);
          return (
            <section key={p.id} className="group">
              <h2 className="person-h">
                <PersonLink id={p.id} className="person-cell"><Avatar id={p.id} name={p.name} />{p.name}</PersonLink><span className="dim role">{p.role}</span>
                <span className="n">{mine.length} added</span>
              </h2>
              <Stagger id="team" className="tlist">{mine.map((t) => row(t))}</Stagger>
            </section>
          );
        }
        return (
          <section key={p.id} className="group">
            <h2 className="person-h">
              <PersonLink id={p.id} className="person-cell"><Avatar id={p.id} name={p.name} />{p.name}</PersonLink><span className="dim role">{p.role}</span>
              <span className="n">{counts.open} open{counts.late > 0 && <span className="late-text"> · {counts.late} late</span>}</span>
            </h2>
            {overdueN.length > 0 && <><h3 className="next-h late-text"><Help term="late">Late</Help></h3><Stagger id="team" className="tlist">{overdueN.map((t) => row(t))}</Stagger></>}
            {week.length > 0 && <><h3 className="next-h"><Help term="group_this_week">{weekStart === thisWeek ? 'This week' : 'That week'}</Help></h3><Stagger id="team" className="tlist">{week.map((t) => row(t))}</Stagger></>}
            {soon.length > 0 && (
              <>
                <h3 className="next-h"><Help term="coming_up">Coming up</Help></h3>
                <Stagger id="team" className="tlist">{soonShown.map((t) => row(t))}</Stagger>
                {soon.length > SOON && (
                  <button className="mini-btn next-more" onClick={() => setMore({ ...more, [p.id]: !more[p.id] })}>
                    {more[p.id] ? 'Show fewer' : `Show ${soon.length - SOON} more`}
                  </button>
                )}
              </>
            )}
          </section>
        );
      }) : ORDER.map((k) => {
        const items = list.filter((t) => statusKey(t) === k);
        if (!items.length) return null;
        return (
          <section key={k} className="group">
            <h2><span className={`st st-status tone-${STATUS[k].tone}`}><Help term={`status_${k}`}>{STATUS[k].word}</Help></span> <span className="n">{items.length}</span></h2>
            <Stagger id="team" className="tlist">{items.map((t) => row(t, names[t.ownerId] ?? '?'))}</Stagger>
          </section>
        );
      })}

      {openId && (
        <TaskDrawer key={`${openId}-${startStatus ?? ''}`} startStatus={startStatus} id={openId} meId={meId} isLead={isLead} people={opts} today={today} projectNames={projectNames}
          workstreams={workstreamsByProject[opened?.projectId ?? ''] ?? []} onClose={() => setOpenId(null)} />
      )}
    </div>
  );
}
