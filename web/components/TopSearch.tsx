'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { SearchHit } from '@/lib/search';
import { fmtDate } from '@/lib/time';
import { isTyping } from './keys';

// The search bar at the top middle of every page. Results drop down as you type; Enter opens the
// highlighted one, or the full results page. / or Ctrl/⌘+K jumps here from anywhere.

const KIND: Record<SearchHit['kind'], string> = { project: 'Project', person: 'Person', task: 'Task', line: 'Plan line' };

export function TopSearch() {
  const router = useRouter();
  const path = usePathname();
  const box = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(0);
  const [mac, setMac] = useState(false);
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
  useEffect(() => {
    const term = q.trim();
    if (!term) { setHits([]); return; }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/v1/search?q=${encodeURIComponent(term)}`);
      setHits(res.ok ? (await res.json()).slice(0, 8) : []);
      setSel(0);
    }, 160);
    return () => clearTimeout(t);
  }, [q]);

  const go = (href: string) => { setOpen(false); setQ(''); box.current?.blur(); router.push(href); };
  const all = () => go(`/search?q=${encodeURIComponent(q.trim())}`);

  return (
    <div className="topsearch" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false); }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.35-4.35" /></svg>
      <input ref={box} type="search" value={q} placeholder="Search tasks, projects, people" aria-label="Search"
        onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setSel(Math.min(sel + 1, hits.length)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setSel(Math.max(sel - 1, 0)); }
          if (e.key === 'Enter' && q.trim()) { e.preventDefault(); if (hits[sel]) go(hits[sel].href); else all(); }
          if (e.key === 'Escape') { setOpen(false); box.current?.blur(); }
        }} />
      <kbd className="kbd">{mac ? '⌘K' : 'Ctrl K'}</kbd>
      {open && q.trim() && (
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
