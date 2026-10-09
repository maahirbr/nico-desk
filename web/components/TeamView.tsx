'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { Task } from '@/lib/derive';
import { addDays, fmtDate } from '@/lib/time';
import { Avatar } from './chips';
import { STATUS, statusKey, TaskDrawer, TaskRow, type Opt, type StatusKey } from './task-ui';

type Person = { id: string; name: string; role: string };

export function TeamView({ tasks, later, weekStart, thisWeek, today, view, people, names, projectNames, projects, workstreamsByProject, meId, isLead, opts }: {
  tasks: Task[]; later: Task[]; weekStart: string; thisWeek: string; today: string; view: 'person' | 'status'; people: Person[];
  names: Record<string, string>; projectNames: Record<string, string>; projects: Opt[]; workstreamsByProject: Record<string, string[]>;
  meId: string; isLead: boolean; opts: Opt[];
}) {
  const [project, setProject] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [startStatus, setStartStatus] = useState<StatusKey | undefined>();
  const [q, setQ] = useState('');
  const [more, setMore] = useState<Record<string, boolean>>({});
  const needle = q.trim().toLowerCase();
  const found = (p: Person) => !needle || p.name.toLowerCase().includes(needle) || p.role.toLowerCase().includes(needle);
  const foundIds = new Set(people.filter(found).map((p) => p.id));
  const inProject = (t: Task) => !project || t.projectId === project;
  const list = tasks.filter((t) => inProject(t) && (!needle || foundIds.has(t.ownerId))).sort((a, b) => a.dueOn.localeCompare(b.dueOn));
  const ahead = later.filter(inProject).sort((a, b) => a.dueOn.localeCompare(b.dueOn));
  const open = list.filter((t) => t.statusCategory === 'open');
  const overdue = open.filter((t) => t.dueOn < today).length;
  const done = list.filter((t) => t.statusCategory === 'done').length;
  const href = (o: Record<string, string>) => {
    const p = new URLSearchParams({ week: weekStart, view, ...o });
    return `/team?${p}`;
  };
  const sub = (t: Task) => [t.projectId ? projectNames[t.projectId] : '', t.workstream ?? ''].filter(Boolean).join(' · ');
  const row = (t: Task, owner?: string) => (
    <TaskRow key={t.id} t={t} today={today} sub={sub(t)} owner={owner} canTick={!t.readOnly && (t.ownerId === meId || isLead)}
      onOpen={() => { setOpenId(t.id); setStartStatus(undefined); }} onStatus={(s) => { setOpenId(t.id); setStartStatus(s); }} />
  );
  const opened = [...tasks, ...later].find((t) => t.id === openId);
  const shownPeople = people.filter(found);
  const SOON = 3; // coming-up tasks shown per person before the show-more button
  const ORDER: StatusKey[] = ['blocked', 'todo', 'doing', 'done'];

  return (
    <div className="calm">
      <header className="page-head">
        <div>
          <h1>Team</h1>
          <p className="summary">
            {open.length} open this week{overdue > 0 && <span className="late-text"> · {overdue} late</span>}{view === 'status' && <> · {done} done</>}
          </p>
        </div>
      </header>

      <div className="toolbar2">
        <span className="weeknav">
          <Link className="iconbtn" href={href({ week: addDays(weekStart, -7) })} aria-label="Previous week">‹</Link>
          <span className="wk">{weekStart === thisWeek ? 'This week' : `Week of ${fmtDate(weekStart)}`}</span>
          <Link className="iconbtn" href={href({ week: addDays(weekStart, 7) })} aria-label="Next week">›</Link>
        </span>
        <span className="seg" role="group" aria-label="View">
          <Link className={`seg-link${view === 'person' ? ' on' : ''}`} href={href({ view: 'person' })}>By person</Link>
          <Link className={`seg-link${view === 'status' ? ' on' : ''}`} href={href({ view: 'status' })}>By status</Link>
        </span>
        <select value={project} aria-label="Project" onChange={(e) => setProject(e.target.value)}>
          <option value="">All projects</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input className="find-person" type="search" value={q} placeholder="Find a person" aria-label="Find a person by name or role"
          onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') setQ(''); }} />
      </div>

      {needle && shownPeople.length === 0 && <div className="empty-state"><p>No one matches “{q.trim()}”.</p><button className="btn ghost" onClick={() => setQ('')}>Clear search</button></div>}
      {!needle && view === 'status' && list.length === 0 && <div className="empty-state"><p>Nothing due this week.</p><Link className="btn" href="/tasks/new">Add a task</Link></div>}

      {view === 'person' ? shownPeople.map((p) => {
        const o = list.filter((t) => t.ownerId === p.id && t.statusCategory === 'open');
        const overdueN = o.filter((t) => t.dueOn < today);
        const week = o.filter((t) => t.dueOn >= today);
        const soon = ahead.filter((t) => t.ownerId === p.id);
        const soonShown = more[p.id] ? soon : soon.slice(0, SOON);
        // Without a search, people with nothing ahead fold into one line at the end.
        if (!needle && !o.length && !soon.length) return null;
        return (
          <section key={p.id} className="group">
            <h2 className="person-h">
              <Avatar name={p.name} />{p.name}<span className="dim role">{p.role}</span>
              <span className="n">{o.length + soon.length} ahead{overdueN.length > 0 && <span className="late-text"> · {overdueN.length} late</span>}</span>
            </h2>
            {!o.length && !soon.length && <p className="next-empty">Nothing next. Free to pick something up.</p>}
            {overdueN.length > 0 && <><h3 className="next-h late-text">Late</h3><div className="tlist">{overdueN.map((t) => row(t))}</div></>}
            {week.length > 0 && <><h3 className="next-h">{weekStart === thisWeek ? 'This week' : 'That week'}</h3><div className="tlist">{week.map((t) => row(t))}</div></>}
            {soon.length > 0 && (
              <>
                <h3 className="next-h">Coming up</h3>
                <div className="tlist">{soonShown.map((t) => row(t))}</div>
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
            <h2><span className={`st tone-${STATUS[k].tone}`}>{STATUS[k].word}</span> <span className="n">{items.length}</span></h2>
            <div className="tlist">{items.map((t) => row(t, names[t.ownerId] ?? '?'))}</div>
          </section>
        );
      })}

      {view === 'person' && !needle && (() => {
        const idle = people.filter((p) => !list.some((t) => t.ownerId === p.id && t.statusCategory === 'open') && !ahead.some((t) => t.ownerId === p.id));
        return idle.length > 0 && <p className="next-idle">Nothing next for {idle.map((p) => p.name).join(', ')}.</p>;
      })()}

      {openId && (
        <TaskDrawer key={`${openId}-${startStatus ?? ''}`} startStatus={startStatus} id={openId} meId={meId} isLead={isLead} people={opts} today={today} projectNames={projectNames}
          workstreams={opened?.projectId ? workstreamsByProject[opened.projectId] ?? [] : []} onClose={() => setOpenId(null)} />
      )}
    </div>
  );
}
