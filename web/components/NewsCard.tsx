'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import type { News } from '@/lib/news';
import { useReadOnly } from './readonly';

// The What's new note at the top of Home (lib/news.ts): the welcome card's look, kept thin. Got it hides it for good, on
// every device. The body's `mark` words are highlighted and its `link` words open their page.
type Cut = { at: number; text: string; el: (k: number) => ReactNode };
function body(n: News): ReactNode[] {
  const cuts: Cut[] = [];
  if (n.mark) cuts.push({ at: n.body.indexOf(n.mark), text: n.mark, el: (k) => <mark key={k} className="news-mark">{n.mark}</mark> });
  if (n.link) { const l = n.link; cuts.push({ at: n.body.lastIndexOf(l.text), text: l.text, el: (k) => <Link key={k} href={l.href}>{l.text}</Link> }); }
  cuts.sort((x, y) => x.at - y.at);
  const out: ReactNode[] = [];
  let from = 0;
  cuts.forEach((c, i) => {
    if (c.at < from) return; // words not found (-1) or overlapping are left as plain text
    out.push(n.body.slice(from, c.at), c.el(i));
    from = c.at + c.text.length;
  });
  out.push(n.body.slice(from));
  return out;
}

export function NewsCard({ n }: { n: News }) {
  const readOnly = useReadOnly();
  const [gone, setGone] = useState(false);
  const [said, setSaid] = useState('');
  if (gone || readOnly) return null;
  const gotIt = async () => {
    const res = await fetch('/api/v1/me/news/seen', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: n.id }) }).catch(() => null);
    if (res?.ok) setGone(true); else setSaid('Could not save that. Try again.');
  };
  return (
    <section className="card welcome news" aria-label="What's new">
      <h2>{n.title}</h2>
      <p className="news-body">{body(n)}</p>
      <div className="row news-actions">
        <button type="button" className="btn news-ok" onClick={gotIt}>Got it ✓</button>
        {said && <span className="small dim" role="status">{said}</span>}
      </div>
    </section>
  );
}
