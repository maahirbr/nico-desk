'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { SearchHit } from '@/lib/search';
import { fmtDate } from '@/lib/time';

const LABEL: Record<SearchHit['kind'], string> = { project: 'Projects', person: 'People', task: 'Tasks', line: 'Plan lines' };

export function SearchView({ initial }: { initial: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initial);
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => {
    const term = q.trim();
    if (!term) { setHits(null); return; }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/v1/search?q=${encodeURIComponent(term)}`);
      setHits(res.ok ? await res.json() : []);
      setSel(0);
      window.history.replaceState(null, '', `/search?q=${encodeURIComponent(term)}`);
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  const kinds = (['project', 'person', 'task', 'line'] as const).filter((k) => hits?.some((h) => h.kind === k));
  const flat = kinds.flatMap((k) => hits!.filter((h) => h.kind === k));

  return (
    <div className="calm narrow">
      <header className="page-head"><div><h1>Search</h1><p className="summary">Projects, tasks, plan lines and people.</p></div></header>
      <input ref={input} type="search" className="big-search" placeholder="Search for a task, project or person" value={q} aria-label="Search"
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setSel(Math.min(sel + 1, flat.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setSel(Math.max(sel - 1, 0)); }
          if (e.key === 'Enter' && flat[sel]) router.push(flat[sel].href);
        }} />
      {hits && hits.length === 0 && <div className="empty-state"><p>Nothing matches “{q.trim()}”.</p></div>}
      {kinds.map((k) => (
        <section key={k} className="group">
          <h2>{LABEL[k]} <span className="n">{hits!.filter((h) => h.kind === k).length}</span></h2>
          <div className="tlist">
            {hits!.filter((h) => h.kind === k).map((h) => (
              <Link key={`${h.kind}-${h.id}`} href={h.href} className={`hit${flat[sel] === h ? ' sel' : ''}`}>
                <span className="hit-main"><b>{h.title}</b><span className="small dim">{h.sub}</span></span>
                {h.kind === 'task' && (
                  <span className={`small ${h.overdue ? 'late-text' : 'dim'}`}>{h.open ? `Due ${fmtDate(h.dueOn)}` : 'Closed'}</span>
                )}
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
