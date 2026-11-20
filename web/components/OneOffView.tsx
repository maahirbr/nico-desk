'use client';

import { useState } from 'react';
import type { Task } from '@/lib/derive';
import { FoldChev } from './Fold';
import { Select } from './Select';
import { TaskDrawer, TaskRow, statusKey, type Opt, type RowAction } from './task-ui';
import { useOpenTask } from './taskUrl';

// One-off tasks you gave (20 Nov): what is still open, and, folded away, what was finished or dropped in the last 30 days.
// A sort picks the order. The status pill asks for an update, as on a project; a row opens the task.
type Sort = 'due' | 'given' | 'person' | 'status';
const SORTS: { key: Sort; word: string }[] = [
  { key: 'due', word: 'Due date' }, { key: 'given', word: 'Newest given' }, { key: 'person', word: 'Person' }, { key: 'status', word: 'Status' },
];
const STATUS_ORDER = ['blocked', 'todo', 'doing', 'done', 'dropped'];

export function OneOffView({ open, closed, names, people, meId, isLead, today, projectNames }: {
  open: Task[]; closed: Task[]; names: Record<string, string>; people: Opt[]; meId: string; isLead: boolean; today: string; projectNames: Record<string, string>;
}) {
  const [openId, setOpenId] = useOpenTask();
  const [start, setStart] = useState<RowAction | undefined>();
  const [sort, setSort] = useState<Sort>('due');
  const [showClosed, setShowClosed] = useState(false); // folded at first
  const by = (a: Task, b: Task) =>
    sort === 'given' ? b.createdAt.localeCompare(a.createdAt)
    : sort === 'person' ? (names[a.ownerId] ?? '').localeCompare(names[b.ownerId] ?? '') || a.dueOn.localeCompare(b.dueOn)
    : sort === 'status' ? STATUS_ORDER.indexOf(statusKey(a)) - STATUS_ORDER.indexOf(statusKey(b)) || a.dueOn.localeCompare(b.dueOn)
    : a.dueOn.localeCompare(b.dueOn) || a.title.localeCompare(b.title);
  const go = (id: string, a?: RowAction) => { setStart(a); setOpenId(id); };
  const row = (t: Task) => (
    <TaskRow key={t.id} t={t} today={today} names={names} owner={names[t.ownerId] ?? 'Someone'} canTick={false} canAsk
      onOpen={() => go(t.id)} onStatus={(a) => go(t.id, a)} />
  );
  const late = open.filter((t) => t.overdue).length;
  return (
    <div className="calm">
      <header className="page-head">
        <div>
          <h1>One-off tasks</h1>
          <p className="summary">Tasks you gave someone, outside any project · {open.length} open{late > 0 && <> · <span className="late-text">{late} late</span></>}</p>
        </div>
        {open.length > 1 && (
          <label className="f oneoff-sort"><span>Sort by</span>
            <Select value={sort} aria-label="Sort by" onChange={(v) => setSort(v as Sort)}>
              {SORTS.map((x) => <option key={x.key} value={x.key}>{x.word}</option>)}
            </Select>
          </label>
        )}
      </header>
      <section className="group">
        <h2>Open <span className="n">{open.length}</span></h2>
        {open.length > 0 ? <div className="tlist">{[...open].sort(by).map(row)}</div>
          : <p className="small dim">Nothing open. A task you give someone without a project shows here.</p>}
      </section>
      {closed.length > 0 && (
        <section className="group">
          <div className="list-head">
            <button className="log-toggle small-toggle" aria-expanded={showClosed} onClick={() => setShowClosed(!showClosed)}>
              <FoldChev /> Closed in the last 30 days <span className="count-badge">{closed.length}</span>
            </button>
          </div>
          {showClosed && <div className="tlist">{closed.map(row)}</div>}
        </section>
      )}
      {openId && <TaskDrawer key={`${openId}-${start ?? ''}`} id={openId} meId={meId} isLead={isLead} people={people} today={today} projectNames={projectNames}
        startStatus={start} onClose={() => { setOpenId(null); setStart(undefined); }} />}
    </div>
  );
}
