'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useReadOnly } from './readonly';

// "Replies to your feedback" on Home: new replies to notes this person wrote. Opening Feedback, or Mark seen, clears
// them. In-app only, nothing is sent anywhere. Under View as it shows but cannot be changed.
export type HomeReply = { id: string; authorName: string; snippet: string; note: string };

export function FeedbackRepliesCard({ items }: { items: HomeReply[] }) {
  const readOnly = useReadOnly();
  const [gone, setGone] = useState(false);
  if (gone || items.length === 0) return null;
  const seen = () => fetch('/api/v1/me/feedback-replies/seen', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  return (
    <section className="callout" aria-label="Replies to your feedback">
      <div className="callout-head">
        <h2>Replies to your feedback <span className="count-badge">{items.length}</span></h2>
        {!readOnly && <button className="mini-btn" onClick={async () => { setGone(true); const r = await seen().catch(() => null); if (!r?.ok) setGone(false); }}>Mark seen</button>}
      </div>
      {items.map((i) => (
        <div key={i.id} className="callout-row moved-row">
          <span className="moved-text">
            <b>{i.authorName}</b> replied to <Link className="rlink" href="/feedback">&ldquo;{i.note}&rdquo;</Link>: {i.snippet}
          </span>
        </div>
      ))}
    </section>
  );
}
