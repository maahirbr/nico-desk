'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ago, seenCookieName, type UpdateItem } from '@/lib/updates';

// "Updates for you": changes other people made to your tasks, tasks blocked on you, or your project's
// tasks. Renders nothing when there is nothing new. "Mark all seen" keeps a cut-off in a cookie, so it
// is per device. A click opens the task in the page's own drawer.

const SHOWN = 8;

export function UpdatesCard({ items, meId, now, onOpen }: { items: UpdateItem[]; meId: string; now: string; onOpen: (taskId: string) => void }) {
  const router = useRouter();
  const [all, setAll] = useState(false);
  if (items.length === 0) return null;
  const list = all ? items : items.slice(0, SHOWN);
  const markSeen = () => {
    // The newest item's own time, so one that lands a moment later still counts as new.
    document.cookie = `${seenCookieName(meId)}=${items[0].at}; path=/; max-age=31536000; SameSite=Lax`;
    router.refresh();
  };
  return (
    <section className="callout updates" aria-label="Updates for you">
      <div className="callout-head">
        <h2>Updates for you <span className="count-badge">{items.length}</span></h2>
        <button className="mini-btn" onClick={markSeen}>Mark all seen</button>
      </div>
      {list.map((i) => (
        <button key={i.id} className="callout-row" onClick={() => onOpen(i.taskId)}>
          {i.text}
          <span className="dim"> · {ago(i.at, now)}</span>
        </button>
      ))}
      {items.length > SHOWN && (
        <button className="mini-btn" onClick={() => setAll(!all)}>{all ? 'Show fewer' : `Show all ${items.length}`}</button>
      )}
    </section>
  );
}
