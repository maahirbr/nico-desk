'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ArchiveAsk, ArchiveNews } from '@/lib/plan';
import { useReadOnly } from './readonly';

// Asks to archive a project (15 Nov), on Home. For an owner or lead: who asked, about which project, and why; the
// project page has Archive and Not now. For the asker: what was decided, until they press OK. In the app only.
export function ArchiveAsksCard({ asks, news }: { asks: ArchiveAsk[]; news: ArchiveNews[] }) {
  const router = useRouter();
  const readOnly = useReadOnly();
  const [gone, setGone] = useState<Set<string>>(new Set());
  const shownNews = news.filter((n) => !gone.has(n.id));
  if (!asks.length && !shownNews.length) return null;
  const ok = async (id: string) => {
    setGone((g) => new Set([...g, id]));
    await fetch('/api/v1/me/archive-news', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) }).catch(() => {});
    router.refresh();
  };
  return (
    <section className="card card-pad archive-asks" aria-label="Asks to archive">
      {asks.length > 0 && <>
        <h2>Asked to archive <span className="n">{asks.length}</span></h2>
        <ul className="archive-asks-list">
          {asks.map((a) => (
            <li key={a.id}><b>{a.askedByName.split(' ')[0]}</b> asked to archive <Link href={`/projects/${a.projectId}`}>{a.projectName}</Link>: <span className="dim">“{a.reason}”</span></li>
          ))}
        </ul>
      </>}
      {shownNews.map((n) => (
        <p key={n.id} className="small archive-news">
          <span><Link href={`/projects/${n.projectId}`}>{n.projectName}</Link> {n.outcome === 'archived' ? 'was archived' : 'was kept, not archived'}, by {n.byName.split(' ')[0]}.</span>
          {!readOnly && <button type="button" className="linkbtn" onClick={() => void ok(n.id)}>OK</button>}
        </p>
      ))}
    </section>
  );
}
