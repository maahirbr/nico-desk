'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useReadOnly } from './readonly';
import { Help } from './HelpMode';
import { api } from './task-ui';
import { PAGES } from './FeedbackForm';
import { notify } from './toast';

// The team's notes, for everyone. An admin can mark a note read; everyone else sees "Read by an admin" once one has.
// Screenshots show as small pictures that open full size. "Me too" backs a teammate's note; the writer sees the count.
// Nothing is sent to the writer.
export type FeedbackRow = { id: string; personId: string; personName: string; stamp: string; path: string | null; body: string; read: boolean; images: number; votes: number; mine: boolean };

export function FeedbackList({ rows, canMark, meId }: { rows: FeedbackRow[]; canMark: boolean; meId: string }) {
  const router = useRouter();
  const readOnly = useReadOnly();
  const [busy, setBusy] = useState<string | null>(null);
  const [vote, setVote] = useState<Record<string, { votes: number; mine: boolean }>>({});
  async function toggle(r: FeedbackRow) {
    const cur = vote[r.id] ?? { votes: r.votes, mine: r.mine };
    setVote((v) => ({ ...v, [r.id]: { votes: cur.votes + (cur.mine ? -1 : 1), mine: !cur.mine } })); // shows at once
    try { const out = await api(`/feedback/${r.id}/vote`, cur.mine ? 'DELETE' : 'POST'); setVote((v) => ({ ...v, [r.id]: out })); }
    catch (e) { setVote((v) => ({ ...v, [r.id]: cur })); notify((e as Error).message); }
  }
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
          {r.images > 0 && (
            <div className="fb-shots">
              {Array.from({ length: r.images }, (_, i) => (
                <a key={i} className="fb-shot" href={`/api/v1/feedback/${r.id}/images/${i + 1}`} target="_blank" rel="noopener noreferrer" aria-label={`Open screenshot ${i + 1} from ${r.personName}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/v1/feedback/${r.id}/images/${i + 1}`} alt={`Screenshot ${i + 1} from ${r.personName}`} loading="lazy" />
                </a>
              ))}
            </div>
          )}
          {(() => {
            const v = vote[r.id] ?? { votes: r.votes, mine: r.mine };
            const others = v.votes === 1 ? '1 person agrees' : `${v.votes} people agree`;
            if (r.personId === meId || readOnly) return v.votes > 0 ? <p className="small dim fb-votes">{others}</p> : null;
            return (
              <div className="fb-votes">
                <button type="button" className={`mini-btn${v.mine ? ' on' : ''}`} aria-pressed={v.mine} onClick={() => void toggle(r)}>{v.mine ? '✓ Me too' : 'Me too'}</button>
                {v.votes > 0 && <span className="small dim">{others}</span>}
              </div>
            );
          })()}
        </li>
      ))}
    </ul>
  );
}
