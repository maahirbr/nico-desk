'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Mention } from '@/lib/comments';
import { useReadOnly } from './readonly';

// "Mentioned you": comments that tag this person with @. It is an in-app notice only, nothing is sent anywhere. Dismiss
// marks the notice read, and so does following the link. While an admin views as this person, it shows but cannot be changed.

export function MentionsCard({ items }: { items: Mention[] }) {
  const router = useRouter();
  const readOnly = useReadOnly();
  const [gone, setGone] = useState<Set<string>>(new Set());
  const shown = items.filter((i) => !gone.has(i.noticeId));
  if (shown.length === 0) return null;
  const read = (id: string) => fetch(`/api/v1/me/notices/${id}/read`, { method: 'POST' });
  const dismiss = async (id: string) => {
    setGone(new Set([...gone, id]));
    try {
      const r = await read(id);
      if (!r.ok) throw new Error();
      router.refresh();
    } catch {
      setGone((g) => { const n = new Set(g); n.delete(id); return n; });
    }
  };
  return (
    <section className="callout" aria-label="Mentioned you">
      <h2>Mentioned you</h2>
      {shown.map((i) => (
        <div key={i.noticeId} className="callout-row moved-row">
          <span className="moved-text">
            {i.byName} on{' '}
            <Link className="rlink" href={`/${i.subjectKind}s/${i.subjectId}`} onClick={() => { if (!readOnly) read(i.noticeId).catch(() => {}); }}>{i.subjectTitle}</Link>
            : {i.snippet}
          </span>
          {!readOnly && <button className="mini-btn" onClick={() => dismiss(i.noticeId)}>Dismiss</button>}
        </div>
      ))}
    </section>
  );
}
