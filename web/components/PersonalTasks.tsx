'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Task } from '@/lib/derive';
import { DateField } from './DateField';
import { Fold, FoldChev } from './Fold';
import { useReadOnly } from './readonly';
import { flagOf, statusKey, TaskDrawer, TaskRow, type RowAction } from './task-ui';
import { Help } from './HelpMode';
import { useOpenTask } from './taskUrl';
import { notify } from './toast';

// Tasks in my Personal project (11 Nov), on top of the page, kept short: open ones by date, the first few showing,
// then "more"; finished ones folded away. "+ Add task" sits on the right of the heading, as on any project, and opens a
// one-line box under it (the PM's call, 13 Nov). The same five tiles as a project (Open, In progress, At risk, Late, Done) sit on
// top; pressing one shows only those, pressing it again clears it (the PM's call, 11 Nov). Adding is one line, a title and a date: they are mine, so no owner to pick.
// The row menu has the statuses and Move date; nothing to ask or hand on, as nobody else sees them.
const SHOWN = 5;

export function PersonalTasks({ tasks, projectId, teamId, meId, meName, today, projectNames }: {
  tasks: Task[]; projectId: string; teamId: string; meId: string; meName: string; today: string; projectNames: Record<string, string>;
}) {
  const router = useRouter();
  const readOnly = useReadOnly();
  const [openId, setOpenId] = useOpenTask();
  const [startStatus, setStartStatus] = useState<RowAction | undefined>();
  const [all, setAll] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [title, setTitle] = useState('');
  const [due, setDue] = useState(today);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [reopening, setReopening] = useState<Set<string>>(new Set()); // unticked, on its way back to open
  const [details, setDetails] = useState(''); // a second, quiet line under the name (13 Nov)
  const [tile, setTile] = useState<string | null>(null);
  const open = tasks.filter((t) => t.statusCategory === 'open').sort((a, b) => a.dueOn.localeCompare(b.dueOn) || a.title.localeCompare(b.title));
  const done = tasks.filter((t) => t.statusCategory === 'done').sort((a, b) => (b.closedAt ?? '').localeCompare(a.closedAt ?? ''));
  const tiles = [
    { key: 'open', label: 'Open', help: 'tile_open' as const, match: (t: Task) => t.statusCategory === 'open' },
    { key: 'doing', label: 'In progress', help: 'status_doing' as const, match: (t: Task) => t.statusCategory === 'open' && statusKey(t) === 'doing' },
    { key: 'at_risk', label: 'At risk', help: 'at_risk' as const, match: (t: Task) => t.statusCategory === 'open' && flagOf(t, today)?.key === 'at_risk', warn: true },
    { key: 'overdue', label: 'Late', help: 'late' as const, match: (t: Task) => t.overdue, warn: true },
    { key: 'done', label: 'Done', help: 'status_done' as const, match: (t: Task) => t.statusCategory === 'done' },
  ].map((x) => ({ ...x, n: tasks.filter(x.match).length }));
  const picked = tile ? tiles.find((x) => x.key === tile)! : null;
  const list = picked ? tasks.filter(picked.match).sort((a, b) => a.dueOn.localeCompare(b.dueOn)) : open;
  const shown = all || picked ? list : list.slice(0, SHOWN);
  const add = async () => {
    if (title.trim().length < 3 || !due) return;
    setBusy(true);
    try {
      const r = await fetch('/api/v1/tasks', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ teamId, title: title.trim(), ownerId: meId, dueOn: due, projectId, ...(details.trim() ? { description: details.trim() } : {}) }) });
      const data = await r.json().catch(() => null);
      if (!r.ok) throw new Error(data?.error?.message ?? 'Could not add the task.');
      setTitle(''); setDetails(''); router.refresh();
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
  // Clicking a task opens it, to change its name, details, date or note, as on any project.
  const row = (t: Task) => <TaskRow key={t.id} t={t} today={today} canTick={!readOnly} canBlock={!readOnly}
    onOpen={() => { setOpenId(t.id); setStartStatus(undefined); }} onStatus={(s) => { setOpenId(t.id); setStartStatus(s); }} onEdit={() => { setOpenId(t.id); setStartStatus(undefined); }} onDelete={() => void remove(t)} />;
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
          <DateField noQuick required min={today} value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due date" />
          <button className="btn" disabled={busy || title.trim().length < 3 || !due}>Add</button>
        </form>
      )}
      {list.length === 0 ? <p className="small dim">{picked ? 'None right now.' : 'Nothing to do here. Add something above.'}</p> : <div className="tlist">
        {/* Column headings, as on a project's table (13 Nov). */}
        <div className="trow trow-head has-acts" aria-hidden><span /><span>Task</span><span>Due date</span><span>Status</span><span /></div>
        {shown.map((t) => (t.statusCategory === 'open' ? row(t) : <TaskRow key={t.id} t={t} today={today} canTick={false} onOpen={() => setOpenId(t.id)} />))}</div>}
      {!picked && open.length > SHOWN && <button type="button" className="mini-btn" onClick={() => setAll(!all)}>{all ? 'Show fewer' : `${open.length - SHOWN} more`}</button>}
      {!picked && done.length > 0 && (<>
        <button type="button" className="log-toggle small-toggle" aria-expanded={showDone} onClick={() => setShowDone(!showDone)}><FoldChev /> Done <span className="count-badge">{done.length}</span></button>
        {/* Ticked by mistake? Untick it and it is open again (my own Personal task: no reason needed, 13 Nov). */}
        <Fold open={showDone}><div className="tlist">{done.filter((t) => !reopening.has(t.id)).map((t) => (
          <TaskRow key={t.id} t={t} today={today} canTick={false} onOpen={() => setOpenId(t.id)} onReopen={() => void reopen(t)} onEdit={() => setOpenId(t.id)} />
        ))}</div></Fold>
      </>)}
      {openId && <TaskDrawer key={`${openId}-${startStatus ?? ''}`} startStatus={startStatus} id={openId} meId={meId} isLead={false}
        people={[{ id: meId, name: meName }]} today={today} projectNames={projectNames} onClose={() => setOpenId(null)} />}
    </section>
  );
}
