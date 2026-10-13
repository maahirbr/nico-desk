'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import type { Task } from '@/lib/derive';
import { daysTo, flagKeyOf, RISK_DAYS, statusOf, type FlagKey } from '@/lib/flags';
import type { LogLine } from '@/lib/service';
import { fmtDate, fmtStamp } from '@/lib/time';
import { Avatar, PersonLink, type Tone } from './chips';
import { CommentThread } from './CommentThread';
import { LinkChip, TaskLinkChips } from './TaskLinks';
import { StatusNudge } from './StatusNudge';
import { LINKS_PER_TASK } from '@/lib/links';
import { groupLog } from './logText';
import { canMoveTo } from './statusRules';
import { arrivals, drawerMotion, focusOnDesktop, modalMotion, useClosing, usePreviousWhileChanging } from './motion';
import { DateField } from './DateField';
import { Popover } from './popover';
import { Select } from './Select';
import { OwnerPicker, ownerFields, ownerReady, useProjectPeople } from './OwnerPicker';
import { notify } from './toast';
import { playFor } from './sound';
import { useReadOnly } from './readonly';
import { Help, useHelpOn } from './HelpMode';
import { useJev } from './jevFlag';
import { editFields, statusFields, type UndoField } from '@/lib/undo';
import type { QuickParse } from '@/lib/quickadd';
import { QuickAddField } from './QuickAdd';
import { TASK_CHANGED, useUndo } from './undo';
import { TaskLink } from './TaskLink';
import { FreshDot, useViewer } from './viewer';
import { PasteChat } from './PasteChat';
import { TaskDrafts } from './TaskDrafts';
import type { SentenceRead } from '@/lib/sentence';
import { Count } from './LimitNotice';

// Shared pieces for the calm task views: one status word per task, a one-line row, a side
// panel with everything else, and a plain pop-up. Every change still goes through /api/v1.

export type Opt = { id: string; name: string };

// ---------- status: one word per task, picked by a person ----------
// Five statuses are facts a person sets. Ahead, at risk and late are flags the app works out
// from the dates (flagOf), never picked. Older ahead and off-track health reads as in progress.

export type StatusKey = 'todo' | 'doing' | 'blocked' | 'done' | 'dropped';
export const PICK: StatusKey[] = ['todo', 'doing', 'blocked', 'done', 'dropped'];
export const STATUS: Record<StatusKey, { word: string; tone: Tone }> = {
  todo: { word: 'Not started', tone: 'idle' },
  doing: { word: 'In progress', tone: 'active' },
  blocked: { word: 'Blocked', tone: 'blocked' },
  done: { word: 'Done', tone: 'done' },
  dropped: { word: 'Dropped', tone: 'quiet' },
};

// The glyph for one status inside the ring. The tick has pathLength 1 so it can draw itself (.st-tick).
function Glyph({ s }: { s: StatusKey }) {
  return (
    <>
      {s === 'doing' && <path d="M6 1.4a4.6 4.6 0 0 1 0 9.2z" fill="currentColor" stroke="none" />}
      {s === 'blocked' && <path d="M3.6 6h4.8" strokeWidth="1.8" />}
      {s === 'done' && <path className="st-tick" d="M3.9 6.2l1.5 1.5 2.8-3" pathLength={1} />}
      {s === 'dropped' && <path d="M4.4 4.4l3.2 3.2M7.6 4.4l-3.2 3.2" />}
    </>
  );
}

// Each status also has an icon, so it reads without colour: circle, half circle, bar, tick, cross.
// The ring stays. When the status changes, the icon morphs: the old glyph shrinks and fades out while the new one
// pops in (.st-morph, .st-glyph-out in globals.css), for --dur-glyph. Not on first render, and not under reduced motion.
export function StatusIcon({ s }: { s: StatusKey }) {
  const from = usePreviousWhileChanging(s, 140);
  return (
    <svg className={`st-icon${from !== undefined ? ' st-morph' : ''}`} viewBox="0 0 12 12" width="12" height="12" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="6" r="4.6" />
      {from !== undefined && <g key={`out-${from}`} className="st-glyph-out"><Glyph s={from} /></g>}
      <g key={s} className="st-glyph"><Glyph s={s} /></g>
    </svg>
  );
}

// The tick inside a checkbox. The box is drawn in CSS; this sits over it and draws itself when it is checked.
export function CheckTick() {
  return <svg className="check-tick" viewBox="0 0 12 12" aria-hidden><path d="M2.9 6.3l2.2 2.2 4-4.6" pathLength={1} /></svg>;
}

// What a row's status menu can ask the side panel to open: a status that needs words, a date move, or a new owner.
export type RowAction = StatusKey | 'date' | 'reassign';

export const statusKey: (t: Task) => StatusKey = statusOf; // lib/flags.ts, shared with the search filters

export { RISK_DAYS };

