'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useReadOnly } from './readonly';

// "Feedback updates" on Home: replies, Done, Not now and Reopen on notes this person wrote or gave +1, never their own
// doing. Opening Feedback, or Mark seen, clears them. In-app only, nothing is sent anywhere. Under View as it shows but
// cannot be changed.
export type HomeReply = { id: string; kind: 'reply' | 'done' | 'not_now' | 'reopened'; authorName: string; snippet: string | null; note: string };

export function FeedbackRepliesCard({ items }: { items: HomeReply[] }) {
  const readOnly = useReadOnly();
  const [gone, setGone] = useState(false);
  if (gone || items.length === 0) return null;
  const seen = () => fetch('/api/v1/me/feedback-replies/seen', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  const what = (i: HomeReply) => {
    const note = <Link className="rlink" href="/feedback">&ldquo;{i.note}&rdquo;</Link>;
    if (i.kind === 'reply') return <>replied to {note}: {i.snippet}</>;
    if (i.kind === 'done') return <>marked {note} done</>;
    if (i.kind === 'not_now') return <>marked {note} not now: {i.snippet}</>;
    return <>reopened {note}</>;
  };
  return (
    <section className="callout" aria-label="Feedback updates">
      <div className="callout-head">
        <h2>Feedback updates <span className="count-badge">{items.length}</span></h2>
        {!readOnly && <button className="mini-btn" onClick={async () => { setGone(true); const r = await seen().catch(() => null); if (!r?.ok) setGone(false); }}>Mark seen</button>}
      </div>
      {items.map((i) => (
        <div key={i.id} className="callout-row moved-row">
          <span className="moved-text"><b>{i.authorName}</b> {what(i)}</span>
        </div>
      ))}
    </section>
  );
}
