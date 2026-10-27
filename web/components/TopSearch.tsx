'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import type { SearchHit } from '@/lib/search';
import { fmtDate } from '@/lib/time';
import { isPlainClick } from '@/lib/urlstate';
import { commandsFor, type Command } from './commands';
import { Help, useHelpToggle } from './HelpMode';
import { isTyping } from './keys';
import { clearRecent, pushRecent, readRecent, writeRecent } from './recent';
import { useReadOnly } from './readonly';
import { useViewer } from './viewer';
import { isRealEnter } from './ime';

// The search bar at the top middle of every page. Results drop down as you type; Enter opens the
// highlighted one, or the full results page. / or Ctrl/⌘+K jumps here from anywhere.
// Empty box: recent searches, a few commands and the filters. Typing: matching items, then matching commands.
// Filters in the words (is:late, @name, #project) are worked out on the server, so the list is cut to what the reader sees.

const KIND: Record<SearchHit['kind'], string> = { project: 'Project', person: 'Person', task: 'Task', line: 'Plan line', comment: 'Comment' };
const CHIPS = ['is:late', 'is:blocked', 'is:mine', 'due:week', '@', '#'];

// One row in the list, whatever it is, so the arrow keys and Enter treat all rows the same.
type Row =
  | { type: 'hit'; key: string; hit: SearchHit }
  | { type: 'cmd'; key: string; cmd: Command }
  | { type: 'recent'; key: string; q: string }
  | { type: 'all'; key: string };

