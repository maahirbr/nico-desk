'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { Task } from '@/lib/derive';
import type { PasteProposal, PasteRead, StatusWord } from '@/lib/paste';
import { statusFields, type UndoField } from '@/lib/undo';
import { fmtDate } from '@/lib/time';
import { DateField } from './DateField';
import { Help } from './HelpMode';
import { arrivals } from './motion';
import { Select } from './Select';
import { playFor } from './sound';
import { notify } from './toast';
import { useUndo } from './undo';

// Paste to tasks: a chat goes in, proposals come out, and nothing changes until a person approves each one.
// The pasted text lives in this component and in one request. It is never stored, and it is dropped when this closes.

type Opt = { id: string; name: string };
type Edit = { title: string; ownerId: string; dueOn: string; projectId: string; status: StatusWord | ''; reason: string; text: string };
type Row = { state: 'open' | 'done' | 'skipped'; editing: boolean; edit: Edit; err: string | null };

const KEY: Record<StatusWord, 'todo' | 'doing' | 'blocked' | 'done' | 'dropped'> = { 'Not started': 'todo', 'In progress': 'doing', Blocked: 'blocked', Done: 'done', Dropped: 'dropped' };
const WORDS = Object.keys(KEY) as StatusWord[];
const NEEDS_REASON = new Set<StatusWord>(['Blocked', 'Dropped', 'Not started']);

