'use client';

import Link from 'next/link';
import { useState } from 'react';
import { sortEnded, type EndedSort, type Task } from '@/lib/derive';
import { endedSortOf } from '@/lib/remember';
import { fmtDate } from '@/lib/time';
import type { UpdateGroup, UpdateItem } from '@/lib/updates';
import { PersonLink } from './chips';
import type { HelpTerm } from './help';
import { Help } from './HelpMode';
import { useRemembered } from './remember';
import { SortPick } from './SortPick';
import { useOpenTask } from './taskUrl';
import { MentionsCard } from './MentionsCard';
import { MovedAwayCard, type MovedAway } from './MovedAwayCard';
import { UpdatesCard } from './UpdatesCard';
import { useReadOnly } from './readonly';
import { WaitingCard } from './WaitingCard';
import { AddTaskForm, Modal, TaskDrawer, TaskRow, type Opt, type RowAction, type StatusKey } from './task-ui';
import { Stagger } from './motion-ui';
import { DitherArt } from './DitherArt';
import { GuideNote } from './GuideNote';
import { HomeGlance } from './HomeGlance';
import type { Glance } from '@/lib/glance';
import type { Mention } from '@/lib/comments';

const HEAD: Record<string, HelpTerm> = { late: 'late', today: 'group_today', week: 'group_this_week', later: 'group_later' };

// Home: what is on your plate, grouped by when it is due. One line per task; click for detail.