export function TopSearch() {
  const router = useRouter();
  const path = usePathname();
  const readOnly = useReadOnly();
  const { meId, isLead } = useViewer();
  const toggleHelp = useHelpToggle();
  const box = useRef<HTMLInputElement>(null);
  const armed = useRef(false); // an empty box runs a row on Enter only after the person moved to it
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(0);
  const [mac, setMac] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => { setMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)); }, []);
  useEffect(() => { setRecent(readRecent(meId)); }, [meId]);

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
    let stale = false;
    let t2: ReturnType<typeof setTimeout> | undefined;
    const t = setTimeout(async () => {
      const res = await fetch(`/api/v1/search?q=${encodeURIComponent(term)}`);
      if (stale) return;
      setHits(res.ok ? (await res.json()).slice(0, 8) : []);
      setSel(0);
      // Jev on: once typing pauses, ask for the same results ordered by meaning. Any failure keeps the list above.
      if (res.ok && res.headers.get('x-nico-jev') === 'on' && term.length >= 3) {
        t2 = setTimeout(async () => {
          try {
            const r2 = await fetch(`/api/v1/search?q=${encodeURIComponent(term)}&meaning=1`);
            if (stale || !r2.ok || r2.headers.get('x-nico-jev') !== 'ranked') return;
            setHits((await r2.json()).slice(0, 8));
            setSel(0);
          } catch { /* keep the plain list */ }
        }, 600);
      }
    }, 160);
    return () => { stale = true; clearTimeout(t); clearTimeout(t2); };
  }, [q]);

  const term = q.trim();
  const cmds = useMemo(() => commandsFor(q, { isLead, readOnly }), [q, isLead, readOnly]);
  const rows: Row[] = useMemo(() => {
    if (!term) return [...recent.map((r): Row => ({ type: 'recent', key: `r-${r}`, q: r })), ...cmds.map((cmd): Row => ({ type: 'cmd', key: `c-${cmd.id}`, cmd }))];
    return [
      ...hits.map((hit): Row => ({ type: 'hit', key: `${hit.kind}-${hit.id}`, hit })),
      ...cmds.map((cmd): Row => ({ type: 'cmd', key: `c-${cmd.id}`, cmd })),
      { type: 'all', key: 'all' },
    ];
  }, [term, hits, cmds, recent]);
  const at = Math.min(sel, rows.length - 1);

  // A search counts as "recent" once the person acts on it. Not while viewing as someone else: the list belongs to them.
  const remember = () => {
    if (readOnly || !term) return;
    const next = pushRecent(recent, term);
    setRecent(next);
    writeRecent(meId, next);
  };
  const done = () => { setOpen(false); setQ(''); box.current?.blur(); };
  const go = (href: string) => { remember(); done(); router.push(href); };
  const allHref = `/search?q=${encodeURIComponent(term)}`;
  // Real links: a plain click goes in place, a middle or Cmd click opens a new tab and leaves the box as it is.
  const plain = (href: string) => (e: MouseEvent) => { if (isPlainClick(e)) { e.preventDefault(); go(href); } };
  const run = (c: Command) => {
    done();
    if (c.run.kind === 'go') router.push(c.run.href);
    else if (c.run.kind === 'help') toggleHelp();
    else window.dispatchEvent(new CustomEvent(c.run.name, { detail: c.run.detail }));
  };
  const act = (r: Row) => {
    if (r.type === 'hit') go(r.hit.href);
    else if (r.type === 'cmd') run(r.cmd);
    else if (r.type === 'recent') { setQ(r.q); setSel(0); }
    else go(allHref);
  };
  const addChip = (c: string) => { setQ((v) => `${v.trim()}${v.trim() ? ' ' : ''}${c}`); setSel(0); };
  const forget = () => { clearRecent(meId); setRecent([]); };
  // Keep the box focused when a row inside the list is pressed with a mouse or a finger, so nothing jumps and the
  // keyboard state stays as the person left it.
  const keepFocus = (e: MouseEvent) => e.preventDefault();
  const idx = (r: Row) => rows.indexOf(r);

  const body = !term ? (
    <>
      {recent.length > 0 && (
        <div className="ts-head"><span><Help term="search_recent">Recent</Help></span><button type="button" className="ts-clear" onMouseDown={keepFocus} onClick={forget}>Clear</button></div>
      )}
      {rows.filter((r) => r.type === 'recent').map((r) => r.type === 'recent' && (
        <button key={r.key} type="button" role="option" aria-selected={idx(r) === at} className="ts-hit ts-plain" onMouseDown={keepFocus} onMouseEnter={() => setSel(idx(r))} onClick={() => act(r)}>
          <span className="ts-kind">Recent</span><span className="ts-main"><b>{r.q}</b></span>
        </button>
      ))}
      {cmds.length > 0 && <div className="ts-head"><span><Help term="search_commands">Commands</Help></span></div>}
      {rows.filter((r) => r.type === 'cmd').map((r) => r.type === 'cmd' && (
        <button key={r.key} type="button" role="option" aria-selected={idx(r) === at} className="ts-hit ts-plain" onMouseEnter={() => setSel(idx(r))} onClick={() => act(r)}>
          <span className="ts-kind">Command</span><span className="ts-main"><b>{r.cmd.label}</b></span>
        </button>
      ))}
      <div className="ts-head"><span><Help term="search_filters">Filters</Help></span></div>
      <div className="ts-chips">
        {CHIPS.map((c) => <button key={c} type="button" className="ts-chip" onMouseDown={keepFocus} onClick={() => addChip(c)}>{c}</button>)}
      </div>
    </>
  ) : (
    <>
      {hits.length === 0 && <div className="ts-empty">Nothing matches “{term}”.</div>}
      {rows.map((r) => {
        if (r.type === 'hit') {
          const h = r.hit;
          return (
            <Link key={r.key} href={h.href} prefetch={false} role="option" aria-selected={idx(r) === at} className="ts-hit" onMouseEnter={() => setSel(idx(r))} onClick={plain(h.href)}>
              <span className="ts-kind">{KIND[h.kind]}</span>
              <span className="ts-main"><b>{h.title}</b><span className="small dim">{h.sub}</span></span>
              {h.kind === 'task' && <span className={`small ${h.overdue ? 'late-text' : 'dim'}`}>{h.open ? fmtDate(h.dueOn) : 'Closed'}</span>}
            </Link>
          );
        }
        if (r.type === 'cmd') {
          return (
            <button key={r.key} type="button" role="option" aria-selected={idx(r) === at} className="ts-hit ts-plain" onMouseEnter={() => setSel(idx(r))} onClick={() => act(r)}>
              <span className="ts-kind">Command</span><span className="ts-main"><b>{r.cmd.label}</b></span>
            </button>
          );
        }
        return <Link key={r.key} href={allHref} prefetch={false} className={`ts-all${idx(r) === at ? ' on' : ''}`} onClick={plain(allHref)}>See all results for “{term}”</Link>;
      })}
    </>
  );

  return (
    <div className="topsearch" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false); }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.35-4.35" /></svg>
      <input ref={box} type="search" value={q} placeholder="Search tasks, projects, people" aria-label="Search" enterKeyHint="search" autoComplete="off"
        onFocus={() => { armed.current = false; setOpen(true); }} onChange={(e) => { armed.current = false; setQ(e.target.value); setOpen(true); setSel(0); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); armed.current = true; setSel(Math.min(at + 1, rows.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); armed.current = true; setSel(Math.max(at - 1, 0)); }
          if (isRealEnter(e)) {
            e.preventDefault();
            if (rows[at] && (term || armed.current)) act(rows[at]);
          }
          if (e.key === 'Escape') { setOpen(false); box.current?.blur(); }
        }} />
      <kbd className="kbd">{mac ? '⌘K' : 'Ctrl K'}</kbd>
      {open && <div className="ts-drop" role="listbox">{body}</div>}
    </div>
  );
}
