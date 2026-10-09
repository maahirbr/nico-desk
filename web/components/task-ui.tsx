'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { Task } from '@/lib/derive';
import type { LogLine } from '@/lib/service';
import { fmtDate, fmtStamp } from '@/lib/time';
import { Avatar } from './chips';
import { logLine } from './logText';

// Shared pieces for the calm task views: one status word per task, a one-line row, a side
// panel with everything else, and a plain pop-up. Every change still goes through /api/v1.

export type Opt = { id: string; name: string };

// ---------- status: one word per task, picked by a person ----------
// Five statuses are facts a person sets. Ahead, at risk and late are flags the app works out
// from the dates (flagOf), never picked. Older ahead and off-track health reads as in progress.

export type StatusKey = 'todo' | 'doing' | 'blocked' | 'done' | 'dropped';
export const PICK: StatusKey[] = ['todo', 'doing', 'blocked', 'done', 'dropped'];
export const STATUS: Record<StatusKey, { word: string; c: string }> = {
  todo: { word: 'Not started', c: 'var(--black)' },
  doing: { word: 'In progress', c: 'var(--amber)' },
  blocked: { word: 'Blocked', c: 'var(--red)' },
  done: { word: 'Done', c: 'var(--purple)' },
  dropped: { word: 'Dropped', c: 'var(--muted)' },
};

export function statusKey(t: Task): StatusKey {
  if (t.statusCategory === 'done') return 'done';
  if (t.statusCategory === 'dropped') return 'dropped';
  if (t.blocked) return 'blocked';
  if (!t.health || t.health === 'not_started') return 'todo';
  return 'doing';
}

