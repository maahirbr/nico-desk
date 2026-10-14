'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Help } from './HelpMode';
import { api } from './task-ui';
import { PAGES } from './FeedbackForm';
import { notify } from './toast';

// The team's notes, for everyone. An admin can mark a note read; everyone else sees "Read by an admin" once one has.
// Nothing is sent to the writer.
export type FeedbackRow = { id: string; personName: string; stamp: string; path: string | null; body: string; read: boolean };

export function FeedbackList({ rows, canMark }: { rows: FeedbackRow[]; canMark: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  async function markRead(id: string) {
    setBusy(id);
    try { await api(`/feedback/${id}`, 'PATCH'); router.refresh(); }
    catch (e) { notify((e as Error).message); }
    setBusy(null);
  }
  if (rows.length === 0) return <div className="empty-state"><p>No feedback yet.</p></div>;
  return (
    <ul className="fb-list">
      {rows.map((r) => (
        <li key={r.id} className={`card card-pad fb-item${r.read ? ' is-read' : ''}`}>
          <div className="fb-meta small">
            <b>{r.personName}</b><span className="dim">{r.stamp}</span>
            {r.path && <span className="dim">about {PAGES.find(([v]) => v === r.path)?.[1] ?? r.path}</span>}
            <span className="fb-state">
              {r.read ? <span className="dim">{canMark ? 'Read' : 'Read by an admin'}</span>
                : canMark && <Help term="feedback_read" host><button type="button" className="mini-btn" disabled={busy === r.id} onClick={() => markRead(r.id)}>Mark read</button></Help>}
            </span>
          </div>
          <p className="fb-body">{r.body}</p>
        </li>
      ))}
    </ul>
  );
}
