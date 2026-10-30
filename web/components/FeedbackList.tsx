'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useReadOnly } from './readonly';
import { api } from './task-ui';
import { PAGES } from './FeedbackForm';
import { notify } from './toast';
import { EmptyMark, ICON } from './icons';
import { useUrlText } from './remember';

// The team's notes, for everyone. A switch at the top shows Open (newest first) or Resolved (Done and Not now, most
// recently closed first); it opens on Open and keeps the choice in the address (?show=resolved). Nothing is removed. Screenshots show as small pictures that open full size. "+1" backs a teammate's open note. Anyone replies, marks
// a note Done, or Not now with a short reason that shows on the note, and anyone reopens it (the PM's call, 30 Oct).
// Opening this page marks your feedback news seen, so Home stops showing it. Beside +1, the count and who agreed:
// "+2 · You and Kabir", up to three names, then "and 2 others", which opens the full list.

// "Priya", "Priya and Kabir", "Priya, Kabir and Sam".
const joinNames = (n: string[]) => n.length < 2 ? n.join('') : `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`;
function Agreed({ votes, names }: { votes: number; names: string[] }) {
  const [all, setAll] = useState(false);
  if (votes === 0) return null;
  const SHOWN = 3;
  const extra = names.length - SHOWN;
  return (
    <span className="small fb-agreed">
      <b>+{votes}</b><span className="dim"> · </span>
      {extra <= 0 || all ? joinNames(names) : <>{names.slice(0, SHOWN).join(', ')} and <button type="button" className="linkbtn" onClick={() => setAll(true)}>{extra} {extra === 1 ? 'other' : 'others'}</button></>}
    </span>
  );
}
export type FeedbackRow = { id: string; personId: string; personName: string; stamp: string; path: string | null; body: string; images: number; votes: number; mine: boolean; others: string[];
  status: 'open' | 'done' | 'not_now'; closedByName: string | null; closedAt: string | null; closedStamp: string | null; closedNote: string | null;
  replies: { id: string; authorName: string; body: string; stamp: string }[] };

