'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Fragment, useEffect, useRef, useState } from 'react';
import { DitherArt } from './DitherArt';
import { sortEnded, type EndedSort, type Task } from '@/lib/derive';
import type { Proposal } from '@/lib/planUtil';
import { fmtDate, isDate, istInstant } from '@/lib/time';
import { AddedSince, sinceWords } from './AddedSince';
import { Person, PersonLink } from './chips';
import { TaskLinkChips } from './TaskLinks';
import { IMPORT_EVENT } from './MeetingSection';
import { OPEN_ADD_EVENT } from './setupEvents';
import { useOpenTask } from './taskUrl';
import { DateField } from './DateField';
import { Help } from './HelpMode';
import { ImportPanel, Inbox } from './Minutes';
import { arrivals, focusOnDesktop } from './motion';
import { OwnerPicker, ownerFields, ownerReady, useProjectPeople } from './OwnerPicker';
import { useReadOnly } from './readonly';
import { BoardStatusMenu, MotionRow, MovedDate } from './rowmotion';
import { Select } from './Select';
import { SortPick } from './SortPick';
import { canMoveTo } from './statusRules';
import { FlagChip, flagOf, formFor, PICK, quickMove, STATUS, StatusIcon, statusKey, TaskDrawer, type RowAction, type StatusKey } from './task-ui';
import { notify } from './toast';
import { editFields, statusFields, type UndoField } from '@/lib/undo';
import { useUndo } from './undo';
import { endedSortOf, oneOf } from '@/lib/remember';
import { useRemembered, useUrlText } from './remember';
import { TaskLink } from './TaskLink';
import type { QuickParse } from '@/lib/quickadd';
import { QuickAddField } from './QuickAdd';
import { TaskDrafts } from './TaskDrafts';
import type { SentenceRead } from '@/lib/sentence';
import { FreshDot } from './viewer';
import { playFor } from './sound';
import { isRealEnter } from './ime';
import { Count } from './LimitNotice';
import { Fold, FoldChev } from './Fold';

// A project's tasks as one board: number cards that filter, people and sub-project filters, and a
// table where each task shows what it is about, its owner, date and status. Status changes in the
// row; edits open in the row; the side panel has the full detail. Every change goes through /api/v1.

type P = { id: string; name: string; role: string; department: string };
type LogItem = { id: string; at: string; who: string; whoId?: string | null; text: string; task: string; taskId: string | null; reason: string | null };

async function call(path: string, method: string, body?: unknown) {
  const res = await fetch(`/api/v1${path}`, {
    method, headers: body === undefined ? undefined : { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
  });
  playFor(method, path, body, res.ok);
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error?.message ?? `Request failed (${res.status}).`);
  return data;
}

const TILE_KEYS = ['open', 'doing', 'at_risk', 'overdue', 'done'] as const; // the keys of `tiles` in TaskBoard

type Prompt =
  | { kind: 'status'; t: Task }
  | { kind: 'blocked'; t: Task }
  | { kind: 'remove'; t: Task }
  | { kind: 'reopen'; t: Task }
  | null;

// Brings a part of the board to the top of the view, just below any bar that sticks over its column (the Warm top
// bar, or the side bar at phone width). When .main is the scroller (Cool on desktop), its own padding clears its bar.
function bringIntoView(selector: string) {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) return;
  let below = 0;
  if (document.documentElement.scrollHeight > window.innerHeight) {
    const r = el.getBoundingClientRect();
    for (const bar of document.querySelectorAll('.view-banner, .side, .topbar')) {
      const b = bar.getBoundingClientRect();
      if (getComputedStyle(bar).position === 'sticky' && b.left < r.right && b.right > r.left) below = Math.max(below, b.bottom);
    }
  }
  el.style.scrollMarginTop = below ? `${Math.round(below) + 8}px` : '';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}
const importIntoView = () => bringIntoView('.imp-panel');