// Days of warning before an unstarted or blocked task counts as at risk.
export const RISK_DAYS = 2;
const daysTo = (d: string, today: string) => Math.round((Date.parse(`${d}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);

export type Flag = { key: 'late' | 'at_risk' | 'ahead' | 'on_time'; word: string; c: string; why: string };
export function flagOf(t: Task, today: string): Flag | null {
  if (t.statusCategory === 'done') {
    if (t.outcome === 'ahead') return { key: 'ahead', word: 'Ahead', c: 'var(--green)', why: `Done before the first date, ${fmtDate(t.firstDueOn)}.` };
    if (t.outcome === 'late') return { key: 'late', word: 'Late', c: 'var(--red)', why: `Done after the first date, ${fmtDate(t.firstDueOn)}.` };
    if (t.outcome === 'on_time') return { key: 'on_time', word: 'On time', c: 'var(--green)', why: `Done by the first date, ${fmtDate(t.firstDueOn)}.` };
    return null;
  }
  if (t.statusCategory !== 'open') return null;
  const n = daysTo(t.dueOn, today);
  if (n < 0) return { key: 'late', word: 'Late', c: 'var(--red)', why: 'The date has passed and it is not done.' };
  const k = statusKey(t);
  if (n <= RISK_DAYS && (k === 'todo' || k === 'blocked')) {
    return { key: 'at_risk', word: 'At risk', c: 'var(--amber)', why: `Due ${n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`} and ${k === 'blocked' ? 'still blocked' : 'not started'}.` };
  }
  return null;
}

export function FlagChip({ t, today }: { t: Task; today: string }) {
  const f = flagOf(t, today);
  if (!f) return null;
  return <span className={`flag flag-${f.key}`} style={{ '--c': f.c } as React.CSSProperties} title={f.why}>{f.word}</span>;
}

export function StatusLabel({ t, today }: { t: Task; today?: string }) {
  const s = STATUS[statusKey(t)];
  return (
    <span className="st-wrap">
      <span className="st" style={{ '--c': s.c } as React.CSSProperties}>{s.word}</span>
      {today && <FlagChip t={t} today={today} />}
    </span>
  );
}

// Which statuses need words first: blocked (who and the ask), dropped (why), and going back
// to not started once work began (why). The rest is one click.
export function formFor(t: Task, s: StatusKey): 'blocked' | 'drop' | 'status' | null {
  if (s === 'blocked') return 'blocked';
  if (s === 'dropped') return 'drop';
  if (s === 'todo' && t.health && t.health !== 'not_started') return 'status';
  return null;
}

// The one-click moves: done, in progress, or not started when nothing was begun. Clears a block first.
export async function quickMove(t: Task, s: StatusKey, reason?: string): Promise<unknown> {
  let v = t.version;
  if (t.blocked) v = (await api(`/tasks/${t.id}/unblock`, 'POST', { version: v })).version;
  if (s === 'done') return api(`/tasks/${t.id}/close`, 'POST', { version: v, as: 'done' });
  if (s === 'doing' && (!t.health || t.health === 'not_started')) return api(`/tasks/${t.id}/health`, 'POST', { version: v, health: 'on_track' });
  if (s === 'todo' && t.health !== 'not_started') return api(`/tasks/${t.id}/health`, 'POST', { version: v, health: 'not_started', reason });
  return null;
}

// "Today", "Tomorrow", "3 days late", or the date.
export function dueText(t: Task, today: string): { text: string; late: boolean } {
  if (t.statusCategory !== 'open') return { text: fmtDate(t.dueOn), late: false };
  const n = Math.round((Date.parse(`${t.dueOn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
  if (n < 0) return { text: `${-n} day${n === -1 ? '' : 's'} late`, late: true };
  if (n === 0) return { text: 'Today', late: false };
  if (n === 1) return { text: 'Tomorrow', late: false };
  return { text: fmtDate(t.dueOn), late: false };
}

// ---------- api ----------

export async function api(path: string, method: string, body?: unknown) {
  const res = await fetch(`/api/v1${path}`, {
    method, headers: body === undefined ? undefined : { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error?.message ?? `Request failed (${res.status}).`);
  return data;
}

// ---------- row ----------

// onStatus, when given, turns the status word into a picker. One-click moves happen in place;
// blocked, dropped and going back to not started open the side panel, which asks for the words.
export function TaskRow({ t, today, sub, owner, canTick, onOpen, onStatus }: {
  t: Task; today: string; sub?: string; owner?: string; canTick: boolean; onOpen: () => void; onStatus?: (s: StatusKey) => void;
}) {
  const desc = t.description;
  const router = useRouter();
  const [ticked, setTicked] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const due = dueText(t, today);
  const closed = t.statusCategory !== 'open';
  return (
    <div className={`trow${closed || ticked ? ' is-closed' : ''}`}>
      <span className="trow-check">
        {!closed && canTick && (
          <input type="checkbox" aria-label={`Mark “${t.title}” done`} checked={ticked} disabled={ticked}
            onChange={async () => {
              setTicked(true); setErr(null);
              try { await api(`/tasks/${t.id}/close`, 'POST', { version: t.version, as: 'done' }); router.refresh(); }
              catch (e) { setTicked(false); setErr((e as Error).message); }
            }} />
        )}
      </span>
      <button className="trow-main" onClick={onOpen}>
        <span className="trow-title">{t.title}</span>
        {desc && <span className="trow-desc">{desc}</span>}
        {(sub || err) && <span className={`trow-sub${err ? ' err' : ''}`}>{err ?? sub}</span>}
      </button>
      {owner !== undefined && <span className="trow-owner"><Avatar name={owner} />{owner.split(' ')[0]}</span>}
      <span className={`trow-due${due.late ? ' late' : ''}`} title={t.dateMoves ? `First given ${fmtDate(t.firstDueOn)}, moved ${t.dateMoves}×` : undefined}>
        {due.text}{t.dateMoves > 0 && !closed && <span className="moved" aria-label={`moved ${t.dateMoves} times`}> ↻{t.dateMoves}</span>}
      </span>
      <span className="trow-status">
        {onStatus && !closed && canTick ? (
          <select className="st-pick" value={statusKey(t)} aria-label={`Status of “${t.title}”`} disabled={ticked}
            style={{ '--c': STATUS[statusKey(t)].c } as React.CSSProperties}
            onChange={async (e) => {
              const s = e.target.value as StatusKey;
              if (formFor(t, s)) return onStatus(s);
              if (s === 'done') setTicked(true);
              setErr(null);
              try { await quickMove(t, s); router.refresh(); }
              catch (er) { setTicked(false); setErr((er as Error).message); }
            }}>
            {PICK.map((s) => <option key={s} value={s}>{STATUS[s].word}</option>)}
          </select>
        ) : <span className="st" style={{ '--c': STATUS[statusKey(t)].c } as React.CSSProperties}>{STATUS[statusKey(t)].word}</span>}
        <FlagChip t={t} today={today} />
      </span>
    </div>
  );
}

// ---------- pop-up and side panel ----------

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head"><h2>{title}</h2><button className="x" aria-label="Close" onClick={onClose}>×</button></div>
        {children}
      </div>
    </div>
  );
}

type Mode = null | 'blocked' | 'date' | 'drop' | 'reopen' | 'status';

export function TaskDrawer({ id, meId, isLead, people, workstreams = [], projectNames = {}, today, onClose, startStatus }: {
  id: string; meId: string; isLead: boolean; people: Opt[]; workstreams?: string[]; projectNames?: Record<string, string>;
  today: string; onClose: () => void; startStatus?: StatusKey;
}) {
  const router = useRouter();
  const [t, setT] = useState<Task | null>(null);
  const [log, setLog] = useState<LogLine[]>([]);
  const [mode, setMode] = useState<Mode>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({ date: '', text: '', person: '' });
  const [edit, setEdit] = useState({ title: '', description: '', note: '', ownerId: '', workstream: '' });
  const [showLog, setShowLog] = useState(false);
  const [target, setTarget] = useState<StatusKey>('todo');

  async function load() {
    const [task, lines] = await Promise.all([api(`/tasks/${id}`, 'GET'), api(`/tasks/${id}/log?limit=100`, 'GET')]);
    setT(task); setLog(lines);
    setEdit({ title: task.title, description: task.description ?? '', note: task.note ?? '', ownerId: task.ownerId, workstream: task.workstream ?? '' });
  }
  useEffect(() => { load().catch((e) => setErr(e.message)); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  async function run(fn: (v: number) => Promise<unknown>) {
    if (!t) return;
    setBusy(true); setErr(null);
    try { await fn(t.version); setMode(null); setForm({ date: '', text: '', person: '' }); await load(); router.refresh(); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  const names = Object.fromEntries(people.map((p) => [p.id, p.name]));
  const can = !!t && !t.readOnly && (t.ownerId === meId || isLead);
  const canEdit = !!t && !t.readOnly && (can || t.createdBy === meId);
  const open = t?.statusCategory === 'open';
  const key = t ? statusKey(t) : 'todo';

  function setStatus(s: StatusKey) {
    if (!t || s === key) return;
    const f = formFor(t, s);
    if (f) { setTarget(s); setMode(f); return; }
    run(() => quickMove(t, s));
  }

  // Opened from a row's status picker: go straight to the question for that status.
  const [started, setStarted] = useState(false);
  useEffect(() => {
    if (!t || started || !startStatus) return;
    setStarted(true);
    if (startStatus === key) return;
    const f = formFor(t, startStatus);
    if (f) { setTarget(startStatus); setMode(f); }
  }, [t]); // eslint-disable-line react-hooks/exhaustive-deps

  const body: Record<string, unknown> = {};
  if (t) {
    if (edit.title.trim() !== t.title) body.title = edit.title.trim();
    if (edit.description !== (t.description ?? '')) body.description = edit.description || null;
    if (edit.note !== (t.note ?? '')) body.note = edit.note || null;
    if (edit.ownerId !== t.ownerId) body.ownerId = edit.ownerId;
    if (edit.workstream !== (t.workstream ?? '')) body.workstream = edit.workstream || null;
  }
  const dirty = Object.keys(body).length > 0;
  const okText = form.text.trim().length >= 10;

  return (
    <div className="overlay drawer-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Task">
        <div className="drawer-top">
          <span className="small dim">{t ? [t.projectId ? projectNames[t.projectId] : 'No project', t.workstream].filter(Boolean).join(' · ') : ''}</span>
          <button className="x" aria-label="Close" onClick={onClose}>×</button>
        </div>
        {!t ? <p className="empty">{err ?? 'Loading…'}</p> : (
          <>
            {canEdit && open
              ? <textarea className="drawer-title" rows={2} value={edit.title} maxLength={200} onChange={(e) => setEdit({ ...edit, title: e.target.value })} aria-label="Task" />
              : <h2 className="drawer-title static">{t.title}</h2>}
            {canEdit && open
              ? <textarea className="drawer-desc" rows={2} maxLength={600} value={edit.description} placeholder="What this task is about. A line or two."
                  onChange={(e) => setEdit({ ...edit, description: e.target.value })} aria-label="Description" />
              : t.description && <p className="drawer-desc static">{t.description}</p>}

            {open ? (
              <div className="status-picker" role="group" aria-label="Status">
                {PICK.map((s) => (
                  <button key={s} aria-pressed={key === s} disabled={!can || busy} style={{ '--c': STATUS[s].c } as React.CSSProperties} onClick={() => setStatus(s)}>
                    {STATUS[s].word}
                  </button>
                ))}
                <FlagChip t={t} today={today} />
              </div>
            ) : (
              <div className="row" style={{ alignItems: 'center' }}>
                <StatusLabel t={t} />
                {t.outcome && <span className="small dim">{t.outcome === 'late' ? 'Closed late' : t.outcome === 'ahead' ? 'Closed ahead' : 'Closed on time'}, judged against {fmtDate(t.firstDueOn)}</span>}
              </div>
            )}

            {mode && (
              <div className="drawer-form">
                <div className="small"><b>{{ status: `Back to “${STATUS[target].word}”. Why did work stop?`, blocked: 'Why is it blocked? A block reason is needed.', date: 'Move the date. The first date stays on record. Moving it before the date passes counts as moved in time.', drop: 'Drop this task. A reason is needed, and it stays on record.', reopen: 'Reopen this task. Only a lead can.' }[mode]}</b></div>
                {mode === 'date' && <label className="f"><span>New date</span><input type="date" min={today} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>}
                <label className="f"><span>{mode === 'blocked' ? 'Block reason' : 'Reason'}</span>
                  <textarea rows={2} maxLength={280} value={form.text} placeholder="At least 10 characters" onChange={(e) => setForm({ ...form, text: e.target.value })} />
                </label>
                {mode === 'blocked' && (
                  <label className="f"><span>Waiting on someone in the team? (optional)</span>
                    <select value={form.person} onChange={(e) => setForm({ ...form, person: e.target.value })}>
                      <option value="">No one, or someone outside</option>
                      {people.filter((p) => p.id !== t.ownerId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </label>
                )}
                <div className="row">
                  <button className="btn" disabled={busy || !okText || (mode === 'date' && !form.date)}
                    onClick={() => run(async (v) => {
                      if (mode === 'status') return quickMove(t, 'todo', form.text);
                      if (mode === 'blocked') return api(`/tasks/${t.id}/block`, 'POST', { version: v, onId: form.person || null, ask: form.text });
                      if (mode === 'date') return api(`/tasks/${t.id}/renegotiate`, 'POST', { version: v, newDueOn: form.date, reason: form.text });
                      if (mode === 'drop') return api(`/tasks/${t.id}/close`, 'POST', { version: v, as: 'dropped', reason: form.text });
                      return api(`/tasks/${t.id}/reopen`, 'POST', { version: v, reason: form.text });
                    })}>Save</button>
                  <button className="btn ghost" onClick={() => setMode(null)}>Cancel</button>
                </div>
              </div>
            )}
            {err && <p className="err banner" role="alert">{err}</p>}

            {t.blocked && (
              <div className="ask">
                <span className="caps">{t.blocked.onId ? `Waiting on ${names[t.blocked.onId] ?? 'someone'}` : 'Blocked'}</span>
                <div>{t.blocked.ask}</div>
              </div>
            )}

            <dl className="drawer-facts">
              <dt>Owner</dt>
              <dd>{can && open ? (
                <select value={edit.ownerId} onChange={(e) => setEdit({ ...edit, ownerId: e.target.value })}>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
              ) : <span className="person-cell"><Avatar name={names[t.ownerId] ?? t.ownerId} />{names[t.ownerId] ?? t.ownerId}</span>}</dd>

              <dt>Due</dt>
              <dd>
                <span className={dueText(t, today).late ? 'late-text' : ''}>{fmtDate(t.dueOn)}</span>
                {can && open && mode !== 'date' && <button className="act" style={{ marginLeft: 10 }} onClick={() => setMode('date')}>Change date</button>}
                {t.renegotiations.length > 0 && (
                  <div className="small dim">First given {fmtDate(t.firstDueOn)}{t.renegotiations.map((r) => ` → ${fmtDate(r.to)}`).join('')}</div>
                )}
              </dd>

              {(workstreams.length > 0 || t.workstream) && (<>
                <dt>Sub-project</dt>
                <dd>{canEdit && open ? (
                  <select value={edit.workstream} onChange={(e) => setEdit({ ...edit, workstream: e.target.value })}>
                    <option value="">None</option>{[...new Set([...workstreams, ...(t.workstream ? [t.workstream] : [])])].map((w) => <option key={w}>{w}</option>)}
                  </select>
                ) : t.workstream}</dd>
              </>)}

              <dt>Note</dt>
              <dd>{canEdit && open
                ? <input value={edit.note} maxLength={140} placeholder="One line: blocker, dependency, who's been chased" onChange={(e) => setEdit({ ...edit, note: e.target.value })} />
                : t.note || <span className="dim">None</span>}</dd>
            </dl>

            {dirty && (
              <div className="row">
                <button className="btn" disabled={busy || edit.title.trim().length < 3} onClick={() => run((v) => api(`/tasks/${t.id}`, 'PATCH', { version: v, ...body }))}>Save changes</button>
                <button className="btn ghost" onClick={() => setEdit({ title: t.title, description: t.description ?? '', note: t.note ?? '', ownerId: t.ownerId, workstream: t.workstream ?? '' })}>Discard</button>
              </div>
            )}

            <div className="drawer-foot">
              {open && can && <button className="act danger" onClick={() => setMode('drop')}>Drop task…</button>}
              {!open && isLead && <button className="act" onClick={() => setMode('reopen')}>Reopen…</button>}
              <Link className="act" href={`/tasks/${t.id}`}>Open full page</Link>
            </div>

            <button className="log-toggle small-toggle" aria-expanded={showLog} onClick={() => setShowLog(!showLog)}>
              <span aria-hidden>{showLog ? '▾' : '▸'}</span> History <span className="count-badge">{log.length}</span>
            </button>
            {showLog && (
              <ol className="log">
                {log.map((e) => (
                  <li key={e.id}>
                    <span className="when">{fmtStamp(e.at)}</span>
                    <span><b>{e.actorName ?? 'System'}</b> {logLine(e, names, projectNames)}{e.reason && <div className="why">Reason: {e.reason}</div>}</span>
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </aside>
    </div>
  );
}

// ---------- add a task ----------

export function AddTaskForm({ people, meId, today, projectId, projects, workstreams: fixedWs = [], wsByProject, defaultWs = '', onDone }: {
  people: Opt[]; meId: string; today: string; projectId?: string; projects?: Opt[]; workstreams?: string[];
  wsByProject?: Record<string, string[]>; defaultWs?: string; onDone: () => void;
}) {
  const router = useRouter();
  const [f, setF] = useState({ title: '', description: '', ownerId: meId, dueOn: '', note: '', workstream: defaultWs, projectId: projectId ?? '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const workstreams = wsByProject ? wsByProject[f.projectId] ?? [] : fixedWs;
  return (
    <form className="stack" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setErr(null);
      try {
        await api('/tasks', 'POST', { title: f.title, description: f.description || null, ownerId: f.ownerId, dueOn: f.dueOn, projectId: f.projectId || null, note: f.note || null, workstream: f.workstream || null });
        router.refresh(); onDone();
      } catch (er) { setErr((er as Error).message); } finally { setBusy(false); }
    }}>
      <label className="f"><span>Task</span><input autoFocus required minLength={3} maxLength={200} value={f.title} placeholder="Short name, e.g. Approve hamper samples" onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
      <label className="f"><span>What it’s about (optional)</span><textarea rows={2} maxLength={600} value={f.description} placeholder="A line or two: what this involves and what done looks like" onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
      <div className="row">
        <label className="f"><span>Owner</span>
          <select value={f.ownerId} onChange={(e) => setF({ ...f, ownerId: e.target.value })}>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        </label>
        <label className="f"><span>Due</span><input type="date" required min={today} value={f.dueOn} onChange={(e) => setF({ ...f, dueOn: e.target.value })} /></label>
      </div>
      {(projects || workstreams.length > 0) && (
        <div className="row">
          {projects && (
            <label className="f"><span>Project</span>
              <select value={f.projectId} onChange={(e) => setF({ ...f, projectId: e.target.value, workstream: '' })}>
                <option value="">None</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
          )}
          {workstreams.length > 0 && (
            <label className="f"><span>Sub-project</span>
              <select value={f.workstream} onChange={(e) => setF({ ...f, workstream: e.target.value })}>
                <option value="">None</option>{workstreams.map((w) => <option key={w}>{w}</option>)}
              </select>
            </label>
          )}
        </div>
      )}
      <label className="f"><span>Note (optional)</span><input maxLength={140} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
      <p className="hint" style={{ margin: 0 }}>The due date is kept as the first date. Moving it later needs a reason.</p>
      {err && <p className="err" role="alert">{err}</p>}
      <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn" disabled={busy}>Add task</button></div>
    </form>
  );
}