export type Flag = { key: FlagKey; word: string; tone: Tone; why: string };
export function flagOf(t: Task, today: string): Flag | null {
  const key = flagKeyOf(t, today); // lib/flags.ts, shared with the search filters
  if (!key) return null;
  if (key === 'ahead') return { key, word: 'Ahead', tone: 'ok', why: `Done before the first date, ${fmtDate(t.firstDueOn)}.` };
  if (key === 'on_time') return { key, word: 'On time', tone: 'ok', why: `Done by the first date, ${fmtDate(t.firstDueOn)}.` };
  if (key === 'late') return { key, word: 'Late', tone: 'late', why: t.statusCategory === 'done' ? `Done after the first date, ${fmtDate(t.firstDueOn)}.` : 'The date has passed and it is not done.' };
  const n = daysTo(t.dueOn, today);
  return { key, word: 'At risk', tone: 'risk', why: `Due ${n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`} and ${statusKey(t) === 'blocked' ? 'still blocked' : 'not started'}.` };
}

// hideLate: the row already says "3 days late" in red, so most skins do not say Late a second time.
// Skin W, the PM's build, does: the flag is rendered with flag-again and tokens.css shows it there only.
export function FlagChip({ t, today, hideLate = false }: { t: Task; today: string; hideLate?: boolean }) {
  const help = useHelpOn(); // in help mode the tooltip carries the reason, so the native title steps aside
  const f = flagOf(t, today);
  if (!f) return null;
  return <span className={`flag tone-${f.tone}${hideLate && f.key === 'late' ? ' flag-again' : ''}`} title={help ? undefined : f.why}><Help term={f.key} note={f.why}>{f.word}</Help></span>;
}

export function StatusLabel({ t, today }: { t: Task; today?: string }) {
  const s = STATUS[statusKey(t)];
  return (
    <span className="st-wrap">
      <span className={`st st-status tone-${s.tone}`}><Help term={`status_${statusKey(t)}`}>{s.word}</Help></span>
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

// The one-click moves: done, in progress, or not started when nothing was begun. Clears a block first;
// a blocked task going to in progress is one change (unblock with resume).
export async function quickMove(t: Task, s: StatusKey, reason?: string): Promise<unknown> {
  let v = t.version;
  if (t.blocked && s === 'doing') return api(`/tasks/${t.id}/unblock`, 'POST', { version: v, resume: true });
  if (t.blocked) v = (await api(`/tasks/${t.id}/unblock`, 'POST', { version: v })).version;
  if (s === 'done') return api(`/tasks/${t.id}/close`, 'POST', { version: v, as: 'done' });
  if (s === 'doing' && (!t.health || t.health === 'not_started')) return api(`/tasks/${t.id}/health`, 'POST', { version: v, health: 'on_track' });
  if (s === 'todo' && t.health !== 'not_started') return api(`/tasks/${t.id}/health`, 'POST', { version: v, health: 'not_started', reason });
  return null;
}

// Any status move, with the words it may need: the ask for blocked (and who it waits on), the reason for dropped,
// the reason for going back to not started. The drawer forms and the status nudge on the full update form both use it.
export async function moveWithWords(t: Task, s: StatusKey, text: string, onId: string | null = null): Promise<unknown> {
  if (s === 'blocked') return api(`/tasks/${t.id}/block`, 'POST', { version: t.version, onId, ask: text });
  if (s === 'dropped') return api(`/tasks/${t.id}/close`, 'POST', { version: t.version, as: 'dropped', reason: text });
  return quickMove(t, s, text);
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
  playFor(method, path, body, res.ok);
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error?.message ?? `Request failed (${res.status}).`);
  return data;
}

// ---------- row ----------

// onStatus, when given, turns the status word into a menu. One-click moves happen in place;
// blocked, dropped, going back to not started, a date move and a new owner open the side panel.
export function TaskRow({ t, today, sub, owner, canTick, canBlock = false, canReassign = false, onOpen, onStatus }: {
  t: Task; today: string; sub?: string; owner?: string; canTick: boolean; canBlock?: boolean; canReassign?: boolean; onOpen: () => void; onStatus?: (a: RowAction) => void;
}) {
  const desc = t.description;
  const router = useRouter();
  const undo = useUndo();
  // Viewing as someone else: look, do not change. No checkbox and no empty gutter where it was, so rows still line up.
  const readOnly = useReadOnly();
  if (readOnly) { canTick = false; onStatus = undefined; }
  const [ticked, setTicked] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const due = dueText(t, today);
  const closed = t.statusCategory !== 'open';
  const key = statusKey(t);
  // Motion: a line made in this tab rises in once; a moved date strikes the old one and slides the new
  // one in; a set state crossfades its pill.
  const [arrive] = useState(() => arrivals.delete(t.id));
  const oldDate = usePreviousWhileChanging(t.dueOn, 360);
  const stateFrom = usePreviousWhileChanging(key, 140);
  const main = (
    <TaskLink id={t.id} className="trow-main" onOpen={onOpen}>
      <span className="trow-title">{t.title}<FreshDot id={t.id} /></span>
      {desc && <span className="trow-desc">{desc}</span>}
      {(sub || err) && <span className={`trow-sub${err ? ' err' : ''}`}>{err ?? sub}</span>}
    </TaskLink>
  );
  return (
    <div className={`trow${closed || ticked ? ' is-closed' : ''}${arrive ? ' arrive' : ''}${readOnly ? ' no-check' : ''}`}>
      {!readOnly && <span className="trow-check">
        {!closed && canTick && (
          <input type="checkbox" aria-label={`Mark “${t.title}” done`} checked={ticked} disabled={ticked}
            onChange={async () => {
              setTicked(true); setErr(null);
              try { await api(`/tasks/${t.id}/close`, 'POST', { version: t.version, as: 'done' }); undo.announce('Marked done', t, statusFields(t, 'done')); router.refresh(); }
              catch (e) { setTicked(false); setErr((e as Error).message); }
            }} />
        )}
        {!closed && canTick && <CheckTick />}
      </span>}
      {t.links.length > 0 ? <div className="trow-body">{main}<TaskLinkChips links={t.links} onMore={onOpen} /></div> : main}
      {owner !== undefined && <PersonLink id={t.ownerId} className="trow-owner"><Avatar id={t.ownerId} name={owner} />{owner.split(' ')[0]}</PersonLink>}
      <span className={`trow-due${due.late ? ' late' : ''}`} title={t.dateMoves ? `First given ${fmtDate(t.firstDueOn)}, moved ${t.dateMoves}×` : undefined}>
        {oldDate !== undefined && <span className="date-old" aria-hidden>{fmtDate(oldDate)}</span>}
        <span className={oldDate !== undefined ? 'date-new' : undefined}>{due.text}</span>
        {t.dateMoves > 0 && !closed && <Help term="moved_date"><span className="moved" aria-label={`moved ${t.dateMoves} times`}><span className="mv-word" aria-hidden>moved {t.dateMoves}×</span><span className="mv-mark" aria-hidden>↻{t.dateMoves}</span></span></Help>}
      </span>
      <span className="trow-status">
        {onStatus && !closed && canTick ? (
          <StatusMenu t={t} current={key} disabled={ticked} set={stateFrom !== undefined}
            statuses={PICK.filter((s) => s !== 'blocked' || canBlock || key === 'blocked')} canReassign={canReassign}
            onPick={async (a) => {
              if (a === 'date' || a === 'reassign') return onStatus(a);
              if (a === key) return;
              if (formFor(t, a)) return onStatus(a);
              if (a === 'done') setTicked(true);
              setErr(null);
              try { await quickMove(t, a); undo.announce(t.blocked && a === 'doing' ? 'Unblocked, in progress' : `Status set to ${STATUS[a].word}`, t, statusFields(t, a)); router.refresh(); }
              catch (er) { setTicked(false); setErr((er as Error).message); }
            }} />
        ) : <span className={`st st-status tone-${STATUS[key].tone}${stateFrom !== undefined ? ' state-set' : ''}`}><StatusIcon s={key} /><Help term={`status_${key}`}>{STATUS[key].word}</Help></span>}
        <FlagChip t={t} today={today} hideLate={due.late} />
      </span>
    </div>
  );
}

// The row's status as a menu button: the statuses, each with its icon and colour, then Unblock when
// blocked, Move date… and, for leads and admins, Reassign…. Arrow keys move, Enter picks, Esc closes.
export function StatusMenu({ t, current, statuses, canReassign, disabled, set, onPick }: {
  t: Task; current: StatusKey; statuses: StatusKey[]; canReassign: boolean; disabled: boolean; set: boolean; onPick: (a: RowAction) => void;
}) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const pick = (a: RowAction) => { setOpen(false); btn.current?.focus(); onPick(a); };
  return (
    <span className="menu-wrap st-menu-wrap">
      <Help term={`status_${current}`} host><button ref={btn} type="button" className={`st-pick tone-${STATUS[current].tone}${set ? ' state-set' : ''}`} aria-haspopup="menu" aria-expanded={open}
        aria-label={`Status of “${t.title}”: ${STATUS[current].word}`} disabled={disabled}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => { if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); setOpen(true); } }}>
        <StatusIcon s={current} />{STATUS[current].word}
      </button></Help>
      <AnimatePresence>
        {open && (
          <Popover anchor={btn} onClose={() => setOpen(false)} align="end" role="menu" label="Status" className="menu st-menu">
            {statuses.map((s) => (
              <button key={s} type="button" role="menuitemradio" aria-checked={s === current} className={`st-opt tone-${STATUS[s].tone}`} onClick={() => pick(s)}>
                <StatusIcon s={s} /><span>{STATUS[s].word}</span>
              </button>
            ))}
            <span className="st-menu-sep" role="separator" />
            {t.blocked && <Help term="unblock" host><button type="button" role="menuitem" className="st-act" onClick={() => pick('doing')}>Unblock</button></Help>}
            <Help term="move_date" host><button type="button" role="menuitem" className="st-act" onClick={() => pick('date')}>Move date…</button></Help>
            {canReassign && <Help term="reassign" host><button type="button" role="menuitem" className="st-act" onClick={() => pick('reassign')}>Reassign…</button></Help>}
          </Popover>
        )}
      </AnimatePresence>
    </span>
  );
}

// ---------- pop-up and side panel ----------

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  const [closing, close] = useClosing(onClose);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [close]);
  return (
    <div className={`overlay${closing ? ' is-closing' : ''}`} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <motion.div className={`modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} {...modalMotion(closing)}>
        <div className="modal-head"><h2>{title}</h2><button className="x" aria-label="Close" onClick={close}>×</button></div>
        {children}
      </motion.div>
    </div>
  );
}

