'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useJev } from './jevFlag';
import { Select } from './Select';
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
import { NewNotices } from './NewNotices';
import { UpdatesCard } from './UpdatesCard';
import { useReadOnly } from './readonly';
import { WaitingCard } from './WaitingCard';
import { AddTaskForm, Modal, TaskDrawer, TaskRow, api, type Opt, type RowAction, type StatusKey } from './task-ui';
import { Stagger } from './motion-ui';
import { DitherArt } from './DitherArt';
import type { Mention } from '@/lib/comments';

const HEAD: Record<string, HelpTerm> = { late: 'late', today: 'group_today', week: 'group_this_week', later: 'group_later' };

// Home: what is on your plate, grouped by when it is due. One line per task; click for detail.

export function HomeView({ greeting, today, weekEnd, meId, isLead, updates, mine, newIds, assignedNotice, noticeIds, movedAway, mentions, waiting, done, dropped, names, projectNames, people, projects, workstreamsByProject, myProjects }: {
  greeting: string; today: string; weekEnd: string; meId: string; isLead: boolean; updates: { items: UpdateItem[]; groups: UpdateGroup[]; now: string }; mine: Task[]; newIds: string[];
  assignedNotice: Record<string, string>; noticeIds: string[]; movedAway: MovedAway[]; mentions: Mention[]; waiting: Task[]; done: Task[]; dropped: Task[]; names: Record<string, string>;
  projectNames: Record<string, string>; people: Opt[]; projects: Opt[]; workstreamsByProject: Record<string, string[]>;
  myProjects: { id: string; name: string; role: string }[];
}) {
  const readOnly = useReadOnly();
  const [openId, setOpenId] = useOpenTask();
  const [startStatus, setStartStatus] = useState<RowAction | undefined>();
  const [adding, setAdding] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [showDropped, setShowDropped] = useState(false);
  // The two finished-list sorts come back the next time Home is opened in this browser (components/remember.ts).
  const [kept, keep] = useRemembered('home', { doneSort: 'recent' as EndedSort, droppedSort: 'recent' as EndedSort },
    (raw) => ({ doneSort: endedSortOf(raw.doneSort), droppedSort: endedSortOf(raw.droppedSort) }), ['doneSort', 'droppedSort']);
  const { doneSort, droppedSort } = kept;
  const setDoneSort = (v: EndedSort) => keep('doneSort', v);
  const setDroppedSort = (v: EndedSort) => keep('droppedSort', v);
  const isNew = new Set(newIds);
  // Suggested order (Jev). Off unless the person picks it. The default stays the date groups below. When Jev has no
  // answer, the list stays as it is and a short note says so.
  const jev = useJev();
  const [order, setOrder] = useState<'date' | 'suggested'>('date');
  const [ranked, setRanked] = useState<{ ids: string[]; why: Record<string, string> } | null>(null);
  const [orderNote, setOrderNote] = useState<string | null>(null);
  const [ordering, setOrdering] = useState(false);
  async function pickOrder(v: string) {
    setOrderNote(null);
    if (v !== 'suggested') { setOrder('date'); return; }
    setOrdering(true);
    try {
      const r = await api('/me/tasks/order', 'POST');
      if (r?.ok && Array.isArray(r.ids)) { setRanked({ ids: r.ids, why: r.why ?? {} }); setOrder('suggested'); }
      else { setOrder('date'); setOrderNote('No suggestion right now. Showing the default order.'); }
    } catch { setOrder('date'); setOrderNote('No suggestion right now. Showing the default order.'); }
    finally { setOrdering(false); }
  }
  const suggested = order === 'suggested' && ranked
    ? (() => {
        const byId = new Map(mine.map((t) => [t.id, t]));
        const first = ranked.ids.map((id) => byId.get(id)).filter((t): t is Task => !!t);
        const seen = new Set(first.map((t) => t.id));
        return [...first, ...mine.filter((t) => !seen.has(t.id))];
      })()
    : null;
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
            <NewNotices known={noticeIds} />
          </p>
        </div>
        {!readOnly && <button className="btn head-new" onClick={() => setAdding(true)}>+ New task</button>}
      </header>

      <UpdatesCard items={updates.items} groups={updates.groups} meId={meId} now={updates.now} onOpen={(id) => open(id)} />

      <MentionsCard items={mentions} />

      <MovedAwayCard items={movedAway} />

      <WaitingCard tasks={waiting} names={names} projectNames={projectNames} now={updates.now} onOpen={(id) => open(id)} />

      {groups.length === 0 && (
        <div className="empty-state">
          <DitherArt field="hill" className="dither-empty" fade />
          <p>You’re clear. Nothing open on your side.</p>
          {!readOnly && <button className="btn" onClick={() => setAdding(true)}>Add a task</button>}
        </div>
      )}

      {jev && !readOnly && mine.length > 1 && (
        <div className="suggest-bar">
          <Help term="jev_order"><label className="dim" htmlFor="home-order">Order</label></Help>
          <Select id="home-order" className="sort-pick" value={order} disabled={ordering} onChange={pickOrder}>
            <option value="date">By date</option>
            <option value="suggested">Suggested</option>
          </Select>
          {ordering && <span className="suggest-note">Reading your tasks…</span>}
          {suggested && <span className="suggest-note">A suggestion from the words and the dates. Your own order is By date.</span>}
          {orderNote && <span className="suggest-note" role="status">{orderNote}</span>}
        </div>
      )}

      {suggested && (
        <Stagger id="home-suggested" className="tlist">
          {suggested.map((t) => <TaskRow key={t.id} t={t} today={today} sub={[ranked?.why[t.id], sub(t)].filter(Boolean).join(' · ')} canTick canBlock={t.ownerId === meId || isLead} canReassign={isLead} onOpen={() => open(t.id)} onStatus={(s) => open(t.id, s)} />)}
        </Stagger>
      )}

      {!suggested && groups.map((g) => (
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