export function HomeView({ greeting, today, weekEnd, meId, isLead, updates, mine, newIds, assignedNotice, movedAway, mentions, waiting, done, dropped, names, projectNames, people, projects, workstreamsByProject, myProjects, glance }: {
  greeting: string; today: string; weekEnd: string; meId: string; isLead: boolean; updates: { items: UpdateItem[]; groups: UpdateGroup[]; now: string }; mine: Task[]; newIds: string[];
  assignedNotice: Record<string, string>; movedAway: MovedAway[]; mentions: Mention[]; waiting: Task[]; done: Task[]; dropped: Task[]; names: Record<string, string>;
  projectNames: Record<string, string>; people: Opt[]; projects: Opt[]; workstreamsByProject: Record<string, string[]>;
  myProjects: { id: string; name: string; role: string }[]; glance: Glance;
}) {
  const readOnly = useReadOnly();
  const [openId, setOpenId] = useOpenTask();
  const [startStatus, setStartStatus] = useState<RowAction | undefined>();
  const [adding, setAdding] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [showDropped, setShowDropped] = useState(false);
  // The two finished-list sorts come back the next time Home is opened in this browser (components/remember.ts).
  const [kept, keep] = useRemembered('home', { doneSort: 'recent' as EndedSort, droppedSort: 'recent' as EndedSort },
    (raw) => ({ doneSort: endedSortOf(raw.doneSort), droppedSort: endedSortOf(raw.droppedSort) }));
  const { doneSort, droppedSort } = kept;
  const setDoneSort = (v: EndedSort) => keep('doneSort', v);
  const setDroppedSort = (v: EndedSort) => keep('droppedSort', v);
  const isNew = new Set(newIds);
  const sub = (t: Task) => [isNew.has(t.id) ? 'New' : '', t.projectId ? projectNames[t.projectId] : '', t.workstream ?? '', t.note ?? ''].filter(Boolean).join(' · ');
  const groups = [
    { key: 'late', label: 'Late', items: mine.filter((t) => t.dueOn < today) },
    { key: 'today', label: 'Today', items: mine.filter((t) => t.dueOn === today) },
    { key: 'week', label: 'This week', items: mine.filter((t) => t.dueOn > today && t.dueOn <= weekEnd) },
    { key: 'later', label: 'Later', items: mine.filter((t) => t.dueOn > weekEnd) },
  ].filter((g) => g.items.length);
  const overdue = mine.filter((t) => t.dueOn < today).length;
  const open = (id: string, s?: RowAction) => {
    setOpenId(id); setStartStatus(s);
    if (assignedNotice[id] && !readOnly) fetch(`/api/v1/me/notices/${assignedNotice[id]}/read`, { method: 'POST' }).catch(() => {});
  };
  const opened = [...mine, ...waiting, ...done, ...dropped].find((t) => t.id === openId);

  return (
    <div className="calm">
      <header className="page-head">
        <div>
          <h1>{greeting}</h1>
          <p className="summary">
            {mine.length ? <>{mine.length} open{overdue > 0 && <> · <span className="late-text"><Help term="overdue">{overdue} late</Help></span></>}</> : 'Nothing open'}
            {waiting.length > 0 && <> · {waiting.length} <Help term="waiting_on_you">waiting on you</Help></>}
            <span className="dim"> · {fmtDate(today)}</span>
          </p>
        </div>
        {!readOnly && <button className="btn head-new" onClick={() => setAdding(true)}>+ New task</button>}
      </header>

      <GuideNote />

      <HomeGlance glance={glance} />

      <UpdatesCard items={updates.items} groups={updates.groups} meId={meId} now={updates.now} onOpen={(id) => open(id)} />

      <MentionsCard items={mentions} />

      <MovedAwayCard items={movedAway} />

      <WaitingCard tasks={waiting} names={names} projectNames={projectNames} now={updates.now} onOpen={(id) => open(id)} />

      {groups.length === 0 && (
        <div className="empty-state">
          <DitherArt field="hill" className="dither-empty" />
          <p>You’re clear. Nothing open on your side.</p>
          {!readOnly && <button className="btn" onClick={() => setAdding(true)}>Add a task</button>}
        </div>
      )}

      {groups.map((g) => (
        <section key={g.key} className="group">
          <h2 className={g.key === 'late' ? 'late-text' : ''}><Help term={HEAD[g.key]}>{g.label}</Help> <span className="n">{g.items.length}</span></h2>
          <Stagger id="home" className="tlist">
            {g.items.map((t) => <TaskRow key={t.id} t={t} today={today} sub={sub(t)} canTick canBlock={t.ownerId === meId || isLead} canReassign={isLead} onOpen={() => open(t.id)} onStatus={(s) => open(t.id, s)} />)}
          </Stagger>
        </section>
      ))}

      {myProjects.length > 0 && (
        <section className="group">
          <h2><Help term="your_projects">Your projects</Help> <span className="n">{myProjects.length}</span></h2>
          <div className="my-projects">
            {myProjects.map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`} className="my-project"><b>{p.name}</b><span className="dim">{p.role}</span></Link>
            ))}
          </div>
        </section>
      )}

      {done.length > 0 && (
        <section className="group">
          <div className="list-head">
            <Help term="done_this_week" host><button className="log-toggle small-toggle" aria-expanded={showDone} onClick={() => setShowDone(!showDone)}>
              <span aria-hidden>{showDone ? '▾' : '▸'}</span> Done this week <span className="count-badge">{done.length}</span>
            </button></Help>
            {showDone && done.length > 1 && <SortPick value={doneSort} onChange={setDoneSort} />}
          </div>
          {showDone && <div className="tlist">{sortEnded(done, doneSort).map((t) => <TaskRow key={t.id} t={t} today={today} sub={sub(t)} canTick={false} onOpen={() => open(t.id)} />)}</div>}
        </section>
      )}

      {dropped.length > 0 && (
        <section className="group">
          <div className="list-head">
            <Help term="status_dropped" host><button className="log-toggle small-toggle" aria-expanded={showDropped} onClick={() => setShowDropped(!showDropped)}>
              <span aria-hidden>{showDropped ? '▾' : '▸'}</span> Dropped <span className="count-badge">{dropped.length}</span>
            </button></Help>
            {showDropped && dropped.length > 1 && <SortPick value={droppedSort} onChange={setDroppedSort} />}
          </div>
          {showDropped && <div className="tlist">{sortEnded(dropped, droppedSort).map((t) => <TaskRow key={t.id} t={t} today={today} sub={sub(t)} canTick={false} onOpen={() => open(t.id)} />)}</div>}
        </section>
      )}

      {adding && (
        <Modal title="New task" onClose={() => setAdding(false)}>
          <AddTaskForm people={people} meId={meId} today={today} projects={projects} wsByProject={workstreamsByProject} onDone={() => setAdding(false)} />
        </Modal>
      )}
      {openId && (
        <TaskDrawer key={`${openId}-${startStatus ?? ''}`} startStatus={startStatus} id={openId} meId={meId} isLead={isLead} people={people} today={today} projectNames={projectNames}
          workstreams={workstreamsByProject[opened?.projectId ?? (updates.items).find((i) => i.taskId === openId)?.projectId ?? ''] ?? []} onClose={() => setOpenId(null)} />
      )}
    </div>
  );
}