export function TaskBoard({ projectId, tasks, people, names, projectNames = {}, meId, isLead, today, log, workstreams = [], proposals = [] }: {
  projectId: string; tasks: Task[]; people: P[]; names: Record<string, string>; projectNames?: Record<string, string>;
  meId: string; isLead: boolean; today: string; log: LogItem[]; workstreams?: string[]; proposals?: Proposal[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<Prompt>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  // The filters come back the next time this project is opened in this browser (components/remember.ts).
  const [kept, keep] = useRemembered(`project:${projectId}`, { tile: null as string | null, who: null as string | null, ws: 'All', closedSort: 'recent' as EndedSort }, (raw) => ({
    closedSort: endedSortOf(raw.closedSort),
    tile: oneOf(raw.tile, TILE_KEYS, null), who: oneOf(raw.who, people.map((p) => p.id), null), ws: oneOf(raw.ws, ['All', '__none', ...workstreams, ...tasks.map((t) => t.workstream ?? '').filter(Boolean)], 'All'),
  }), ['tile', 'who', 'ws', 'closedSort']);
  const { tile, who, ws, closedSort } = kept;
  const setTile = (v: string | null) => keep('tile', v);
  const setWho = (v: string | null) => keep('who', v);
  const setWs = (v: string) => keep('ws', v);
  const setClosedSort = (v: EndedSort) => keep('closedSort', v);
  // "Added since" lives in the address only (?added=YYYY-MM-DD), never remembered: a meeting's review is for that day.
  const [addedRaw, setAdded] = useUrlText('added');
  const added = isDate(addedRaw) && addedRaw <= today ? addedRaw : null;
  const cutoff = added ? istInstant(`${added}T00:00`)!.getTime() : null;
  const inAdded = (t: Task) => cutoff === null || (t.statusCategory !== 'dropped' && new Date(t.createdAt).getTime() >= cutoff);
  const [importOpen, setImportOpen] = useState(false);
  // The Meeting section's "Write the minutes" and the setup list's "Import minutes" open the import panel below and
  // bring it into view. The scroll waits for the render that adds the panel: a frame alone can run before it.
  const scrollToImport = useRef(false);
  useEffect(() => {
    const open = () => {
      if (document.querySelector('.imp-panel')) { importIntoView(); return; } // already open: no render will follow
      scrollToImport.current = true; setImportOpen(true);
    };
    window.addEventListener(IMPORT_EVENT, open);
    return () => window.removeEventListener(IMPORT_EVENT, open);
  }, []);
  useEffect(() => {
    if (!importOpen || !scrollToImport.current) return;
    scrollToImport.current = false;
    importIntoView();
  }, [importOpen]);
  const [addOpen, setAddOpen] = useState(false);
  // The setup check-list's "Add a task" opens the form and brings it into view.
  useEffect(() => {
    const open = () => {
      setAddOpen(true);
      requestAnimationFrame(() => bringIntoView('.board-head'));
    };
    window.addEventListener(OPEN_ADD_EVENT, open);
    return () => window.removeEventListener(OPEN_ADD_EVENT, open);
  }, []);
  const [doneOpen, setDoneOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [openId, setOpenId] = useOpenTask();
  const [startStatus, setStartStatus] = useState<RowAction | undefined>();

  async function planOp(body: Record<string, unknown>): Promise<boolean> {
    setBusy(true); setError(null);
    try {
      const data = await call(`/projects/${projectId}/plan`, 'POST', body);
      if (data?.note) setNote(data.note);
      router.refresh();
      return true;
    } catch (e) { setError((e as Error).message); return false; }
    finally { setBusy(false); }
  }

  const readOnly = useReadOnly(); // admin viewing as someone else: every write control stays away
  const may = (t: Task) => !readOnly && !t.readOnly && (t.ownerId === meId || isLead);
  const open = tasks.filter((t) => t.statusCategory === 'open');
  const tiles = [
    { key: 'open', label: 'Open', help: 'tile_open' as const, n: open.length, match: (t: Task) => t.statusCategory === 'open' },
    { key: 'doing', label: 'In progress', help: 'status_doing' as const, n: open.filter((t) => statusKey(t) === 'doing').length, match: (t: Task) => t.statusCategory === 'open' && statusKey(t) === 'doing' },
    { key: 'at_risk', label: 'At risk', help: 'at_risk' as const, n: open.filter((t) => flagOf(t, today)?.key === 'at_risk').length, match: (t: Task) => flagOf(t, today)?.key === 'at_risk', warn: true },
    { key: 'overdue', label: 'Late', help: 'late' as const, n: tasks.filter((t) => t.overdue).length, match: (t: Task) => t.overdue, warn: true },
    { key: 'done', label: 'Done', help: 'status_done' as const, n: tasks.filter((t) => t.statusCategory === 'done').length, match: (t: Task) => t.statusCategory === 'done' },
  ];
  const inWs = (t: Task, k: string) => k === 'All' || (k === '__none' ? !t.workstream : t.workstream === k);
  const visible = tasks.filter((t) => (!who || t.ownerId === who) && inWs(t, ws) && (!tile || tiles.find((x) => x.key === tile)!.match(t)) && inAdded(t));
  const wsList = [...new Set([...workstreams, ...tasks.map((t) => t.workstream).filter((x): x is string => !!x)])];
  const byDue = (a: Task, b: Task) => a.dueOn.localeCompare(b.dueOn);
  // With "added since", the order they were added, so a meeting reads its to-dos back in the order it agreed them.
  const byAdded = (a: Task, b: Task) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  const openRows = visible.filter((t) => t.statusCategory === 'open').sort(cutoff === null ? byDue : byAdded);
  const closedRows = sortEnded(visible.filter((t) => t.statusCategory !== 'open'), closedSort);
  const involved = people.filter((p) => tasks.some((t) => t.ownerId === p.id));
  const filtered = !!(tile || who || ws !== 'All' || added);
  const clearAll = () => { setTile(null); setWho(null); setWs('All'); setAdded(''); };

  // undoSpec: the task before and the fields the change touched, so its toast can offer Undo (lib/undo.ts).
  const undo = useUndo();
  async function run(fn: () => Promise<unknown>, done?: string, undoSpec?: { before: Task; fields: UndoField[] }) {
    setBusy(true); setError(null);
    try { await fn(); if (done) { if (undoSpec) undo.announce(done, undoSpec.before, undoSpec.fields); else notify(done); } setPrompt(null); setEditing(null); router.refresh(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  // Blocked, dropped and going back to not started ask for words; the rest is one click.
  async function changeStatus(t: Task, s: StatusKey) {
    if (s === statusKey(t)) return;
    if (t.statusCategory !== 'open') return setPrompt({ kind: 'reopen', t });
    const f = formFor(t, s);
    if (f === 'blocked') return setPrompt({ kind: 'blocked', t });
    if (f === 'drop') return setPrompt({ kind: 'remove', t });
    if (f === 'status') return setPrompt({ kind: 'status', t });
    await run(() => quickMove(t, s), t.blocked && s === 'doing' ? 'Unblocked, in progress' : `Status set to ${STATUS[s].word}`, { before: t, fields: statusFields(t, s) });
  }

  const row = (t: Task) => {
    if (editing === t.id) return <EditRow key={t.id} t={t} people={people} workstreams={wsList} today={today} busy={busy} canReassign={t.ownerId === meId || isLead}
      onCancel={() => setEditing(null)} onSave={(body, due) => run(async () => {
        let v = t.version;
        if (due) v = (await call(`/tasks/${t.id}/renegotiate`, 'POST', { version: v, ...due })).version;
        if (Object.keys(body).length) await call(`/tasks/${t.id}`, 'PATCH', { version: v, ...body });
      }, due ? `Date moved to ${fmtDate(due.newDueOn)}` : 'Changes saved', { before: t, fields: [...(due ? ['due' as const] : []), ...editFields(body)] })} />;
    const s = statusKey(t);
    const st = STATUS[s];
    const can = may(t);
    const p = prompt && prompt.t.id === t.id ? prompt : null;
    return (
      <Fragment key={t.id}>
        <MotionRow id={t.id} className={t.statusCategory === 'open' ? '' : 'done-row'}>
          <td className="check-cell">
            <input type="checkbox" aria-label={`Mark “${t.title}” done`} checked={t.statusCategory === 'done'} disabled={!can || busy || t.statusCategory === 'dropped'}
              onChange={(e) => (e.target.checked ? changeStatus(t, 'done') : setPrompt({ kind: 'reopen', t }))} />
          </td>
          <td className="title">
            <TaskLink id={t.id} className="task-link" onOpen={() => { setOpenId(t.id); setStartStatus(undefined); }}>{t.title}</TaskLink><FreshDot id={t.id} />
            {ws === 'All' && t.workstream && <span className="ws-tag">{t.workstream}</span>}
            {t.description && <div className="desc">{t.description}</div>}
            {t.note && <div className="sub note-line">{t.note}</div>}
            {t.blocked && <div className="sub blocked-line">{t.blocked.onId ? <><Help term="blocked_on">Waiting on</Help> <PersonLink id={t.blocked.onId}>{names[t.blocked.onId]}</PersonLink>: </> : <><Help term="status_blocked">Blocked</Help>: </>}{t.blocked.ask}</div>}
            {t.links.length > 0 && <div className="sub"><TaskLinkChips links={t.links} onMore={() => { setOpenId(t.id); setStartStatus(undefined); }} /></div>}
          </td>
          <td data-label="Owner"><Person id={t.ownerId} name={names[t.ownerId] ?? t.ownerId} /></td>
          <td className={`due${t.overdue ? ' late' : ''}`} data-label="Due">
            <MovedDate value={t.dueOn} text={fmtDate(t.dueOn)} fmt={fmtDate} />
            {t.dateMoves > 0 && t.statusCategory === 'open' && (
              <div>
                <Help term="pushed"><span className="pushed">pushed {t.dateMoves}×</span></Help>
                {t.renegotiations.map((r) => <span key={r.at} className="trail" title={r.reason ?? undefined}>{fmtDate(r.from)}</span>)}
              </div>
            )}
          </td>
          <td>
            {can && t.statusCategory === 'open' ? (
              <BoardStatusMenu t={t} current={s} disabled={busy} statuses={PICK.filter((k) => k === s || canMoveTo(t, k, meId, isLead))} canReassign={isLead}
                onPick={(a) => (a === 'date' || a === 'reassign' ? (setOpenId(t.id), setStartStatus(a)) : changeStatus(t, a))} />
            ) : <span className={`st st-status tone-${st.tone}`}><StatusIcon s={s} />{st.word}</span>}
            <div><FlagChip t={t} today={today} /></div>
          </td>
          <td className="act-cell">
            {can && t.statusCategory === 'open' && (
              <span className="row-actions">
                <button className="row-btn" title="Edit" aria-label={`Edit “${t.title}”`} onClick={() => { setEditing(t.id); setPrompt(null); }}>✎</button>
                <button className="row-btn del" title="Drop, with a reason" aria-label={`Drop “${t.title}”`} onClick={() => setPrompt({ kind: 'remove', t })}>✕</button>
              </span>
            )}
          </td>
        </MotionRow>
        {p && <PromptRow p={p} people={people.filter((x) => x.id !== t.ownerId)} today={today} busy={busy} onCancel={() => setPrompt(null)}
          onGo={(v) => run(async () => {
            if (p.kind === 'status') return quickMove(t, 'todo', v.text);
            if (p.kind === 'blocked') return call(`/tasks/${t.id}/block`, 'POST', { version: t.version, onId: v.person || null, ask: v.text });
            if (p.kind === 'remove') return call(`/tasks/${t.id}/close`, 'POST', { version: t.version, as: 'dropped', reason: v.text });
            return call(`/tasks/${t.id}/reopen`, 'POST', { version: t.version, reason: v.text });
          }, { status: 'Status set to Not started', blocked: 'Marked blocked', remove: 'Task dropped', reopen: 'Task reopened' }[p.kind],
            { before: t, fields: { status: statusFields(t, 'todo'), blocked: ['blocked'], remove: statusFields(t, 'dropped'), reopen: ['category'] }[p.kind] as UndoField[] })} />}
      </Fragment>
    );
  };

  const table = (rows: Task[], empty: React.ReactNode) => (
    <div className="card table-card">
      <table className="stacked board sticky-head">
        <thead><tr><th aria-label="Done" /><th>Task</th><th>Owner</th><th>Due date</th><th>Status</th><th aria-label="Actions" /></tr></thead>
        <tbody>{rows.length ? rows.map(row) : <tr><td colSpan={6} className="empty-cell">{empty}</td></tr>}</tbody>
      </table>
    </div>
  );

  return (
    <>
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

      <div className="board-head">
        <h2>Tasks{ws !== 'All' && <span className="count-badge">{ws === '__none' ? 'No sub-project' : ws}</span>}</h2>
        <span className="board-tools">
          {isLead && <a className="btn ghost" href={`/reminders?project=${projectId}`}>Reminders</a>}
          {!readOnly && <button className="btn ghost" aria-expanded={importOpen} onClick={() => setImportOpen(!importOpen)}>{importOpen ? 'Close import' : 'Import minutes'}</button>}
          {!readOnly && <button className="btn" aria-expanded={addOpen} onClick={() => setAddOpen(!addOpen)}>{addOpen ? 'Close' : '+ Add task'}</button>}
        </span>
      </div>

      {importOpen && <ImportPanel what="tasks" busy={busy} today={today} onRead={async (b) => { if (await planOp({ op: 'importMinutes', ...b })) setImportOpen(false); }} />}
      {addOpen && <AddTask projectId={projectId} people={people} meId={meId} today={today} workstreams={wsList} defaultWs={ws !== 'All' && ws !== '__none' ? ws : ''} onDone={() => setAddOpen(false)} />}
      {(error || note) && <p className={error ? 'err banner' : 'ok banner'} role={error ? 'alert' : 'status'}>{error ?? note}</p>}
      {!readOnly && proposals.length > 0 && <Inbox mode="tasks" projectId={projectId} proposals={proposals} people={people.map((p) => ({ id: p.id, name: p.name }))} workstreams={wsList} busy={busy} today={today} op={planOp} />}

      <div className="pills">
        <AddedSince value={added} today={today} onChange={(d) => setAdded(d ?? '')} />
        <button className="pill" aria-pressed={!who} onClick={() => setWho(null)}>Everyone ({open.length})</button>
        {involved.map((p) => (
          <button key={p.id} className="pill" aria-pressed={who === p.id} onClick={() => setWho(who === p.id ? null : p.id)}>
            {p.name.split(' ')[0]} ({open.filter((t) => t.ownerId === p.id).length})
          </button>
        ))}
        {filtered && <button className="act" onClick={clearAll}>Clear filters</button>}
      </div>
      {added && <p className="small dim since-count" role="status">{visible.length} {visible.length === 1 ? 'task' : 'tasks'} {added === today ? 'added today' : `added since ${sinceWords(added, today)}`}</p>}

      <div className={wsList.length ? 'ws-layout' : ''}>
        {wsList.length > 0 && (
          <aside className="card ws-side" aria-label="Sub-projects">
            <div className="ws-label">Sub-projects</div>
            {['All', ...wsList].map((k) => (
              <button key={k} className="ws-item" aria-pressed={ws === k} onClick={() => setWs(k)}>
                <span>{k === 'All' ? 'All sub-projects' : k}</span><span className="n">{open.filter((t) => inWs(t, k)).length}</span>
              </button>
            ))}
            {open.some((t) => !t.workstream) && (<><hr /><button className="ws-item none" aria-pressed={ws === '__none'} onClick={() => setWs('__none')}>
              <span>No sub-project</span><span className="n">{open.filter((t) => !t.workstream).length}</span></button></>)}
          </aside>
        )}
        <div style={{ minWidth: 0 }}>
          {tile === 'done' ? (
            // The Done tile shows the finished tasks in place of the open list, open and ready to read (the PM's call, 30 Oct).
            <>
              <div className="list-head">
                <span className="small-toggle">Completed tasks <span className="count-badge">{closedRows.length}</span></span>
                {closedRows.length > 1 && <SortPick value={closedSort} onChange={setClosedSort} />}
              </div>
              {table(closedRows, <div className="empty-block"><DitherArt field="bands" className="dither-empty" fade /><p>No completed tasks match these filters.</p><button className="btn ghost" onClick={clearAll}>Clear filters</button></div>)}
            </>
          ) : (<>
            {table(openRows, filtered
              ? <div className="empty-block"><DitherArt field="bands" className="dither-empty" fade /><p>No open tasks match these filters.</p><button className="btn ghost" onClick={clearAll}>Clear filters</button></div>
              : <div className="empty-block"><DitherArt field="bands" className="dither-empty" fade /><p>No tasks in this project yet.</p>{!readOnly && <button className="btn" onClick={() => setAddOpen(true)}>Add a task</button>}</div>)}
            {closedRows.length > 0 && (
              <>
                <div className="list-head" style={{ marginTop: 22 }}>
                  <button className="log-toggle small-toggle" aria-expanded={doneOpen} onClick={() => setDoneOpen(!doneOpen)}>
                    <FoldChev /> Completed tasks <span className="count-badge">{closedRows.length}</span>
                  </button>
                  {doneOpen && closedRows.length > 1 && <SortPick value={closedSort} onChange={setClosedSort} />}
                </div>
                <Fold open={doneOpen}>{table(closedRows, '')}</Fold>
              </>
            )}
          </>)}
        </div>
      </div>

      <button className="log-toggle" aria-expanded={logOpen} onClick={() => setLogOpen(!logOpen)}>
        <FoldChev /> Update log <span className="count-badge">{log.length}</span>
      </button>
      <Fold open={logOpen}>
        <div className="card card-pad">
          {log.length === 0 ? <p className="empty">No updates logged yet.</p> : (
            <ol className="log">
              {log.map((e) => (
                <li key={e.id}>
                  <span className="when">{e.at} · {e.taskId ? <Link href={`/tasks/${e.taskId}`}>{e.task}</Link> : <span>{e.task}</span>}</span>
                  <span><PersonLink id={e.whoId}><b>{e.who}</b></PersonLink> {e.text}{e.reason && <div className="why">Reason: {e.reason}</div>}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </Fold>

      {openId && (
        <TaskDrawer key={`${openId}-${startStatus ?? ''}`} startStatus={startStatus} id={openId} meId={meId} isLead={isLead} people={people.map((p) => ({ id: p.id, name: p.name }))} workstreams={wsList}
          projectNames={projectNames} today={today} onClose={() => setOpenId(null)} />
      )}
    </>
  );
}

function PromptRow({ p, people, today, busy, onCancel, onGo }: {
  p: NonNullable<Prompt>; people: P[]; today: string; busy: boolean; onCancel: () => void; onGo: (v: { text: string; date: string; person: string }) => void;
}) {
  const [text, setText] = useState('');
  const [date, setDate] = useState('');
  const [person, setPerson] = useState('');
  const label = {
    status: 'Back to “Not started”. Why did work stop?',
    blocked: 'Why is it blocked? If it is waiting on someone in the team, you can name them and they see it in the app.',
    remove: 'Why drop this task? A reason is needed, and it stays in the log.',
    reopen: 'Why reopen it? Only a lead can reopen.',
  }[p.kind];
  const ok = text.trim().length > 0;
  return (
    <tr className="prompt-row">
      <td colSpan={6}>
        <div className="prompt">
          <div className="small">{label}</div>
          <div className="row">
            <label className="f"><span>{p.kind === 'blocked' ? 'Block reason' : 'Reason'}</span>
              <input ref={focusOnDesktop} maxLength={280} value={text} onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (isRealEnter(e) && ok) onGo({ text, date, person }); if (e.key === 'Escape') onCancel(); }} />
            </label>
            {p.kind === 'blocked' && (
              <label className="f" style={{ flex: '0 1 220px' }}><span>Waiting on (optional)</span>
                <Select value={person} onChange={setPerson}>
                  <option value="">No one, or someone outside</option>
                  {people.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </Select>
              </label>
            )}
            <span className="row" style={{ flex: 'none' }}>
              <button className="btn" disabled={!ok || busy} onClick={() => onGo({ text, date, person })}>
                {p.kind === 'remove' ? 'Drop' : p.kind === 'reopen' ? 'Reopen' : p.kind === 'blocked' ? 'Mark blocked' : 'Set not started'}
              </button>
              <button className="btn ghost" onClick={onCancel}>Cancel</button>
            </span>
          </div>
        </div>
      </td>
    </tr>
  );
}

function EditRow({ t, people, workstreams, today, busy, canReassign, onCancel, onSave }: {
  t: Task; people: P[]; workstreams: string[]; today: string; busy: boolean; canReassign: boolean; onCancel: () => void;
  onSave: (body: Record<string, unknown>, due: { newDueOn: string; reason: string } | null) => void;
}) {
  const [f, setF] = useState({ title: t.title, description: t.description ?? '', note: t.note ?? '', ownerId: t.ownerId, ownerRole: undefined as string | undefined, dueOn: t.dueOn, reason: '', workstream: t.workstream ?? '' });
  const moved = f.dueOn !== t.dueOn;
  const body: Record<string, unknown> = {};
  if (f.title !== t.title) body.title = f.title;
  if (f.description !== (t.description ?? '')) body.description = f.description || null;
  if (f.note !== (t.note ?? '')) body.note = f.note || null;
  if (f.ownerId !== t.ownerId) Object.assign(body, ownerFields(f.ownerId, f.ownerRole));
  if (f.workstream !== (t.workstream ?? '')) body.workstream = f.workstream || null;
  const ok = f.title.trim().length >= 3 && ownerReady(f.ownerId, f.ownerRole) && (!moved || f.reason.trim().length > 0) && (moved || Object.keys(body).length > 0);
  return (
    <tr className="editing-row">
      <td colSpan={6}>
        <div className="edit-grid">
          <label className="f wide"><span>Task</span><input value={f.title} maxLength={200} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
          <label className="f wide"><span>What it’s about</span><textarea rows={2} value={f.description} maxLength={600} placeholder="A line or two: what this involves and what done looks like" onChange={(e) => setF({ ...f, description: e.target.value })} /><Count value={f.description} max={600} /></label>
          <label className="f"><span>Owner</span>
            <OwnerPicker projectId={t.projectId} value={f.ownerId} people={people} disabled={!canReassign} onChange={(ownerId, ownerRole) => setF({ ...f, ownerId, ownerRole })} />
          </label>
          {workstreams.length > 0 && (
            <label className="f"><span>Sub-project</span>
              <Select value={f.workstream} onChange={(v) => setF({ ...f, workstream: v })}>
                <option value="">None</option>{workstreams.map((w) => <option key={w}>{w}</option>)}
              </Select>
            </label>
          )}
          <label className="f"><span>Due date</span><DateField min={today} value={f.dueOn} onChange={(e) => setF({ ...f, dueOn: e.target.value || t.dueOn })} /></label>
          <label className="f"><span>Note (one line)</span><input value={f.note} maxLength={140} placeholder="Blocker, dependency, who's been chased" onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
          {moved && (
            <label className="f wide"><span>Why the date moved (kept on record; the first date, {fmtDate(t.firstDueOn)}, stays)</span>
              <input value={f.reason} maxLength={280} onChange={(e) => setF({ ...f, reason: e.target.value })} />
            </label>
          )}
          <span className="row wide">
            <button className="btn" disabled={!ok || busy} onClick={() => onSave(body, moved ? { newDueOn: f.dueOn, reason: f.reason } : null)}>Save</button>
            <button className="btn ghost" onClick={onCancel}>Cancel</button>
          </span>
        </div>
      </td>
    </tr>
  );
}

function AddTask({ projectId, people, meId, today, workstreams, defaultWs, onDone }: {
  projectId: string; people: P[]; meId: string; today: string; workstreams: string[]; defaultWs: string; onDone: () => void;
}) {
  const router = useRouter();
  const inProject = (useProjectPeople()[projectId] ?? []).includes(meId);
  const blank = { title: '', description: '', ownerId: inProject ? meId : '', ownerRole: undefined as string | undefined, dueOn: '', note: '', workstream: defaultWs };
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Quick add (components/QuickAdd.tsx) fills the date and owner here; the project is this one.
  const titleRef = useRef<HTMLInputElement | null>(null);
  const members = useProjectPeople()[projectId] ?? [];
  function applyQuick(p: QuickParse, details?: string): string[] {
    const notes: string[] = [];
    const next = { ...f, title: p.title || f.title, description: f.description || details || '' };
    if (p.dueOn && p.dueOn >= today) next.dueOn = p.dueOn;
    if (p.owner?.status === 'matched') {
      const o = p.owner.item;
      if (members.includes(o.id)) { next.ownerId = o.id; next.ownerRole = undefined; }
      else notes.push(`${o.name} is not on this project, so pick the owner below.`);
    }
    setF(next);
    return notes;
  }
  const [many, setMany] = useState<SentenceRead[] | null>(null); // several tasks from one Quick Add, all in this project
  if (many) return <div className="card add-form"><TaskDrafts drafts={many} people={people} projectId={projectId} today={today} onBack={() => setMany(null)} onDone={() => { setMany(null); onDone(); }} /></div>;
  return (
    <form className="card add-form" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setError(null);
      try {
        const made = await call('/tasks', 'POST', { title: f.title, description: f.description || null, ...ownerFields(f.ownerId, f.ownerRole), dueOn: f.dueOn, projectId, note: f.note || null, workstream: f.workstream || null });
        if (made?.id) arrivals.add(made.id);
        notify('Task added');
        setF(blank); router.refresh(); onDone();
      } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
    }}>
      <QuickAddField today={today} people={people} hasTitle={!!f.title.trim()} apply={applyQuick} focusAfter={() => focusOnDesktop(titleRef.current)} onMany={setMany} />
      <div className="form-split"><span>Fill It In Yourself</span></div>
      <label className="f"><span>Task</span><input ref={titleRef} required minLength={3} maxLength={200} value={f.title} placeholder="e.g. Approve hamper samples" onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
      <label className="f"><span>Details (if any)</span><textarea rows={2} maxLength={600} value={f.description} placeholder="Anything the owner should know" onChange={(e) => setF({ ...f, description: e.target.value })} /><Count value={f.description} max={600} /></label>
      <div className="row">
        <label className="f"><span>Owner</span>
          <OwnerPicker projectId={projectId} value={f.ownerId} people={people} onChange={(ownerId, ownerRole) => setF({ ...f, ownerId, ownerRole })} />
        </label>
        {workstreams.length > 0 && (
          <label className="f"><span>Sub-Project</span>
            <Select value={f.workstream} onChange={(v) => setF({ ...f, workstream: v })}>
              <option value="">None</option>{workstreams.map((w) => <option key={w}>{w}</option>)}
            </Select>
          </label>
        )}
        <label className="f"><span>Due Date</span><DateField required min={today} value={f.dueOn} onChange={(e) => setF({ ...f, dueOn: e.target.value })} /></label>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        {error && <p className="err" role="alert" style={{ marginRight: 'auto' }}>{error}</p>}
        <button type="button" className="btn ghost" onClick={onDone}>Cancel</button>
        <button className="btn" disabled={busy || !ownerReady(f.ownerId, f.ownerRole)}>Add task</button>
      </div>
    </form>
  );
}
