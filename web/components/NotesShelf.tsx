'use client';

import { useEffect, useRef, useState } from 'react';
import type { NoteMeta, Page } from '@/lib/notes';
import { PersonalNotes } from './PersonalNotes';
import { ReadOnlyProvider, useReadOnly } from './readonly';
import { notify } from './toast';
import { isRealEnter } from './ime';

// Several notes in Personal, laid out like Apple Notes (16 Nov, the PM's pick). Above them, three icons: ☰ shows or
// hides the list, ✎ makes a new untitled note (its name follows its first line until renamed), 🗑 deletes the open
// note (asking once). The list runs newest first under Today, Yesterday, Previous 7 Days, Previous 30 Days, then by
// month, each note as its name, a date and the start of its text. The open note is tinted. Above the page sits the date
// and time it was made. A click on the name in the heading renames it. The fold is remembered in this browser.
type Open = Page & { id: string; name: string; createdAt: string; deletedAt?: string | null };
const KEEP_DAYS = 30; // lib/notes.ts KEEP_DELETED_DAYS

async function call(path: string, method: string, body?: unknown) {
  const r = await fetch(`/api/v1/me/notes${path}`, { method, headers: body === undefined ? undefined : { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = r.status === 204 ? null : await r.json().catch(() => null);
  if (!r.ok) throw new Error(data?.error?.message ?? 'Could not do that. Check your connection.');
  return data;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
// The group a note sits under, by when it was last changed.
function groupOf(at: string, now: Date): string {
  const days = Math.round((dayStart(now) - dayStart(new Date(at))) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return 'Previous 7 Days';
  if (days < 30) return 'Previous 30 Days';
  const d = new Date(at);
  return d.getFullYear() === now.getFullYear() ? MONTHS[d.getMonth()] : String(d.getFullYear());
}
// The date on a row: the time today, the weekday this week, else 21/10/26.
function rowDate(at: string, now: Date): string {
  const d = new Date(at);
  const days = Math.round((dayStart(now) - dayStart(d)) / 86400000);
  if (days <= 0) return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  if (days < 7) return d.toLocaleDateString('en-IN', { weekday: 'long' });
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
}
// Above the page (16 Nov, the PM's call): "Created 2 Oct 2026 · Edited 3:05 PM". Created is the day only; Edited reads as
// a time today, else "13 Nov, 2:37 PM"; it is left out until the note has been written in.
const time = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const fullDate = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
function dateLine(createdAt: string, updatedAt: string | null, now: Date): string {
  const c = new Date(createdAt);
  const made = `Created ${fullDate(c)}`;
  if (!updatedAt) return made;
  const u = new Date(updatedAt);
  const edited = dayStart(u) === dayStart(now) ? time(u) : `${u.getDate()} ${MONTHS[u.getMonth()].slice(0, 3)}, ${time(u)}`;
  return `${made} · Edited ${edited}`;
}

export function NotesShelf({ notes: first, open: firstOpen, projectId, meId, teamId, today }: {
  notes: NoteMeta[]; open: Open; projectId: string; meId: string; teamId: string; today: string;
}) {
  const readOnly = useReadOnly();
  const [notes, setNotes] = useState(first);
  const [open, setOpen] = useState<Open>(firstOpen);
  const [side, setSide] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(firstOpen.name);
  const [sure, setSure] = useState(false); // 🗑 pressed once
  const [trash, setTrash] = useState(false); // Recently Deleted unfolded
  const [now, setNow] = useState(() => new Date());
  const nameBox = useRef<HTMLInputElement>(null);
  useEffect(() => { try { if (localStorage.getItem('notes-side-shut') === '1') setSide(false); } catch { /* storage blocked */ } }, []);
  useEffect(() => { if (renaming) nameBox.current?.select(); }, [renaming]);
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t); }, []);
  const fold = () => { const next = !side; setSide(next); try { localStorage.setItem('notes-side-shut', next ? '0' : '1'); } catch { /* storage blocked */ } };

  const show = async (id: string) => {
    try { const p: Open = await call(`?id=${encodeURIComponent(id)}`, 'GET'); setOpen(p); setName(p.name); setRenaming(false); setSure(false); }
    catch (e) { notify((e as Error).message); }
  };
  const pick = (id: string) => { if (id !== open.id) void show(id); };
  const make = async () => {
    try {
      const m: NoteMeta = await call('/list', 'POST');
      setNotes((all) => [m, ...all]);
      await show(m.id);
      requestAnimationFrame(() => (document.querySelector('.rnotes .ProseMirror') as HTMLElement | null)?.focus());
    } catch (e) { notify((e as Error).message); }
  };
  const rename = async () => {
    const n = name.trim();
    setRenaming(false);
    if (!n || n === open.name) { setName(open.name); return; }
    try { await call(`/${open.id}`, 'PATCH', { name: n }); setOpen({ ...open, name: n }); setNotes((all) => all.map((x) => (x.id === open.id ? { ...x, name: n } : x))); }
    catch (e) { setName(open.name); notify((e as Error).message); }
  };
  const refresh = async (openId?: string) => {
    const list: NoteMeta[] = await call('/list', 'GET');
    setNotes(list); setSure(false);
    const next = openId ?? list.find((x) => !x.deletedAt)?.id;
    if (next) await show(next);
  };
  // 🗑: a note goes to Recently Deleted (30 days); one already there goes for good. Asks once either way.
  const remove = async () => {
    if (!sure) { setSure(true); setTimeout(() => setSure(false), 4000); return; }
    const forever = !!open.deletedAt;
    try { await call(`/${open.id}`, 'DELETE'); await refresh(); notify(forever ? 'Deleted for good' : 'Moved to Recently Deleted'); }
    catch (e) { notify((e as Error).message); }
  };
  const recover = async () => {
    try { await call(`/${open.id}`, 'PATCH', { recover: true }); await refresh(open.id); notify('Recovered'); }
    catch (e) { notify((e as Error).message); }
  };
  // After each save: the open note's name (if it follows its first line), preview and time, and it moves to the top.
  const saved = (r: { updatedAt: string; name: string; preview: string }) => {
    setNotes((all) => [{ ...(all.find((x) => x.id === open.id) ?? { id: open.id, createdAt: open.createdAt }), name: r.name, preview: r.preview, updatedAt: r.updatedAt } as NoteMeta, ...all.filter((x) => x.id !== open.id)]);
    setOpen((o) => ({ ...o, updatedAt: r.updatedAt, ...(renaming ? {} : { name: r.name }) }));
    if (!renaming && r.name !== open.name) setName(r.name);
  };

  const icon = (d: string) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>;
  const heading = (
    <span className="nshelf-head">
      <span className="nshelf-tools">
        <button type="button" className={`nshelf-tool${side ? ' on' : ''}`} aria-expanded={side} aria-label={side ? 'Hide the list of notes' : 'Show the list of notes'} title={side ? 'Hide notes list' : 'Show notes list'} onClick={fold}>{icon('M4 6h16M4 12h16M4 18h16')}</button>
        {!readOnly && <button type="button" className="nshelf-tool" aria-label="New note" title="New note" onClick={() => void make()}>{icon('M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z')}</button>}

      </span>
      {renaming
        ? <input ref={nameBox} className="nshelf-rename" value={name} maxLength={80} aria-label="Note name" onChange={(e) => setName(e.target.value)}
            onBlur={() => void rename()} onKeyDown={(e) => { if (isRealEnter(e)) { e.preventDefault(); void rename(); } if (e.key === 'Escape') { setName(open.name); setRenaming(false); } }} />
        : <button type="button" className="nshelf-name" title={readOnly ? undefined : 'Rename'} disabled={readOnly} onClick={() => setRenaming(true)}>{open.name}{!readOnly && <span className="nshelf-pen" aria-hidden>✎</span>}</button>}
    </span>
  );

  // The list, grouped by when each note last changed; Recently Deleted at the bottom, folded until opened.
  const live = notes.filter((n) => !n.deletedAt);
  const gone = notes.filter((n) => n.deletedAt);
  const groups: { label: string; items: NoteMeta[] }[] = [];
  for (const n of live) {
    const label = groupOf(n.updatedAt ?? n.createdAt, now);
    const g = groups[groups.length - 1];
    if (g?.label === label) g.items.push(n); else groups.push({ label, items: [n] });
  }
  const left = (at: string) => Math.min(KEEP_DAYS, Math.max(0, KEEP_DAYS - Math.floor((Date.now() - new Date(at).getTime()) / 86400000)));
  const row = (n: NoteMeta) => (
    <button key={n.id} type="button" className="nshelf-item" aria-current={n.id === open.id ? 'true' : undefined} onClick={() => pick(n.id)}>
      <b>{n.name}</b>
      <span className="nshelf-meta">{n.deletedAt
        ? <span className="nshelf-when">{left(n.deletedAt)} {left(n.deletedAt) === 1 ? 'day' : 'days'} left</span>
        : <><span className="nshelf-when">{rowDate(n.updatedAt ?? n.createdAt, now)}</span>{n.preview && <span className="nshelf-prev">{n.preview}</span>}</>}</span>
    </button>
  );
  const aside = side ? (
    <nav className="nshelf-side" aria-label="Notes">
      {groups.map((g) => (
        <div key={g.label} className="nshelf-group">
          <p className="nshelf-glabel">{g.label}</p>
          {g.items.map(row)}
        </div>
      ))}
      {gone.length > 0 && (
        <div className="nshelf-group nshelf-trash">
          <button type="button" className="nshelf-glabel nshelf-trash-h" aria-expanded={trash || !!open.deletedAt} onClick={() => setTrash(!trash)}>
            <span aria-hidden>{trash || open.deletedAt ? '▾' : '▸'}</span> Recently Deleted <span className="dim">{gone.length}</span>
          </button>
          {(trash || open.deletedAt) && gone.map(row)}
        </div>
      )}
    </nav>
  ) : null;

  // 🗑 sits at the far right of the heading row (the PM's call, 16 Nov), away from ☰ and ✎.
  const actions = (
    !readOnly ? <button type="button" className={`nshelf-tool${sure ? ' sure' : ''}`} aria-label={sure ? `Press again to delete ${open.name}` : `Delete ${open.name}`} title={sure ? 'Press again to delete' : 'Delete note'} onClick={() => void remove()}>
          {sure ? <span className="nshelf-sure">Delete?</span> : icon('M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6')}</button> : null
  );

  const line = open.deletedAt
    ? <span className="nshelf-gone">In Recently Deleted · goes for good in {left(open.deletedAt)} {left(open.deletedAt) === 1 ? 'day' : 'days'}{!readOnly && <> · <button type="button" className="linkbtn" onClick={() => void recover()}>Recover</button></>}</span>
    : dateLine(open.createdAt, open.updatedAt, now);
  const notesView = <PersonalNotes key={open.id} page={open} noteId={open.id} heading={heading} aside={aside} dateLine={line} onSaved={saved} actions={actions}
    projectId={projectId} meId={meId} teamId={teamId} today={today} />;
  // A note in Recently Deleted reads only; Recover brings it back to write in.
  return open.deletedAt ? <ReadOnlyProvider readOnly>{notesView}</ReadOnlyProvider> : notesView;
}