async function call(path: string, body: unknown) {
  const res = await fetch(`/api/v1${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  playFor('POST', path, body, res.ok);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error?.message ?? `Request failed (${res.status}).`);
  return data;
}

const edit0 = (p: PasteProposal): Edit => ({
  title: p.kind === 'new' ? p.title : '', ownerId: p.kind === 'new' ? p.ownerId ?? '' : '', dueOn: p.kind === 'new' ? p.dueOn ?? '' : p.kind === 'update' ? p.dueOn ?? '' : '',
  projectId: p.kind === 'new' ? p.projectId ?? '' : '', status: p.kind === 'update' ? p.status ?? '' : '', reason: p.kind === 'update' ? p.reason : '', text: p.kind === 'note' ? p.text : '',
});

export function PasteChat({ people, projects, today, onBack, onDone, startText = '' }: { people: Opt[]; projects?: Opt[]; today: string; onBack: () => void; onDone: () => void; startText?: string }) {
  const router = useRouter();
  const undo = useUndo();
  const file = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(startText);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [read, setRead] = useState<PasteRead | null>(null);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [versions, setVersions] = useState<Record<string, number>>({}); // the newest version of a task this review has written
  const who = (id: string | null) => people.find((x) => x.id === id)?.name ?? null;

  // A chat pasted into Quick Add arrives here as startText and is read straight away.
  const started = useRef(false);
  useEffect(() => { if (startText && !started.current) { started.current = true; void go(); } }); // eslint-disable-line react-hooks/exhaustive-deps

  async function go() {
    setBusy(true); setErr(null);
    try {
      const r: PasteRead = await call('/paste/read', { text });
      setRead(r);
      setRows(Object.fromEntries(r.proposals.map((p) => [p.id, { state: 'open', editing: false, edit: edit0(p), err: null } as Row])));
      setText(''); // the raw chat is dropped as soon as it is read
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  async function pickFile(f: File | undefined) {
    if (!f) return;
    if (f.size > 1_000_000) { setErr('That file is too large. Paste the last part of the chat instead.'); return; }
    setErr(null); setText(await f.text());
    if (file.current) file.current.value = '';
  }

  const patch = (id: string, r: Partial<Row>) => setRows((all) => ({ ...all, [id]: { ...all[id], ...r } }));
  const setEdit = (id: string, e: Partial<Edit>) => setRows((all) => ({ ...all, [id]: { ...all[id], edit: { ...all[id].edit, ...e } } }));

  // What would be sent for this proposal, with any edits. Null while something it needs is missing.
  function body(p: PasteProposal, e: Edit): Record<string, unknown> | null {
    if (p.kind === 'new') return e.title.trim().length >= 3 && e.ownerId && e.dueOn ? { kind: 'new', title: e.title.trim(), ownerId: e.ownerId, dueOn: e.dueOn, projectId: e.projectId || null } : null;
    if (p.kind === 'note') return e.text.trim() ? { kind: 'note', taskId: p.taskId, text: e.text.trim() } : null;
    const base = { kind: 'update', taskId: p.taskId, version: versions[p.taskId] ?? p.version };
    if (p.status) return e.status && (!NEEDS_REASON.has(e.status) || e.reason.trim()) ? { ...base, status: e.status, ...(e.reason.trim() ? { reason: e.reason.trim() } : {}) } : null;
    return e.dueOn && e.reason.trim() ? { ...base, dueOn: e.dueOn, reason: e.reason.trim() } : null;
  }

  async function approve(p: PasteProposal) {
    const row = rows[p.id];
    const b = body(p, row.edit);
    if (!b) return patch(p.id, { editing: true, err: 'Fill in what is missing, then approve.' });
    patch(p.id, { err: null });
    setBusy(true);
    try {
      const r: { before: Task | null; task: Task } = await call('/paste/apply', b);
      setVersions((v) => ({ ...v, [r.task.id]: r.task.version }));
      if (p.kind === 'new') { arrivals.add(r.task.id); notify('Task added'); }
      else if (p.kind === 'note') notify('Note added');
      else if (r.before) {
        const fields: UndoField[] = b.status ? statusFields(r.before, KEY[b.status as StatusWord]) : ['due'];
        undo.announce(b.status ? `Status set to ${b.status}` : 'Due date moved', r.before, fields);
      }
      patch(p.id, { state: 'done', editing: false });
      router.refresh();
    } catch (e) { patch(p.id, { err: (e as Error).message, editing: true }); } finally { setBusy(false); }
  }

  if (!read) {
    return (
      <div className="stack">
        <p className="hint" style={{ margin: 0 }}>Paste a WhatsApp or other team chat. The app proposes tasks and updates. Nothing changes until you approve each one.</p>
        <textarea rows={9} value={text} aria-label="The chat" maxLength={120000} onChange={(e) => setText(e.target.value)}
          placeholder={'[13/10/26, 9:41:02 AM] Kabir Sethi: The banner copy is blocked until the studio replies\n[13/10/26, 9:42:10 AM] Meera Iyer: Move the shoot plan to Friday'} />
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <label className="mini-btn" style={{ cursor: 'pointer' }}>
            Choose a .txt file
            <input ref={file} type="file" accept=".txt,text/plain" hidden onChange={(e) => pickFile(e.target.files?.[0])} />
          </label>
          <span className="small dim">{text ? `${text.length.toLocaleString()} characters` : ''}</span>
        </div>
        <p className="hint" style={{ margin: 0 }}><Help term="paste_masked">Names and numbers are masked before the text leaves the server. The pasted text is dropped after you review it and is not stored.</Help></p>
        {err && <p className="err" role="alert">{err}</p>}
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <button type="button" className="btn ghost" onClick={onBack}>Back</button>
          <button type="button" className="btn" disabled={busy || !text.trim()} onClick={go}>{busy ? 'Reading…' : 'Read the chat'}</button>
        </div>
      </div>
    );
  }

  const open = read.proposals.filter((p) => rows[p.id]?.state === 'open');
  return (
    <div className="stack">
      <div className="inbox-head">
        <h3 style={{ margin: 0 }}><Help term="paste_review">Proposals from the chat</Help></h3>
        <span className="count-badge">{open.length} to review</span>
      </div>
      <p className="hint" style={{ margin: 0 }}>
        Read {read.messages} message{read.messages === 1 ? '' : 's'}{read.cut ? `, the last ${read.messages} of ${read.messages + read.cut}` : ''}. The pasted text is dropped and not stored.
      </p>
      {read.proposals.length === 0 && <p className="small dim">The chat held no tasks or updates that match your work.</p>}
      {read.proposals.map((p) => {
        const row = rows[p.id];
        if (!row) return null;
        const e = row.edit;
        if (row.state !== 'open') return <p key={p.id} className="small dim pc-gone">{row.state === 'done' ? 'Approved' : 'Skipped'}: {p.reading}</p>;
        return (
          <div key={p.id} className="pc paste-pc">
            <div className="pc-top">
              <span className="pc-badge">{p.kind === 'new' ? 'New task' : p.kind === 'note' ? 'Note' : 'Update'}</span>
              {p.kind !== 'new' && <span className="pc-why">{p.taskTitle}</span>}
            </div>
            <div className="pc-task">{p.reading}</div>
            <div className="small">{change(p, e, who, today)}</div>
            <blockquote className="pc-quote small dim">{p.quote.sender ? `${p.quote.sender}${p.quote.when ? `, ${p.quote.when}` : ''}: ` : ''}{p.quote.text.length > 220 ? `${p.quote.text.slice(0, 220)}…` : p.quote.text}</blockquote>
            {row.editing && (
              <div className="stack" style={{ gap: 8 }}>
                {p.kind === 'new' && (
                  <>
                    <input value={e.title} maxLength={200} aria-label="Task" onChange={(x) => setEdit(p.id, { title: x.target.value })} />
                    <div className="row">
                      <Select value={e.ownerId} aria-label="Owner" onChange={(v) => setEdit(p.id, { ownerId: v })}>
                        <option value="">Owner: pick from the roster</option>{people.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                      </Select>
                      <DateField value={e.dueOn} min={today} aria-label="Due date" onChange={(x) => setEdit(p.id, { dueOn: x.target.value })} />
                    </div>
                    {projects && (
                      <Select value={e.projectId} aria-label="Project" onChange={(v) => setEdit(p.id, { projectId: v })}>
                        <option value="">No project</option>{projects.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                      </Select>
                    )}
                  </>
                )}
                {p.kind === 'note' && <textarea rows={2} maxLength={280} value={e.text} aria-label="Note" onChange={(x) => setEdit(p.id, { text: x.target.value })} />}
                {p.kind === 'update' && (
                  <>
                    {p.status
                      ? <Select value={e.status} aria-label="Status" onChange={(v) => setEdit(p.id, { status: v as StatusWord })}>{WORDS.map((w) => <option key={w}>{w}</option>)}</Select>
                      : <DateField value={e.dueOn} min={today} aria-label="New due date" onChange={(x) => setEdit(p.id, { dueOn: x.target.value })} />}
                    <input value={e.reason} maxLength={280} aria-label="Reason" placeholder={p.status && !NEEDS_REASON.has(e.status as StatusWord) ? 'Reason (optional)' : 'Reason (needed)'} onChange={(x) => setEdit(p.id, { reason: x.target.value })} />
                  </>
                )}
              </div>
            )}
            {!p.mayApply && p.whyNot && <p className="small dim">{p.whyNot}</p>}
            {row.err && <p className="err" role="alert">{row.err}</p>}
            <div className="row pc-actions">
              <button type="button" className="btn small-btn" disabled={busy || !p.mayApply} onClick={() => approve(p)}>Approve</button>
              <button type="button" className="mini-btn" disabled={busy} onClick={() => patch(p.id, { editing: !row.editing })}>{row.editing ? 'Done editing' : 'Edit'}</button>
              <button type="button" className="mini-btn danger" disabled={busy} onClick={() => patch(p.id, { state: 'skipped' })}>Skip</button>
            </div>
          </div>
        );
      })}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn ghost" disabled={busy} onClick={() => { setRead(null); setRows({}); }}>Paste another chat</button>
        <button type="button" className="btn" onClick={onDone}>Close</button>
      </div>
    </div>
  );
}

// The change in words, with any edits the person made.
function change(p: PasteProposal, e: Edit, who: (id: string | null) => string | null, today: string): string {
  void today;
  if (p.kind === 'new') {
    const bits = [e.title || p.title, who(e.ownerId || null) ?? 'no owner yet', e.dueOn ? `due ${fmtDate(e.dueOn)}` : 'no date yet'];
    return `Add task: ${bits.join(' · ')}`;
  }
  if (p.kind === 'note') return `Add note: ${e.text}`;
  if (p.status) return `Status: ${p.current.status} to ${e.status || p.status}${e.reason ? ` (${e.reason})` : ''}`;
  return `Due date: ${fmtDate(p.current.dueOn)} to ${e.dueOn ? fmtDate(e.dueOn) : 'pick a date'}${e.reason ? ` (${e.reason})` : ''}`;
}
