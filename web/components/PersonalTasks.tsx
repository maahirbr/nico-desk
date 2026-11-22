'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Task } from '@/lib/derive';
import { NO_DATE } from '@/lib/time';
import { DateField } from './DateField';
import { Fold, FoldChev } from './Fold';
import { useReadOnly } from './readonly';
import { flagOf, PrioPick, prioRank, statusKey, TaskRow, type PrioValue } from './task-ui';
import { Help } from './HelpMode';
import { usePersonalOpen } from './PersonalDrawer';
import { notify } from './toast';

// Tasks in my Personal project (11 Nov), on top of the page, kept short: open ones by date, the first few showing,
// then "more"; finished ones folded away. "+ Add task" sits on the right of the heading, as on any project, and opens a
// one-line box under it (the PM's call, 13 Nov). The same five tiles as a project (Open, In progress, At risk, Late, Done) sit on
// top; pressing one shows only those, pressing it again clears it (the PM's call, 11 Nov). Adding is one line, a title and a date: they are mine, so no owner to pick.
// The row menu has the statuses and Move date; nothing to ask or hand on, as nobody else sees them.
const SHOWN = 5;

export function PersonalTasks({ tasks, projectId, teamId, meId, meName, today }: {
  tasks: Task[]; projectId: string; teamId: string; meId: string; meName: string; today: string;
}) {
  const router = useRouter();
  const readOnly = useReadOnly();
  const openTask = usePersonalOpen(); // the page's one drawer (PersonalDrawer.tsx)
  const [all, setAll] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [title, setTitle] = useState('');
  const [due, setDue] = useState(''); // the date is optional here (14 Nov): none is stored as NO_DATE and shows as "No date"
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [reopening, setReopening] = useState<Set<string>>(new Set()); // unticked, on its way back to open
  const [details, setDetails] = useState(''); // a second, quiet line under the name (13 Nov)
  const [tile, setTile] = useState<string | null>(null);
  const [prio, setPrio] = useState<PrioValue | ''>(''); // optional, none to start (20 Nov)
  const [drag, setDrag] = useState<string | null>(null);
  // P1, then P2, then P3, then the rest (20 Nov); within each, the order I set by dragging, then by date.
  const byMine = (a: Task, b: Task) => prioRank(a) - prioRank(b)
    || (a.personalOrder ?? 1e9) - (b.personalOrder ?? 1e9) || a.dueOn.localeCompare(b.dueOn) || a.title.localeCompare(b.title);
  const open = tasks.filter((t) => t.statusCategory === 'open').sort(byMine);
  const done = tasks.filter((t) => t.statusCategory === 'done').sort((a, b) => (b.closedAt ?? '').localeCompare(a.closedAt ?? ''));
  const tiles = [
    { key: 'open', label: 'Open', help: 'tile_open' as const, match: (t: Task) => t.statusCategory === 'open' },
    { key: 'doing', label: 'In progress', help: 'status_doing' as const, match: (t: Task) => t.statusCategory === 'open' && statusKey(t) === 'doing' },
    { key: 'at_risk', label: 'At risk', help: 'at_risk' as const, match: (t: Task) => t.statusCategory === 'open' && flagOf(t, today)?.key === 'at_risk', warn: true },
    { key: 'overdue', label: 'Overdue', help: 'late' as const, match: (t: Task) => t.overdue, warn: true },
    { key: 'done', label: 'Done', help: 'status_done' as const, match: (t: Task) => t.statusCategory === 'done' },
  ].map((x) => ({ ...x, n: tasks.filter(x.match).length }));
  const picked = tile ? tiles.find((x) => x.key === tile)! : null;
  const list = picked ? tasks.filter(picked.match).sort((a, b) => a.dueOn.localeCompare(b.dueOn)) : open;
  const shown = all || picked ? list : list.slice(0, SHOWN);
  const add = async () => {
    if (title.trim().length < 3) return;
    setBusy(true);
    try {
      const r = await fetch('/api/v1/tasks', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ teamId, title: title.trim(), ownerId: meId, dueOn: due || NO_DATE, projectId, ...(details.trim() ? { description: details.trim() } : {}), ...(prio ? { priority: prio } : {}) }) });
      const data = await r.json().catch(() => null);
      if (!r.ok) throw new Error(data?.error?.message ?? 'Could not add the task.');
      setTitle(''); setDetails(''); setDue(''); setPrio(''); router.refresh();
    } catch (e) { notify((e as Error).message); } finally { setBusy(false); }
  };
  // Delete takes the task off the page. Underneath it is dropped, with the app's usual record, so nothing is lost.
  const remove = async (t: Task) => {
    const r = await fetch(`/api/v1/tasks/${t.id}/close`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ version: t.version, as: 'dropped', reason: 'Deleted from Personal' }) });
    if (r.ok) { notify('Task deleted'); router.refresh(); }
    else notify((await r.json().catch(() => null))?.error?.message ?? 'Could not delete it.');
  };
  const reopen = async (t: Task) => {
    setReopening((x) => new Set([...x, t.id]));
    const r = await fetch(`/api/v1/tasks/${t.id}/reopen`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ version: t.version, reason: '' }) });
    if (r.ok) { notify('Opened again'); router.refresh(); }
    else { setReopening((x) => { const n = new Set(x); n.delete(t.id); return n; }); notify((await r.json().catch(() => null))?.error?.message ?? 'Could not reopen it.'); }
  };
  // Drag a task by its handle to change my order, within the same priority (20 Nov). The new order is saved for me only.
  const dropOn = async (target: Task) => {
    const from = open.find((x) => x.id === drag);
    setDrag(null);
    if (!from || from.id === target.id || prioRank(from) !== prioRank(target)) return;
    const ids = open.map((x) => x.id).filter((x) => x !== from.id);
    ids.splice(ids.indexOf(target.id), 0, from.id);
    const r = await fetch(`/api/v1/projects/${projectId}/order`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ids }) });
    if (r.ok) router.refresh(); else notify('Could not save the order.');
  };
  const canDrag = !readOnly && !picked;
  // Clicking a task opens it, to change its name, details, date or note, as on any project.
  const row = (t: Task) => (
    <div key={t.id} className={`ptask-drag${drag === t.id ? ' dragging' : ''}`} draggable={canDrag} onDragStart={() => setDrag(t.id)} onDragEnd={() => setDrag(null)}
      onDragOver={(e) => { if (drag && drag !== t.id) e.preventDefault(); }} onDrop={() => void dropOn(t)}>
      {canDrag && <span className="drag-handle" title="Drag to change the order" aria-hidden>⋮⋮</span>}
      <TaskRow t={t} today={today} names={{ [meId]: meName }} canTick={!readOnly} canBlock={!readOnly} showPrio
        onOpen={() => openTask(t.id)} onStatus={(s) => openTask(t.id, s)} onEdit={() => openTask(t.id)} onDelete={() => void remove(t)} />
    </div>
  );
  return (
    <section className="ptasks" aria-labelledby="ptasks-h">
      <div className="stats tiles">
        {tiles.map((x) => (
          <Help key={x.key} term={x.help} host>
            <button className={`card stat${x.warn && x.n ? ' warn' : ''}`} aria-pressed={tile === x.key}
              title={tile === x.key ? 'Clear this filter' : 'Show only these'} onClick={() => setTile(tile === x.key ? null : x.key)}>
              <div className="stat-n">{x.n}</div><div className="stat-l">{x.label}</div>
            </button>
          </Help>
        ))}
      </div>
      <div className="psec-head"><h2 id="ptasks-h">{picked ? picked.label : 'Tasks'} <span className="count-badge">{list.length}</span></h2>
        <span className="row" style={{ gap: 'var(--space-sm)', alignItems: 'center' }}>
          {picked && <button type="button" className="linkbtn" onClick={() => setTile(null)}>Show all</button>}
          {/* The same button, in the same place, as on any project (the PM's call, 13 Nov). */}
          {!readOnly && <button type="button" className="btn" aria-expanded={adding} onClick={() => { setAdding(!adding); if (adding) setTitle(''); }}>{adding ? 'Close' : '+ Add task'}</button>}
        </span></div>
      {!readOnly && adding && (
        <form className="ptask-add" onSubmit={(e) => { e.preventDefault(); void add(); }} onKeyDown={(e) => { if (e.key === 'Escape') { setAdding(false); setTitle(''); } }}>
          {/* One box: the name, a thin line, then the details (13 Nov). */}
          <div className="ptask-box">
            <input autoFocus value={title} maxLength={200} placeholder="Task name" aria-label="New task" onChange={(e) => setTitle(e.target.value)} />
            <input className="ptask-details" maxLength={600} value={details} placeholder="Details" aria-label="Details" onChange={(e) => setDetails(e.target.value)} />
          </div>
          <DateField noQuick min={today} value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due date (optional)" />
          <PrioPick value={prio} onChange={setPrio} />
          <button className="btn" disabled={busy || title.trim().length < 3}>Add</button>
        </form>
      )}
      {list.length === 0 ? <p className="small dim">{picked ? 'None right now.' : 'Nothing to do here. Add something above.'}</p> : <div className="tlist">
        {/* Column headings, as on a project's table (13 Nov). */}
        <div className="trow trow-head has-acts" aria-hidden><span /><span>Task</span><span>Due date</span><span>Status</span><span /></div>
        {shown.map((t) => (t.statusCategory === 'open' ? row(t) : <TaskRow key={t.id} t={t} today={today} names={{ [meId]: meName }} canTick={false} onOpen={() => openTask(t.id)} />))}</div>}
      {!picked && open.length > SHOWN && <button type="button" className="mini-btn" onClick={() => setAll(!all)}>{all ? 'Show fewer' : `${open.length - SHOWN} more`}</button>}
      {!picked && done.length > 0 && (<>
        <button type="button" className="log-toggle small-toggle" aria-expanded={showDone} onClick={() => setShowDone(!showDone)}><FoldChev /> Done <span className="count-badge">{done.length}</span></button>
        {/* Ticked by mistake? Untick it and it is open again (my own Personal task: no reason needed, 13 Nov). */}
        <Fold open={showDone}><div className="tlist">{done.filter((t) => !reopening.has(t.id)).map((t) => (
          <TaskRow key={t.id} t={t} today={today} names={{ [meId]: meName }} canTick={false} onOpen={() => openTask(t.id)} onReopen={() => void reopen(t)} onEdit={() => openTask(t.id)} />
        ))}</div></Fold>
      </>)}
    </section>
  );
}
