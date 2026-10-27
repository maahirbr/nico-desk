'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useReadOnly } from './readonly';
import { api } from './task-ui';
import { PAGES } from './FeedbackForm';
import { notify } from './toast';
import { EmptyMark, ICON } from './icons';

// The team's notes, for everyone, piling up newest first. Screenshots show as small pictures that open full size. "+1"
// backs a teammate's note; the writer sees the count. Replies show under each note for everyone; only people the Roster
// lets reply see the Reply box. Opening this page marks replies to your own notes seen, so Home stops showing them.
export type FeedbackRow = { id: string; personId: string; personName: string; stamp: string; path: string | null; body: string; images: number; votes: number; mine: boolean;
  replies: { id: string; authorName: string; body: string; stamp: string }[] };

export function FeedbackList({ rows, canReply, meId }: { rows: FeedbackRow[]; canReply: boolean; meId: string }) {
  const router = useRouter();
  const readOnly = useReadOnly();
  const [replying, setReplying] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  // Seeing your notes here counts as seeing their replies.
  useEffect(() => {
    if (readOnly || !rows.some((r) => r.personId === meId && r.replies.length)) return;
    void fetch('/api/v1/me/feedback-replies/seen', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }).catch(() => {});
  }, [readOnly, rows, meId]);
  async function reply(id: string) {
    if (!draft.trim() || sending) return;
    setSending(true);
    try { await api(`/feedback/${id}/replies`, 'POST', { body: draft.trim() }); setDraft(''); setReplying(null); router.refresh(); }
    catch (e) { notify((e as Error).message); }
    finally { setSending(false); }
  }
  const [vote, setVote] = useState<Record<string, { votes: number; mine: boolean }>>({});
  async function toggle(r: FeedbackRow) {
    const cur = vote[r.id] ?? { votes: r.votes, mine: r.mine };
    setVote((v) => ({ ...v, [r.id]: { votes: cur.votes + (cur.mine ? -1 : 1), mine: !cur.mine } })); // shows at once
    try { const out = await api(`/feedback/${r.id}/vote`, cur.mine ? 'DELETE' : 'POST'); setVote((v) => ({ ...v, [r.id]: out })); }
    catch (e) { setVote((v) => ({ ...v, [r.id]: cur })); notify((e as Error).message); }
  }
  if (rows.length === 0) return <div className="empty-state"><EmptyMark d={ICON['/feedback']} /><p>No feedback yet.</p></div>;
  return (
    <ul className="fb-list">
      {rows.map((r) => (
        <li key={r.id} id={r.id} className="card card-pad fb-item">
          <div className="fb-meta small">
            <b>{r.personName}</b><span className="dim">{r.stamp}</span>
            {r.path && <span className="dim">about {PAGES.find(([v]) => v === r.path)?.[1] ?? r.path}</span>}
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
                <button type="button" className={`mini-btn${v.mine ? ' on' : ''}`} aria-pressed={v.mine} aria-label={v.mine ? 'Take back your +1' : '+1, I agree'} onClick={() => void toggle(r)}>{v.mine ? '✓ +1' : '+1'}</button>
                {v.votes > 0 && <span className="small dim">{others}</span>}
              </div>
            );
          })()}
          {r.replies.length > 0 && (
            <ul className="fb-replies">
              {r.replies.map((x) => (
                <li key={x.id}><div className="fb-meta small"><b>{x.authorName}</b><span className="dim">{x.stamp}</span></div><p className="fb-body">{x.body}</p></li>
              ))}
            </ul>
          )}
          {canReply && (replying === r.id ? (
            <form className="fb-reply-form stack" onSubmit={(e) => { e.preventDefault(); void reply(r.id); }}>
              <textarea rows={3} maxLength={2000} value={draft} autoFocus aria-label={`Reply to ${r.personName}`} placeholder="Write a reply"
                onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') { setReplying(null); setDraft(''); } }} />
              <div className="row" style={{ justifyContent: 'flex-end', gap: 'var(--space-sm)' }}>
                <button type="button" className="btn ghost" onClick={() => { setReplying(null); setDraft(''); }}>Cancel</button>
                <button type="submit" className="btn" disabled={sending || !draft.trim()}>{sending ? 'Sending…' : 'Reply'}</button>
              </div>
            </form>
          ) : <button type="button" className="linkbtn fb-reply-open" onClick={() => { setReplying(r.id); setDraft(''); }}>Reply</button>)}
        </li>
      ))}
    </ul>
  );
}