export function FeedbackList({ rows, hasNews, meId }: { rows: FeedbackRow[]; hasNews: boolean; meId: string }) {
  const router = useRouter();
  const readOnly = useReadOnly();
  const [replying, setReplying] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [notNow, setNotNow] = useState<string | null>(null); // the note whose Not now reason box is open
  const [reason, setReason] = useState('');
  const [moving, setMoving] = useState<string | null>(null);
  const [show, setShow] = useUrlText('show');
  const resolved = show === 'resolved';
  // Seeing this page counts as seeing the news on Home.
  useEffect(() => {
    if (readOnly || !hasNews) return;
    void fetch('/api/v1/me/feedback-replies/seen', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }).catch(() => {});
  }, [readOnly, hasNews]);
  async function reply(id: string) {
    if (!draft.trim() || sending) return;
    setSending(true);
    try { await api(`/feedback/${id}/replies`, 'POST', { body: draft.trim() }); setDraft(''); setReplying(null); router.refresh(); }
    catch (e) { notify((e as Error).message); }
    finally { setSending(false); }
  }
  async function move(id: string, status: FeedbackRow['status'], why?: string) {
    if (moving) return;
    setMoving(id);
    try {
      await api(`/feedback/${id}/status`, 'POST', why ? { status, reason: why } : { status });
      setNotNow(null); setReason('');
      notify(status === 'done' ? 'Marked done' : status === 'not_now' ? 'Marked not now' : 'Reopened');
      router.refresh();
    } catch (e) { notify((e as Error).message); }
    finally { setMoving(null); }
  }
  const [vote, setVote] = useState<Record<string, { votes: number; mine: boolean; others: string[] }>>({});
  async function toggle(r: FeedbackRow) {
    const cur = vote[r.id] ?? { votes: r.votes, mine: r.mine, others: r.others };
    setVote((v) => ({ ...v, [r.id]: { ...cur, votes: cur.votes + (cur.mine ? -1 : 1), mine: !cur.mine } })); // shows at once
    try { const out = await api(`/feedback/${r.id}/vote`, cur.mine ? 'DELETE' : 'POST'); setVote((v) => ({ ...v, [r.id]: out })); }
    catch (e) { setVote((v) => ({ ...v, [r.id]: cur })); notify((e as Error).message); }
  }
  if (rows.length === 0) return <div className="empty-state"><EmptyMark d={ICON['/feedback']} /><p>No feedback yet.</p></div>;
  const open = rows.filter((r) => r.status === 'open');
  const closed = rows.filter((r) => r.status !== 'open').sort((a, b) => (b.closedAt ?? '').localeCompare(a.closedAt ?? ''));
  const item = (r: FeedbackRow) => {
    const v = vote[r.id] ?? { votes: r.votes, mine: r.mine, others: r.others };
    const agreed = <Agreed votes={v.votes} names={[...(v.mine ? ['You'] : []), ...v.others]} />;
    const isOpen = r.status === 'open';
    return (
      <li key={r.id} id={r.id} className={`card card-pad fb-item${isOpen ? '' : ' is-closed'}`}>
        <div className="fb-meta small">
          <b>{r.personName}</b><span className="dim">{r.stamp}</span>
          {r.path && <span className="dim">about {PAGES.find(([p]) => p === r.path)?.[1] ?? r.path}</span>}
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
        {!isOpen && (
          <div className="fb-outcome small">
            <span className={`st st-status ${r.status === 'done' ? 'tone-ok' : 'tone-idle'}`}>{r.status === 'done' ? '✓ Done' : 'Not now'}</span>
            <span className="dim">{r.closedByName} · {r.closedStamp}</span>
            {r.closedNote && <p className="fb-reason">{r.closedNote}</p>}
          </div>
        )}
        {isOpen && r.personId !== meId && !readOnly ? (
          <div className="fb-votes">
            <button type="button" className={`mini-btn${v.mine ? ' on' : ''}`} aria-pressed={v.mine} aria-label={v.mine ? 'Take back your +1' : '+1, I agree'} onClick={() => void toggle(r)}>{v.mine ? '✓ +1' : '+1'}</button>
            {agreed}
          </div>
        ) : v.votes > 0 && <p className="fb-votes">{agreed}</p>}
        {r.replies.length > 0 && (
          <ul className="fb-replies">
            {r.replies.map((x) => (
              <li key={x.id}><div className="fb-meta small"><b>{x.authorName}</b><span className="dim">{x.stamp}</span></div><p className="fb-body">{x.body}</p></li>
            ))}
          </ul>
        )}
        {!readOnly && (replying === r.id ? (
          <form className="fb-reply-form stack" onSubmit={(e) => { e.preventDefault(); void reply(r.id); }}>
            <textarea rows={3} maxLength={2000} value={draft} autoFocus aria-label={`Reply to ${r.personName}`} placeholder="Write a reply"
              onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') { setReplying(null); setDraft(''); } }} />
            <div className="row" style={{ justifyContent: 'flex-end', gap: 'var(--space-sm)' }}>
              <button type="button" className="btn ghost" onClick={() => { setReplying(null); setDraft(''); }}>Cancel</button>
              <button type="submit" className="btn" disabled={sending || !draft.trim()}>{sending ? 'Sending…' : 'Reply'}</button>
            </div>
          </form>
        ) : notNow === r.id ? (
          <form className="fb-reply-form stack" onSubmit={(e) => { e.preventDefault(); void move(r.id, 'not_now', reason.trim()); }}>
            <label className="f"><span>Why not now?</span>
              <input value={reason} maxLength={280} autoFocus placeholder="e.g. Not for the pilot, maybe later"
                onChange={(e) => setReason(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') { setNotNow(null); setReason(''); } }} />
            </label>
            <div className="row" style={{ justifyContent: 'flex-end', gap: 'var(--space-sm)' }}>
              <button type="button" className="btn ghost" onClick={() => { setNotNow(null); setReason(''); }}>Cancel</button>
              <button type="submit" className="btn" disabled={moving === r.id || reason.trim().length < 2}>Mark not now</button>
            </div>
          </form>
        ) : (
          <div className="fb-actions">
            <button type="button" className="linkbtn" onClick={() => { setReplying(r.id); setDraft(''); setNotNow(null); }}>Reply</button>
            {isOpen ? (<>
              <button type="button" className="mini-btn fb-done" disabled={moving === r.id} onClick={() => void move(r.id, 'done')}>✓ Done</button>
              <button type="button" className="mini-btn" disabled={moving === r.id} onClick={() => { setNotNow(r.id); setReason(''); setReplying(null); }}>Not now</button>
            </>) : <button type="button" className="mini-btn" disabled={moving === r.id} onClick={() => void move(r.id, 'open')}>Reopen</button>}
          </div>
        ))}
      </li>
    );
  };
  return (
    <>
      <span className="seg fb-switch" role="group" aria-label="Show">
        <button type="button" aria-pressed={!resolved} onClick={() => setShow('')}>Open <span className="count-badge">{open.length}</span></button>
        <button type="button" aria-pressed={resolved} onClick={() => setShow('resolved')}>Resolved <span className="count-badge">{closed.length}</span></button>
      </span>
      {resolved
        ? (closed.length > 0 ? <ul className="fb-list">{closed.map(item)}</ul> : <p className="small dim">Nothing resolved yet.</p>)
        : (open.length > 0 ? <ul className="fb-list">{open.map(item)}</ul>
          : <p className="small dim">Nothing open. Every note is resolved. <button type="button" className="linkbtn" onClick={() => setShow('resolved')}>See resolved</button></p>)}
    </>
  );
}