type Mode = null | 'blocked' | 'date' | 'drop' | 'reopen' | 'status' | 'reassign';

export function TaskDrawer({ id, meId, isLead, people, workstreams = [], projectNames = {}, today, onClose, startStatus }: {
  id: string; meId: string; isLead: boolean; people: Opt[]; workstreams?: string[]; projectNames?: Record<string, string>;
  today: string; onClose: () => void; startStatus?: RowAction;
}) {
  const router = useRouter();
  const [t, setT] = useState<Task | null>(null);
  const [log, setLog] = useState<LogLine[]>([]);
  const [mode, setMode] = useState<Mode>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({ date: '', text: '', person: '' });
  const [edit, setEdit] = useState({ title: '', description: '', note: '', ownerId: '', ownerRole: undefined as string | undefined, workstream: '' });
  const [pickKey, setPickKey] = useState(0); // starts the owner picker afresh on discard
  const [showLog, setShowLog] = useState(false);
  const [target, setTarget] = useState<StatusKey>('todo');
  const [unNote, setUnNote] = useState('');
  const [nudge, setNudge] = useState<{ status: StatusKey; word: string; note: string } | null>(null); // Jev's offer after a note
  const [linkForm, setLinkForm] = useState({ url: '', label: '' });
  const [closing, close] = useClosing(onClose);
  const undo = useUndo();
  const { markSeen } = useViewer();
  useEffect(() => { markSeen(id); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps -- opening a task is looking at it (a no-op while viewing as someone)

  async function load() {
    const [task, lines] = await Promise.all([api(`/tasks/${id}`, 'GET'), api(`/tasks/${id}/log?limit=100`, 'GET')]);
    setT(task); setLog(lines);
    setEdit({ title: task.title, description: task.description ?? '', note: task.note ?? '', ownerId: task.ownerId, ownerRole: undefined, workstream: task.workstream ?? '' });
    setPickKey((k) => k + 1);
  }
  useEffect(() => { load().catch((e) => setErr(e.message)); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { // an undo made from a toast changed this task: read it again
    const on = (e: Event) => { if ((e as CustomEvent).detail === id) load().catch(() => {}); };
    window.addEventListener(TASK_CHANGED, on);
    return () => window.removeEventListener(TASK_CHANGED, on);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [close]);

  // fields: what the change touched, so its toast can offer Undo (lib/undo.ts). None, no Undo.
  async function run(fn: (v: number) => Promise<unknown>, done?: string, fields?: UndoField[]): Promise<boolean> {
    if (!t) return false;
    setBusy(true); setErr(null);
    try { await fn(t.version); if (done) { if (fields) undo.announce(done, t, fields); else notify(done); } setMode(null); setForm({ date: '', text: '', person: '' }); setNudge(null); await load(); router.refresh(); return true; }
    catch (e) { setErr((e as Error).message); return false; }
    finally { setBusy(false); }
  }

  // After a note is saved, ask Jev what status the words imply. Any failure, or Jev off, shows nothing.
  async function saveChanges() {
    if (!t) return;
    const note = typeof body.note === 'string' ? body.note : '';
    const ok = await run((v) => api(`/tasks/${t.id}`, 'PATCH', { version: v, ...body }), 'Changes saved', editFields(body));
    if (!ok || !note || !can) return;
    await offerFromNote(note);
  }
  // The same offer, from a note or a comment. The server reads at most 280 characters. A comment is not a field change.
  async function offerFromNote(note: string) {
    if (!t) return;
    try {
      const r = await api(`/tasks/${t.id}/suggest-status`, 'POST', { text: note.slice(0, 280) });
      if (r?.suggestion) setNudge({ status: r.suggestion.status, word: r.suggestion.word, note: note.slice(0, 280) });
    } catch { /* no offer */ }
  }
  // The click. The status calls are the same as the buttons above. A status that needs words opens its form with the note filled in.
  function acceptNudge() {
    if (!nudge) return;
    const { status, note } = nudge;
    setNudge(null);
    setForm({ date: '', text: note, person: '' });
    setStatus(status);
  }

  const names = Object.fromEntries(people.map((p) => [p.id, p.name]));
  const entries = groupLog(log, names, projectNames);
  const readOnly = useReadOnly();
  const can = !readOnly && !!t && !t.readOnly && (t.ownerId === meId || isLead);
  const canEdit = !readOnly && !!t && !t.readOnly && (can || t.createdBy === meId);
  const open = t?.statusCategory === 'open';
  const key = t ? statusKey(t) : 'todo';

  function setStatus(s: StatusKey) {
    if (!t || s === key) return;
    const f = formFor(t, s);
    if (f) { setTarget(s); setMode(f); return; }
    run(() => quickMove(t, s), t.blocked && s === 'doing' ? 'Unblocked, in progress' : `Status set to ${STATUS[s].word}`, statusFields(t, s));
  }

  // Opened from a row's status picker: go straight to the question for that status.
  const [started, setStarted] = useState(false);
  useEffect(() => {
    if (!t || started || !startStatus) return;
    setStarted(true);
    if (startStatus === 'date' || startStatus === 'reassign') { if (can && open) setMode(startStatus); return; }
    if (startStatus === key) return;
    const f = formFor(t, startStatus);
    if (f) { setTarget(startStatus); setMode(f); }
  }, [t]); // eslint-disable-line react-hooks/exhaustive-deps

  async function addLink() {
    if (!t) return;
    setBusy(true); setErr(null);
    try {
      const made = await api(`/tasks/${t.id}/links`, 'POST', { url: linkForm.url.trim(), label: linkForm.label.trim() || null });
      undo.announceWith('Link added', t.id, () => api(`/tasks/${t.id}/links/${made.id}`, 'DELETE')); setLinkForm({ url: '', label: '' }); await load(); router.refresh();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  async function removeLink(linkId: string) {
    if (!t) return;
    setBusy(true); setErr(null);
    const gone = t.links.find((l) => l.id === linkId);
    try {
      await api(`/tasks/${t.id}/links/${linkId}`, 'DELETE');
      if (gone) undo.announceWith('Link removed', t.id, () => api(`/tasks/${t.id}/links`, 'POST', { url: gone.url, label: gone.label }));
      else notify('Link removed'); await load(); router.refresh();
    }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  const body: Record<string, unknown> = {};
  if (t) {
    if (edit.title.trim() !== t.title) body.title = edit.title.trim();
    if (edit.description !== (t.description ?? '')) body.description = edit.description || null;
    if (edit.note !== (t.note ?? '')) body.note = edit.note || null;
    if (edit.ownerId !== t.ownerId) Object.assign(body, ownerFields(edit.ownerId, edit.ownerRole));
    if (edit.workstream !== (t.workstream ?? '')) body.workstream = edit.workstream || null;
  }
  const dirty = Object.keys(body).length > 0;
  const okText = form.text.trim().length > 0;

  return (
    <div className={`overlay drawer-overlay${closing ? ' is-closing' : ''}`} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <motion.aside className="drawer" role="dialog" aria-modal="true" aria-label="Task" {...drawerMotion(closing)}>
        <div className="drawer-top">
          <span className="small dim">
            {t && (t.projectId ? <Link className="rlink" href={`/projects/${t.projectId}`}>{projectNames[t.projectId] ?? 'Project'}</Link> : 'No project')}
            {t?.workstream && <> · {t.workstream}</>}
          </span>
          {t && <button className="mini-btn drawer-copy" type="button" onClick={async () => {
            try { await navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?task=${t.id}`); notify('Link to this task copied'); }
            catch { notify('Could not copy. Copy the address from the bar.'); }
          }}>Copy link</button>}
          <button className="x" aria-label="Close" onClick={close}>×</button>
        </div>
        {!t ? <p className="empty">{err ?? 'Loading…'}</p> : (
          <>
            {canEdit && open
              ? <textarea className="drawer-title" rows={2} value={edit.title} maxLength={200} onChange={(e) => setEdit({ ...edit, title: e.target.value })} aria-label="Task" />
              : <h2 className="drawer-title static">{t.title}</h2>}
            {canEdit && open
              ? <><textarea className="drawer-desc" rows={2} maxLength={600} value={edit.description} placeholder="What this task is about. A line or two."
                  onChange={(e) => setEdit({ ...edit, description: e.target.value })} aria-label="Description" /><Count value={edit.description} max={600} /></>
              : t.description && <p className="drawer-desc static">{t.description}</p>}

            {open ? (
              <div className="status-picker" role="group" aria-label="Status">
                {PICK.filter((s) => s === key || canMoveTo(t, s, meId, isLead)).map((s) => (
                  <button key={s} className={`tone-${STATUS[s].tone}`} aria-pressed={key === s} disabled={!can || busy} onClick={() => setStatus(s)}>
                    <StatusIcon s={s} />{STATUS[s].word}
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

            {mode === 'reassign' && (
              <div className="drawer-form">
                <div className="small"><b>Give this task to someone else. The new owner sees it on their home page.</b></div>
                <label className="f"><span>New owner</span>
                  <OwnerPicker key={pickKey} projectId={t.projectId} value={edit.ownerId} people={people} onChange={(ownerId, ownerRole) => setEdit({ ...edit, ownerId, ownerRole })} />
                </label>
                <div className="row">
                  <button className="btn" disabled={busy || edit.ownerId === t.ownerId || !ownerReady(edit.ownerId, edit.ownerRole)}
                    onClick={() => run((v) => api(`/tasks/${t.id}`, 'PATCH', { version: v, ...body }), `Given to ${names[edit.ownerId] ?? 'the new owner'}`, ['owner'])}>Save</button>
                  <button className="btn ghost" onClick={() => { setEdit({ ...edit, ownerId: t.ownerId, ownerRole: undefined }); setPickKey((k) => k + 1); setMode(null); }}>Cancel</button>
                </div>
              </div>
            )}
            {mode && mode !== 'reassign' && (
              <div className="drawer-form">
                <div className="small"><b>{{ status: `Back to “${STATUS[target].word}”. Why did work stop?`, blocked: 'Why is it blocked? A block reason is needed.', date: 'Move the date. The first date stays on record. Moving it before the date passes counts as moved in time.', drop: 'Drop this task. A reason is needed, and it stays on record.', reopen: 'Reopen this task. Only a lead can.' }[mode]}</b></div>
                {mode === 'date' && <label className="f"><span>New date</span><DateField min={today} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>}
                <label className="f"><span>{mode === 'blocked' ? 'Block reason' : 'Reason'}</span>
                  <textarea rows={2} maxLength={280} value={form.text} placeholder={mode === 'blocked' ? 'What is it waiting for?' : 'A short reason'} onChange={(e) => setForm({ ...form, text: e.target.value })} />
                  <Count value={form.text} max={280} />
                </label>
                {mode === 'blocked' && (
                  <label className="f"><span>Waiting on someone in the team? (optional)</span>
                    <Select value={form.person} onChange={(v) => setForm({ ...form, person: v })}>
                      <option value="">No one, or someone outside</option>
                      {people.filter((p) => p.id !== t.ownerId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </Select>
                  </label>
                )}
                <div className="row">
                  <button className="btn" disabled={busy || !okText || (mode === 'date' && !form.date)}
                    onClick={() => run(async (v) => {
                      if (mode === 'status') return moveWithWords(t, 'todo', form.text);
                      if (mode === 'blocked') return moveWithWords(t, 'blocked', form.text, form.person || null);
                      if (mode === 'date') return api(`/tasks/${t.id}/renegotiate`, 'POST', { version: v, newDueOn: form.date, reason: form.text });
                      if (mode === 'drop') return moveWithWords(t, 'dropped', form.text);
                      return api(`/tasks/${t.id}/reopen`, 'POST', { version: v, reason: form.text });
                    }, { status: 'Status set to Not started', blocked: 'Marked blocked', date: `Date moved to ${fmtDate(form.date)}`, drop: 'Task dropped', reopen: 'Task reopened' }[mode],
                      { status: statusFields(t, 'todo'), blocked: ['blocked'], date: ['due'], drop: statusFields(t, 'dropped'), reopen: ['category'] }[mode] as UndoField[])}>Save</button>
                  <button className="btn ghost" onClick={() => setMode(null)}>Cancel</button>
                </div>
              </div>
            )}
            {err && <p className="err banner" role="alert">{err}</p>}
            {nudge && nudge.status !== key && can && canMoveTo(t, nudge.status, meId, isLead) && (
              <StatusNudge word={nudge.word} busy={busy} onAccept={acceptNudge} onDismiss={() => setNudge(null)} />
            )}

            {t.blocked && (
              <div className="ask">
                <span className="ask-label">{t.blocked.onId ? <><Help term="blocked_on">Waiting on</Help> <PersonLink id={t.blocked.onId}>{names[t.blocked.onId] ?? 'someone'}</PersonLink></> : <Help term="status_blocked">Blocked</Help>}</span>
                <div>{t.blocked.ask}</div>
                {can && open && (
                  <div className="ask-unblock">
                    <input value={unNote} maxLength={280} placeholder="What unblocked it? (optional)" aria-label="What unblocked it (optional)" onChange={(e) => setUnNote(e.target.value)} />
                    <button className="btn" disabled={busy}
                      onClick={() => run((v) => api(`/tasks/${t.id}/unblock`, 'POST', { version: v, resume: true, ...(unNote.trim() ? { note: unNote.trim() } : {}) }), 'Unblocked, in progress', ['blocked', 'health']).then(() => setUnNote(''))}>
                      Unblock
                    </button>
                  </div>
                )}
              </div>
            )}

            <dl className="drawer-facts">
              <dt>Owner</dt>
              <dd>{can && open && mode !== 'reassign' ? (
                <OwnerPicker key={pickKey} projectId={t.projectId} value={edit.ownerId} people={people} onChange={(ownerId, ownerRole) => setEdit({ ...edit, ownerId, ownerRole })} />
              ) : <PersonLink id={t.ownerId} className="person-cell"><Avatar id={t.ownerId} name={names[t.ownerId] ?? t.ownerId} />{names[t.ownerId] ?? t.ownerId}</PersonLink>}</dd>

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
                  <Select value={edit.workstream} onChange={(v) => setEdit({ ...edit, workstream: v })}>
                    <option value="">None</option>{[...new Set([...workstreams, ...(t.workstream ? [t.workstream] : [])])].map((w) => <option key={w}>{w}</option>)}
                  </Select>
                ) : t.workstream}</dd>
              </>)}

              <dt>Note</dt>
              <dd>{canEdit && open
                ? <input value={edit.note} maxLength={140} placeholder="One line: blocker, dependency, who's been chased" onChange={(e) => setEdit({ ...edit, note: e.target.value })} />
                : t.note || <span className="dim">None</span>}</dd>
            </dl>

            {(t.links.length > 0 || canEdit) && (
              <div className="drawer-links">
                <h3>Links</h3>
                {t.links.length > 0 && (
                  <div className="lchips">
                    {t.links.map((l) => <LinkChip key={l.id} l={l} onRemove={canEdit ? () => removeLink(l.id) : undefined} />)}
                  </div>
                )}
                {canEdit && t.links.length < LINKS_PER_TASK && (
                  <form className="link-add" noValidate onSubmit={(e) => { e.preventDefault(); addLink(); }}>
                    <input type="url" inputMode="url" enterKeyHint="done" autoComplete="off" maxLength={2000} value={linkForm.url} aria-label="Link address"
                      placeholder="Paste a link: Doc, Sheet, Figma…" onChange={(e) => setLinkForm({ ...linkForm, url: e.target.value })} />
                    <input maxLength={80} enterKeyHint="done" autoComplete="off" value={linkForm.label} aria-label="Link name (optional)" placeholder="Name (optional)"
                      onChange={(e) => setLinkForm({ ...linkForm, label: e.target.value })} />
                    <button className="btn" disabled={busy || !linkForm.url.trim()}>Add link</button>
                  </form>
                )}
              </div>
            )}

            {dirty && mode !== 'reassign' && (
              <div className="row">
                <button className="btn" disabled={busy || edit.title.trim().length < 3 || !ownerReady(edit.ownerId, edit.ownerRole)} onClick={saveChanges}>Save changes</button>
                <button className="btn ghost" onClick={() => { setEdit({ title: t.title, description: t.description ?? '', note: t.note ?? '', ownerId: t.ownerId, ownerRole: undefined, workstream: t.workstream ?? '' }); setPickKey((k) => k + 1); }}>Discard</button>
              </div>
            )}

            <div className="drawer-foot">
              {open && can && <button className="act danger" onClick={() => setMode('drop')}>Drop task…</button>}
              {!open && isLead && !readOnly && <button className="act" onClick={() => setMode('reopen')}>Reopen…</button>}
              <Link className="act" href={`/tasks/${t.id}`}>Open full page</Link>
            </div>

            <button className="log-toggle small-toggle" aria-expanded={showLog} onClick={() => setShowLog(!showLog)}>
              <span aria-hidden>{showLog ? '▾' : '▸'}</span> History <span className="count-badge">{entries.length}</span>
            </button>
            {showLog && (
              <ol className="log">
                {entries.map((e) => (
                  <li key={e.key}>
                    <span className="when">{fmtStamp(e.at)}</span>
                    <span><PersonLink id={e.actor_id}><b>{e.actorName ?? 'System'}</b></PersonLink> {e.text}</span>
                  </li>
                ))}
              </ol>
            )}


            <CommentThread subjectKind="task" subjectId={t.id} subjectTitle={t.title} people={people} drawer onPosted={can && !readOnly ? offerFromNote : undefined} />
          </>
        )}
      </motion.aside>
    </div>
  );
}

// ---------- add a task ----------

export function AddTaskForm({ people, meId, today, projectId, projects, workstreams: fixedWs = [], wsByProject, defaultWs = '', onDone }: {
  people: Opt[]; meId: string; today: string; projectId?: string; projects?: Opt[]; workstreams?: string[];
  wsByProject?: Record<string, string[]>; defaultWs?: string; onDone: () => void;
}) {
  const router = useRouter();
  const map = useProjectPeople();
  const startProject = projectId ?? '';
  const [f, setF] = useState({ title: '', description: '', ownerId: !startProject || (map[startProject] ?? []).includes(meId) ? meId : '', ownerRole: undefined as string | undefined,
    dueOn: '', note: '', workstream: defaultWs, projectId: startProject });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pasting, setPasting] = useState<string | null>(null); // a chat pasted into Quick Add: its proposals, in place of this form
  const readOnly = useReadOnly();
  const workstreams = wsByProject ? wsByProject[f.projectId] ?? [] : fixedWs;

  // A project for the title (Jev), picked from the list in the Project field. It asks once, when the person leaves the
  // title, and only while no project is chosen. It offers; it never fills the field. Off or unsure: nothing shows.
  const jev = useJev();
  const [guess, setGuess] = useState<string | null>(null);
  const askedFor = useRef('');
  async function guessProject() {
    const title = f.title.trim();
    if (!jev || readOnly || !projects || f.projectId || title.length < 3 || title === askedFor.current) return;
    askedFor.current = title; setGuess(null);
    try {
      const r = await api('/tasks/suggest-project', 'POST', { title });
      if (typeof r?.projectId === 'string' && projects.some((p) => p.id === r.projectId)) setGuess(r.projectId);
    } catch { /* no suggestion */ }
  }

  // Quick add (components/QuickAdd.tsx) fills these fields from one line; they stay editable.
  const titleRef = useRef<HTMLInputElement | null>(null);
  function applyQuick(p: QuickParse): string[] {
    const notes: string[] = [];
    const next = { ...f, title: p.title || f.title };
    if (p.dueOn && p.dueOn >= today) next.dueOn = p.dueOn;
    if (p.project?.status === 'matched' && projects) {
      const id = p.project.item.id;
      next.projectId = id; next.workstream = ''; next.ownerRole = undefined;
      next.ownerId = (map[id] ?? []).includes(f.ownerId) ? f.ownerId : '';
    }
    if (p.owner?.status === 'matched') {
      const o = p.owner.item;
      if (!next.projectId || (map[next.projectId] ?? []).includes(o.id)) { next.ownerId = o.id; next.ownerRole = undefined; }
      else notes.push(`${o.name} is not on that project, so pick the owner below.`);
    }
    setF(next);
    return notes;
  }
  const [many, setMany] = useState<SentenceRead[] | null>(null); // several tasks from one Quick Add
  if (many) return <TaskDrafts drafts={many} people={people} projects={projects} projectId={startProject || undefined} today={today} onBack={() => setMany(null)} onDone={onDone} />;
  if (pasting !== null) return <PasteChat people={people} projects={projects} today={today} startText={pasting} onBack={() => setPasting(null)} onDone={onDone} />;
  return (
    <form className="stack" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setErr(null);
      try {
        const made = await api('/tasks', 'POST', { title: f.title, description: f.description || null, ...ownerFields(f.ownerId, f.ownerRole), dueOn: f.dueOn, projectId: f.projectId || null, note: f.note || null, workstream: f.workstream || null });
        if (made?.id) arrivals.add(made.id);
        notify('Task added');
        router.refresh(); onDone();
      } catch (er) { setErr((er as Error).message); } finally { setBusy(false); }
    }}>
      <QuickAddField today={today} people={people} projects={projects} hasTitle={!!f.title.trim()} apply={applyQuick} focusAfter={() => focusOnDesktop(titleRef.current)} onChat={readOnly ? undefined : setPasting} onMany={setMany} />
      <label className="f"><span>Task</span><input ref={titleRef} required minLength={3} maxLength={200} value={f.title} placeholder="Short name, e.g. Approve hamper samples" onChange={(e) => setF({ ...f, title: e.target.value })} onBlur={guessProject} /></label>
      <label className="f"><span>Details (Optional)</span><textarea rows={2} maxLength={600} value={f.description} placeholder="Anything the owner should know" onChange={(e) => setF({ ...f, description: e.target.value })} /><Count value={f.description} max={600} /></label>
      <div className="row">
        <label className="f"><span>Owner</span>
          <OwnerPicker key={f.projectId} projectId={f.projectId || null} value={f.ownerId} people={people} onChange={(ownerId, ownerRole) => setF({ ...f, ownerId, ownerRole })} />
        </label>
        <label className="f"><span>Due Date</span><DateField required min={today} value={f.dueOn} onChange={(e) => setF({ ...f, dueOn: e.target.value })} /></label>
      </div>
      {guess && !f.projectId && projects && (
        <p className="suggest-line" role="status"><Help term="jev_project_guess">Suggested project</Help>: {projects.find((p) => p.id === guess)?.name}.
          <button type="button" className="mini-btn" onClick={() => {
            // Re-checked at the click: a project the person picked in the meantime stays.
            setF((cur) => cur.projectId ? cur : { ...cur, projectId: guess, workstream: '', ownerRole: undefined, ownerId: (map[guess] ?? []).includes(cur.ownerId) ? cur.ownerId : '' });
            setGuess(null);
          }}>Use it</button>
          <button type="button" className="mini-btn" onClick={() => setGuess(null)}>Not this</button>
        </p>
      )}
      {(projects || workstreams.length > 0) && (
        <div className="row">
          {projects && (
            <label className="f"><span>Project</span>
              <Select value={f.projectId} onChange={(p) => { setF({ ...f, projectId: p, workstream: '', ownerRole: undefined, ownerId: !p || (map[p] ?? []).includes(f.ownerId) ? f.ownerId : '' }); }}>
                <option value="">None</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </label>
          )}
          {workstreams.length > 0 && (
            <label className="f"><span>Sub-Project</span>
              <Select value={f.workstream} onChange={(v) => setF({ ...f, workstream: v })}>
                <option value="">None</option>{workstreams.map((w) => <option key={w}>{w}</option>)}
              </Select>
            </label>
          )}
        </div>
      )}
      <label className="f"><span>Note (Optional)</span><input maxLength={140} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
      <p className="hint" style={{ margin: 0 }}>The due date is kept as the first date. Moving it later needs a reason.</p>
      {err && <p className="err" role="alert">{err}</p>}
      <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn" disabled={busy || !ownerReady(f.ownerId, f.ownerRole)}>Add task</button></div>
    </form>
  );
}
