'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useReadOnly } from './readonly';

// "Moved off your plate": tasks that were yours and went to someone else. It is an in-app notice only, nothing is
// sent anywhere. Dismiss marks the notice read. While an admin views as this person, the line shows but cannot be dismissed.

// canOpen is false when the task now sits outside what this person sees: the title shows, with no link (15 Oct).
export type MovedAway = { noticeId: string; taskId: string; title: string; toName: string | null; canOpen: boolean };

export function MovedAwayCard({ items }: { items: MovedAway[] }) {
  const router = useRouter();
  const readOnly = useReadOnly();
  const [gone, setGone] = useState<Set<string>>(new Set());
  const shown = items.filter((i) => !gone.has(i.noticeId));
  if (shown.length === 0) return null;
  const dismiss = async (id: string) => {
    setGone(new Set([...gone, id]));
    try {
      const r = await fetch(`/api/v1/me/notices/${id}/read`, { method: 'POST' });
      if (!r.ok) throw new Error();
      router.refresh();
    } catch {
      setGone((g) => { const n = new Set(g); n.delete(id); return n; });
    }
  };
  return (
    <section className="callout" aria-label="Moved off your plate">
      <h2>Moved off your plate</h2>
      {shown.map((i) => (
        <div key={i.noticeId} className="callout-row moved-row">
          <span className="moved-text">
            {i.canOpen ? <Link className="rlink" href={`/tasks/${i.taskId}`}>{i.title}</Link> : <b>{i.title}</b>}
            {i.toName ? ` now belongs to ${i.toName}.` : ' was given to someone else.'}
          </span>
          {!readOnly && <button className="mini-btn" onClick={() => dismiss(i.noticeId)}>Dismiss</button>}
        </div>
      ))}
    </section>
  );
}
