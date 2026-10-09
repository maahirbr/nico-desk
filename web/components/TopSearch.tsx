'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { parseCommit, type Person } from '@/lib/commit';
import type { SearchHit } from '@/lib/search';
import { fmtDate } from '@/lib/time';
import { isTyping } from './keys';
import { arrivals } from './motion';
import { api } from './task-ui';
import s from './TopSearch.module.css';

// The search bar at the top middle of every page. Results drop down as you type; Enter opens the
// highlighted one, or the full results page. / or Ctrl/⌘+K jumps here from anywhere.
// v2: "ask <person> to <thing> by <date>" and "I'll <thing> by <date>" turn into a draft you confirm
// with one click (lib/commit.ts, a fixed parser). Anything else is a normal search.

const KIND: Record<SearchHit['kind'], string> = { project: 'Project', person: 'Person', task: 'Task', line: 'Plan line' };

export function TopSearch({ people, meId, todayIso }: { people: Person[]; meId: string; todayIso: string }) {
  const router = useRouter();
  const path = usePathname();
  const box = useRef<HTMLInputElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(0);
  const [mac, setMac] = useState(false);
  const [dueOn, setDueOn] = useState<string | null>(null); // a date the person picked over the parsed one
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const draft = parseCommit(q, todayIso, people, meId);
  const draftKey = draft ? `${draft.kind}|${draft.title}|${'toId' in draft ? draft.toId : ''}` : '';
  useEffect(() => { setDueOn(null); setErr(null); }, [draftKey]);
  useEffect(() => { if (!done) return; const id = setTimeout(() => setDone(null), 4000); return () => clearTimeout(id); }, [done]);
  useEffect(() => { setMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)); }, []);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); box.current?.focus(); box.current?.select(); return; }
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !isTyping(e.target) && !document.querySelector('[aria-modal="true"]')) {
        e.preventDefault(); box.current?.focus(); box.current?.select();
      }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  useEffect(() => { setOpen(false); }, [path]);
  // The keyboard rule closes the keyboard on any tap outside a text field, which blurs the input
  // before a tap on a drop-down button lands. So the drop-down closes on a tap outside it, not on blur.
  useEffect(() => {
    const down = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', down, true);
    return () => document.removeEventListener('pointerdown', down, true);
  }, []);
  useEffect(() => {
    const term = q.trim();
    if (!term || draft) { setHits([]); return; }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/v1/search?q=${encodeURIComponent(term)}`);
      setHits(res.ok ? (await res.json()).slice(0, 8) : []);
      setSel(0);
    }, 160);
    return () => clearTimeout(t);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (href: string) => { setOpen(false); setQ(''); box.current?.blur(); router.push(href); };
  const all = () => go(`/search?q=${encodeURIComponent(q.trim())}`);
  const date = draft ? dueOn ?? draft.dueOn : '';
  const blocked = !draft || ('problem' in draft && !!draft.problem) || busy || date < todayIso;

  async function confirm() {
    if (!draft || blocked) return;
    setBusy(true); setErr(null);
    try {
      if (draft.kind === 'ask') {
        const made = await api('/asks', 'POST', { title: draft.title, toId: draft.toId, dueOn: date });
        if (made?.id) arrivals.add(made.id);
        setDone(`Asked ${draft.toName.split(' ')[0]} for “${draft.title}” by ${fmtDate(date)}. It is under You asked.`);
      } else {
        const made = await api('/tasks', 'POST', { title: draft.title, ownerId: meId, dueOn: date });
        if (made?.id) arrivals.add(made.id);
        setDone(`Added “${draft.title}” to your tasks, due ${fmtDate(date)}.`);
      }
      setQ(''); setOpen(false); box.current?.blur(); router.refresh();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div ref={wrap} className="topsearch" onBlur={(e) => { const r = e.relatedTarget as Node | null; if (r && !e.currentTarget.contains(r)) setOpen(false); }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.35-4.35" /></svg>
      <input ref={box} type="search" value={q} placeholder="Search tasks, projects, people" aria-label="Search"
        onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setSel(Math.min(sel + 1, hits.length)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setSel(Math.max(sel - 1, 0)); }
          if (e.key === 'Enter' && q.trim()) { e.preventDefault(); if (draft) confirm(); else if (hits[sel]) go(hits[sel].href); else all(); }
          if (e.key === 'Escape') { setOpen(false); box.current?.blur(); }
        }} />
      <kbd className="kbd">{mac ? '⌘K' : 'Ctrl K'}</kbd>
      {done && !q.trim() && <div className={`ts-drop ${s.done}`} role="status">{done}</div>}
      {open && q.trim() && draft && (
        <div className="ts-drop" role="dialog" aria-label="Draft">
          <div className={s.draft}>
            <span className={s.what}>{draft.kind === 'ask' ? <>Ask <b>{draft.toName}</b></> : <>Add to <b>your tasks</b></>}</span>
            <span className={s.title}>{draft.title}</span>
            <label className={s.when}><span>By</span>
              <input type="date" value={date} min={todayIso} onChange={(e) => setDueOn(e.target.value || null)} aria-label="Due date" />
              <span className={s.words}>{fmtDate(date)}</span>
            </label>
            {'problem' in draft && draft.problem && <p className="err">{draft.problem}</p>}
            {err && <p className="err">{err}</p>}
            <div className={s.actions}>
              <button className="btn" disabled={blocked} onClick={confirm}>{draft.kind === 'ask' ? `Ask ${draft.toName.split(' ')[0]}` : 'Add task'}</button>
              <button className="btn ghost" onClick={all}>Search instead</button>
            </div>
          </div>
        </div>
      )}
      {open && q.trim() && !draft && (
        <div className="ts-drop" role="listbox">
          {hits.length === 0 ? <div className="ts-empty">Nothing matches “{q.trim()}”.</div> : hits.map((h, i) => (
            <button key={`${h.kind}-${h.id}`} role="option" aria-selected={i === sel} className="ts-hit" onMouseEnter={() => setSel(i)} onClick={() => go(h.href)}>
              <span className="ts-kind">{KIND[h.kind]}</span>
              <span className="ts-main"><b>{h.title}</b><span className="small dim">{h.sub}</span></span>
              {h.kind === 'task' && <span className={`small ${h.overdue ? 'late-text' : 'dim'}`}>{h.open ? fmtDate(h.dueOn) : 'Closed'}</span>}
            </button>
          ))}
          <button className={`ts-all${sel === hits.length ? ' on' : ''}`} onClick={all}>See all results for “{q.trim()}”</button>
        </div>
      )}
    </div>
  );
}
