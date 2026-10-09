'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Fragment, useState } from 'react';
import type { Task } from '@/lib/derive';
import type { Proposal } from '@/lib/planUtil';
import { fmtDate } from '@/lib/time';
import { Person } from './chips';
import { ImportPanel, Inbox } from './Minutes';
import { arrivals, focusOnDesktop } from './motion';
import { MotionRow, MovedDate, StateSelect } from './rowmotion';
import { FlagChip, flagOf, formFor, PICK, quickMove, STATUS, statusKey, TaskDrawer, type StatusKey } from './task-ui';
import { notify } from './toast';

// A project's tasks as one board: number cards that filter, people and sub-project filters, and a
// table where each task shows what it is about, its owner, date and status. Status changes in the
// row; edits open in the row; the side panel has the full detail. Every change goes through /api/v1.

type P = { id: string; name: string; role: string; department: string };
type LogItem = { id: string; at: string; who: string; text: string; task: string; taskId: string; reason: string | null };

async function call(path: string, method: string, body?: unknown) {
  const res = await fetch(`/api/v1${path}`, {
    method, headers: body === undefined ? undefined : { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error?.message ?? `Request failed (${res.status}).`);
  return data;
}

type Prompt =
  | { kind: 'status'; t: Task }
  | { kind: 'blocked'; t: Task }
  | { kind: 'remove'; t: Task }
  | { kind: 'reopen'; t: Task }
  | null;

export function TaskBoard({ projectId, tasks, people, names, projectNames = {}, meId, isLead, today, log, workstreams = [], proposals = [] }: {
  projectId: string; tasks: Task[]; people: P[]; names: Record<string, string>; projectNames?: Record<string, string>;
  meId: string; isLead: boolean; today: string; log: LogItem[]; workstreams?: string[]; proposals?: Proposal[];
}) {
  const router = useRouter();
  const [tile, setTile] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<Prompt>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [who, setWho] = useState<string | null>(null);
  const [ws, setWs] = useState<string>('All');
  const [importOpen, setImportOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

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

  const may = (t: Task) => !t.readOnly && (t.ownerId === meId || isLead);
  const open = tasks.filter((t) => t.statusCategory === 'open');
  const tiles = [
    { key: 'open', label: 'Open', n: open.length, match: (t: Task) => t.statusCategory === 'open' },
    { key: 'doing', label: 'In progress', n: open.filter((t) => statusKey(t) === 'doing').length, match: (t: Task) => t.statusCategory === 'open' && statusKey(t) === 'doing' },
    { key: 'at_risk', label: 'At risk', n: open.filter((t) => flagOf(t, today)?.key === 'at_risk').length, match: (t: Task) => flagOf(t, today)?.key === 'at_risk', warn: true },
    { key: 'overdue', label: 'Late', n: tasks.filter((t) => t.overdue).length, match: (t: Task) => t.overdue, warn: true },
    { key: 'done', label: 'Done', n: tasks.filter((t) => t.statusCategory === 'done').length, match: (t: Task) => t.statusCategory === 'done' },
  ];
  const inWs = (t: Task, k: string) => k === 'All' || (k === '__none' ? !t.workstream : t.workstream === k);
  const visible = tasks.filter((t) => (!who || t.ownerId === who) && inWs(t, ws) && (!tile || tiles.find((x) => x.key === tile)!.match(t)));
  const wsList = [...new Set([...workstreams, ...tasks.map((t) => t.workstream).filter((x): x is string => !!x)])];
  const byDue = (a: Task, b: Task) => a.dueOn.localeCompare(b.dueOn);
  const openRows = visible.filter((t) => t.statusCategory === 'open').sort(byDue);
  const closedRows = visible.filter((t) => t.statusCategory !== 'open').sort((a, b) => b.dueOn.localeCompare(a.dueOn));
  const involved = people.filter((p) => tasks.some((t) => t.ownerId === p.id));
  const filtered = !!(tile || who || ws !== 'All');

  async function run(fn: () => Promise<unknown>, done?: string) {
    setBusy(true); setError(null);
    try { await fn(); if (done) notify(done); setPrompt(null); setEditing(null); router.refresh(); }
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
    await run(() => quickMove(t, s), `Status set to ${STATUS[s].word}`);
  }

  const row = (t: Task) => {
    if (editing === t.id) return <EditRow key={t.id} t={t} people={people} workstreams={wsList} today={today} busy={busy} canReassign={t.ownerId === meId || isLead}
      onCancel={() => setEditing(null)} onSave={(body, due) => run(async () => {
        let v = t.version;
        if (due) v = (await call(`/tasks/${t.id}/renegotiate`, 'POST', { version: v, ...due })).version;
        if (Object.keys(body).length) await call(`/tasks/${t.id}`, 'PATCH', { version: v, ...body });
      }, due ? `Date moved to ${fmtDate(due.newDueOn)}` : 'Changes saved')} />;
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
            <button className="task-link" onClick={() => setOpenId(t.id)}>{t.title}</button>
            {ws === 'All' && t.workstream && <span className="ws-tag">{t.workstream}</span>}
            {t.description && <div className="desc">{t.description}</div>}
            {t.note && <div className="sub note-line">{t.note}</div>}
            {t.blocked && <div className="sub blocked-line">{t.blocked.onId ? `Waiting on ${names[t.blocked.onId]}: ` : 'Blocked: '}{t.blocked.ask}</div>}
          </td>
          <td data-label="Owner"><Person name={names[t.ownerId] ?? t.ownerId} /></td>
          <td className={`due${t.overdue ? ' late' : ''}`} data-label="Due">
            <MovedDate value={t.dueOn} text={fmtDate(t.dueOn)} fmt={fmtDate} />
            {t.dateMoves > 0 && t.statusCategory === 'open' && (
              <div>
                <span className="pushed">pushed {t.dateMoves}×</span>
                {t.renegotiations.map((r) => <span key={r.at} className="trail" title={r.reason ?? undefined}>{fmtDate(r.from)}</span>)}
              </div>
            )}
          </td>
          <td>
            <StateSelect className={`status-sel tone-${st.tone}`} aria-label={`Status of “${t.title}”`} value={s} disabled={!can || busy || t.statusCategory === 'dropped'}
              onChange={(e) => changeStatus(t, e.target.value as StatusKey)}>
              {PICK.map((k) => <option key={k} value={k}>{STATUS[k].word}</option>)}
            </StateSelect>
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
          }, { status: 'Status set to Not started', blocked: 'Marked blocked', remove: 'Task dropped', reopen: 'Task reopened' }[p.kind])} />}
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
          <button key={x.key} className={`card stat${x.warn && x.n ? ' warn' : ''}`} aria-pressed={tile === x.key}
            title={tile === x.key ? 'Clear this filter' : 'Show only these'} onClick={() => setTile(tile === x.key ? null : x.key)}>
            <div className="stat-n">{x.n}</div><div className="stat-l">{x.label}</div>
          </button>
        ))}
      </div>

      <div className="board-head">
        <h2>Tasks{ws !== 'All' && <span className="count-badge">{ws === '__none' ? 'No sub-project' : ws}</span>}</h2>
        <span className="board-tools">
          {isLead && <a className="btn ghost" href={`/reminders?project=${projectId}`}>Reminders</a>}
          <button className="btn ghost" aria-expanded={importOpen} onClick={() => setImportOpen(!importOpen)}>{importOpen ? 'Close import' : 'Import minutes'}</button>
          <button className="btn" aria-expanded={addOpen} onClick={() => setAddOpen(!addOpen)}>{addOpen ? 'Close' : '+ Add task'}</button>
        </span>
      </div>

      {importOpen && <ImportPanel what="tasks" busy={busy} today={today} onRead={async (b) => { if (await planOp({ op: 'importMinutes', ...b })) setImportOpen(false); }} />}
      {addOpen && <AddTask projectId={projectId} people={people} meId={meId} today={today} workstreams={wsList} defaultWs={ws !== 'All' && ws !== '__none' ? ws : ''} onDone={() => setAddOpen(false)} />}
      {(error || note) && <p className={error ? 'err banner' : 'ok banner'} role={error ? 'alert' : 'status'}>{error ?? note}</p>}
      {proposals.length > 0 && <Inbox mode="tasks" proposals={proposals} people={people.map((p) => ({ id: p.id, name: p.name }))} workstreams={wsList} busy={busy} today={today} op={planOp} />}

      <div className="pills">
        <button className="pill" aria-pressed={!who} onClick={() => setWho(null)}>Everyone ({open.length})</button>
        {involved.map((p) => (
          <button key={p.id} className="pill" aria-pressed={who === p.id} onClick={() => setWho(who === p.id ? null : p.id)}>
            {p.name.split(' ')[0]} ({open.filter((t) => t.ownerId === p.id).length})
          </button>
        ))}
        {filtered && <button className="act" onClick={() => { setTile(null); setWho(null); setWs('All'); }}>Clear filters</button>}
      </div>

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
          {table(openRows, filtered
            ? <div className="empty-block"><p>No open tasks match these filters.</p><button className="btn ghost" onClick={() => { setTile(null); setWho(null); setWs('All'); }}>Clear filters</button></div>
            : <div className="empty-block"><p>No tasks in this project yet.</p><button className="btn" onClick={() => setAddOpen(true)}>Add a task</button></div>)}
          {closedRows.length > 0 && tile !== 'done' && (
            <>
              <button className="log-toggle small-toggle" style={{ marginTop: 22 }} aria-expanded={doneOpen} onClick={() => setDoneOpen(!doneOpen)}>
                <span aria-hidden>{doneOpen ? '▾' : '▸'}</span> Completed tasks <span className="count-badge">{closedRows.length}</span>
              </button>
              {doneOpen && table(closedRows, '')}
            </>
          )}
        </div>
      </div>

      <button className="log-toggle" aria-expanded={logOpen} onClick={() => setLogOpen(!logOpen)}>
        <span aria-hidden>{logOpen ? '▾' : '▸'}</span> Update log <span className="count-badge">{log.length}</span>
      </button>
      {logOpen && (
        <div className="card card-pad">
          {log.length === 0 ? <p className="empty">No updates logged yet.</p> : (
            <ol className="log">
              {log.map((e) => (
                <li key={e.id}>
                  <span className="when">{e.at} · <Link href={`/tasks/${e.taskId}`}>{e.task}</Link></span>
                  <span><b>{e.who}</b> {e.text}{e.reason && <div className="why">Reason: {e.reason}</div>}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {openId && (
        <TaskDrawer id={openId} meId={meId} isLead={isLead} people={people.map((p) => ({ id: p.id, name: p.name }))} workstreams={wsList}
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
  const ok = text.trim().length >= 10;
  return (
    <tr className="prompt-row">
      <td colSpan={6}>
        <div className="prompt">
          <div className="small">{label}</div>
          <div className="row">
            <label className="f"><span>{p.kind === 'blocked' ? 'Block reason' : 'Reason'} (10 to 280 characters)</span>
              <input ref={focusOnDesktop} maxLength={280} value={text} onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && ok) onGo({ text, date, person }); if (e.key === 'Escape') onCancel(); }} />
            </label>
            {p.kind === 'blocked' && (
              <label className="f" style={{ flex: '0 1 220px' }}><span>Waiting on (optional)</span>
                <select value={person} onChange={(e) => setPerson(e.target.value)}>
                  <option value="">No one, or someone outside</option>
                  {people.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
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
  const [f, setF] = useState({ title: t.title, description: t.description ?? '', note: t.note ?? '', ownerId: t.ownerId, dueOn: t.dueOn, reason: '', workstream: t.workstream ?? '' });
  const moved = f.dueOn !== t.dueOn;
  const body: Record<string, unknown> = {};
  if (f.title !== t.title) body.title = f.title;
  if (f.description !== (t.description ?? '')) body.description = f.description || null;
  if (f.note !== (t.note ?? '')) body.note = f.note || null;
  if (f.ownerId !== t.ownerId) body.ownerId = f.ownerId;
  if (f.workstream !== (t.workstream ?? '')) body.workstream = f.workstream || null;
  const ok = f.title.trim().length >= 3 && (!moved || f.reason.trim().length >= 10) && (moved || Object.keys(body).length > 0);
  return (
    <tr className="editing-row">
      <td colSpan={6}>
        <div className="edit-grid">
          <label className="f wide"><span>Task</span><input value={f.title} maxLength={200} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
          <label className="f wide"><span>What it’s about</span><textarea rows={2} value={f.description} maxLength={600} placeholder="A line or two: what this involves and what done looks like" onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
          <label className="f"><span>Owner</span>
            <select value={f.ownerId} disabled={!canReassign} onChange={(e) => setF({ ...f, ownerId: e.target.value })}>
              {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          {workstreams.length > 0 && (
            <label className="f"><span>Sub-project</span>
              <select value={f.workstream} onChange={(e) => setF({ ...f, workstream: e.target.value })}>
                <option value="">None</option>{workstreams.map((w) => <option key={w}>{w}</option>)}
              </select>
            </label>
          )}
          <label className="f"><span>Due date</span><input type="date" min={today} value={f.dueOn} onChange={(e) => setF({ ...f, dueOn: e.target.value || t.dueOn })} /></label>
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
  const blank = { title: '', description: '', ownerId: meId, dueOn: '', note: '', workstream: defaultWs };
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form className="card add-form" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setError(null);
      try {
        const made = await call('/tasks', 'POST', { title: f.title, description: f.description || null, ownerId: f.ownerId, dueOn: f.dueOn, projectId, note: f.note || null, workstream: f.workstream || null });
        if (made?.id) arrivals.add(made.id);
        notify('Task added');
        setF(blank); router.refresh(); onDone();
      } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
    }}>
      <label className="f"><span>Task</span><input ref={focusOnDesktop} required minLength={3} maxLength={200} value={f.title} placeholder="Short name, e.g. Approve hamper samples" onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
      <label className="f"><span>What it’s about (optional)</span><textarea rows={2} maxLength={600} value={f.description} placeholder="A line or two: what this involves and what done looks like" onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
      <div className="row">
        <label className="f"><span>Owner</span>
          <select value={f.ownerId} onChange={(e) => setF({ ...f, ownerId: e.target.value })}>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        </label>
        {workstreams.length > 0 && (
          <label className="f"><span>Sub-project</span>
            <select value={f.workstream} onChange={(e) => setF({ ...f, workstream: e.target.value })}>
              <option value="">None</option>{workstreams.map((w) => <option key={w}>{w}</option>)}
            </select>
          </label>
        )}
        <label className="f"><span>Due date (kept as the first date)</span><input type="date" required min={today} value={f.dueOn} onChange={(e) => setF({ ...f, dueOn: e.target.value })} /></label>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        {error && <p className="err" role="alert" style={{ marginRight: 'auto' }}>{error}</p>}
        <button type="button" className="btn ghost" onClick={onDone}>Cancel</button>
        <button className="btn" disabled={busy}>Add task</button>
      </div>
    </form>
  );
}
