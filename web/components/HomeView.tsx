'use client';

import { useState } from 'react';
import type { Task } from '@/lib/derive';
import { fmtDate } from '@/lib/time';
import type { AskItem } from '@/lib/service';
import { Asks } from './Asks';
import { AddTaskForm, Modal, TaskDrawer, TaskRow, type Opt, type StatusKey } from './task-ui';

// Home: what is on your plate, grouped by when it is due. One line per task; click for detail.

export function HomeView({ greeting, today, weekEnd, meId, isLead, mine, newIds, assignedNotice, waiting, asks, done, names, projectNames, people, projects, workstreamsByProject }: {
  greeting: string; today: string; weekEnd: string; meId: string; isLead: boolean; mine: Task[]; newIds: string[];
  assignedNotice: Record<string, string>; waiting: Task[]; asks: { ofMe: AskItem[]; byMe: AskItem[] }; done: Task[]; names: Record<string, string>;
  projectNames: Record<string, string>; people: Opt[]; projects: Opt[]; workstreamsByProject: Record<string, string[]>;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [startStatus, setStartStatus] = useState<StatusKey | undefined>();
  const [adding, setAdding] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const isNew = new Set(newIds);
  const sub = (t: Task) => [isNew.has(t.id) ? 'New' : '', t.projectId ? projectNames[t.projectId] : '', t.workstream ?? '', t.note ?? ''].filter(Boolean).join(' · ');
  const groups = [
    { key: 'late', label: 'Late', items: mine.filter((t) => t.dueOn < today) },
    { key: 'today', label: 'Today', items: mine.filter((t) => t.dueOn === today) },
    { key: 'week', label: 'This week', items: mine.filter((t) => t.dueOn > today && t.dueOn <= weekEnd) },
    { key: 'later', label: 'Later', items: mine.filter((t) => t.dueOn > weekEnd) },
  ].filter((g) => g.items.length);
  const overdue = mine.filter((t) => t.dueOn < today).length;
  const open = (id: string, s?: StatusKey) => {
    setOpenId(id); setStartStatus(s);
    if (assignedNotice[id]) fetch(`/api/v1/me/notices/${assignedNotice[id]}/read`, { method: 'POST' }).catch(() => {});
  };
  const opened = [...mine, ...waiting, ...done].find((t) => t.id === openId);

  return (
    <div className="calm">
      <header className="page-head">
        <div>
          <h1>{greeting}</h1>
          <p className="summary">
            {mine.length ? <>{mine.length} open{overdue > 0 && <> · <span className="late-text">{overdue} late</span></>}</> : 'Nothing open'}
            {asks.ofMe.length > 0 && <> · {asks.ofMe.length} asked of you</>}
            {waiting.length > 0 && <> · {waiting.length} waiting on you</>}
            <span className="dim"> · {fmtDate(today)}</span>
          </p>
        </div>
      </header>

      <Asks ofMe={asks.ofMe} byMe={asks.byMe} today={today} names={names} />

      {waiting.length > 0 && (
        <section className="callout">
          <h2>Waiting on you</h2>
          {waiting.map((t) => (
            <button key={t.id} className="callout-row" onClick={() => open(t.id)}>
              <b>{names[t.ownerId]?.split(' ')[0]}</b> needs: {t.blocked?.ask}
              <span className="dim"> · for “{t.title}”</span>
            </button>
          ))}
        </section>
      )}

      {groups.length === 0 && (
        <div className="empty-state">
          <p>You’re clear. Nothing open on your side.</p>
          <button className="btn" onClick={() => setAdding(true)}>Add a task</button>
        </div>
      )}

      {groups.map((g) => (
        <section key={g.key} className="group">
          <h2 className={g.key === 'late' ? 'late-text' : ''}>{g.label} <span className="n">{g.items.length}</span></h2>
          <div className="tlist">
            {g.items.map((t) => <TaskRow key={t.id} t={t} today={today} sub={sub(t)} canTick onOpen={() => open(t.id)} onStatus={(s) => open(t.id, s)} />)}
          </div>
        </section>
      ))}

      {done.length > 0 && (
        <section className="group">
          <button className="log-toggle small-toggle" aria-expanded={showDone} onClick={() => setShowDone(!showDone)}>
            <span aria-hidden>{showDone ? '▾' : '▸'}</span> Done this week <span className="count-badge">{done.length}</span>
          </button>
          {showDone && <div className="tlist">{done.map((t) => <TaskRow key={t.id} t={t} today={today} sub={sub(t)} canTick={false} onOpen={() => open(t.id)} />)}</div>}
        </section>
      )}

      {adding && (
        <Modal title="New task" onClose={() => setAdding(false)}>
          <AddTaskForm people={people} meId={meId} today={today} projects={projects} wsByProject={workstreamsByProject} onDone={() => setAdding(false)} />
        </Modal>
      )}
      {openId && (
        <TaskDrawer key={`${openId}-${startStatus ?? ''}`} startStatus={startStatus} id={openId} meId={meId} isLead={isLead} people={people} today={today} projectNames={projectNames}
          workstreams={opened?.projectId ? workstreamsByProject[opened.projectId] ?? [] : []} onClose={() => setOpenId(null)} />
      )}
    </div>
  );
}
