'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ago, seenCookieName, type UpdateGroup, type UpdateItem } from '@/lib/updates';

// "Updates for you": changes other people made to your tasks, tasks blocked on you, or your project's
// tasks. Grouped by project, one line per task: its current title, then who did what. Small renames stay
// out. Renders nothing when there is nothing new. "Mark all seen" keeps a cut-off in a cookie, so it is
// per device. A click opens the task in the page's own drawer.

const SHOWN = 6;

export function UpdatesCard({ items, groups, meId, now, onOpen }: { items: UpdateItem[]; groups: UpdateGroup[]; meId: string; now: string; onOpen: (taskId: string) => void }) {
  const router = useRouter();
  const [all, setAll] = useState(false);
  const total = groups.reduce((n, g) => n + g.rows.length, 0);
  if (total === 0) return null;
  const markSeen = () => {
    // The newest item's own time, so one that lands a moment later still counts as new.
    document.cookie = `${seenCookieName(meId)}=${items[0].at}; path=/; max-age=31536000; SameSite=Lax`;
    router.refresh();
  };
  // Cap the lines, not the projects: keep whole groups until the cap, then cut inside the last one.
  let left = all ? Infinity : SHOWN;
  const shown = groups.map((g) => { const rows = g.rows.slice(0, Math.max(0, left)); left -= rows.length; return { ...g, rows }; }).filter((g) => g.rows.length);
  return (
    <section className="callout updates" aria-label="Updates for you">
      <div className="callout-head">
        <h2>Updates for you <span className="count-badge">{total}</span></h2>
        <button className="mini-btn" onClick={markSeen}>Mark all seen</button>
      </div>
      {shown.map((g) => (
        <div key={g.projectId ?? 'none'} className="upd-group">
          <h3 className="upd-project">{g.name}</h3>
          {g.rows.map((r) => (
            <button key={r.taskId} className={`callout-row upd-row${r.closed ? ' is-closed' : ''}`} onClick={() => onOpen(r.taskId)}>
              <span className="upd-mark" aria-hidden>{r.closed ? '✓' : '●'}</span>
              <span className="upd-body">
                <span className="upd-title">{r.title}</span>
                <span className="upd-meta">{r.ownerName ? `${r.ownerName}’s task · ` : ''}{r.summary} · {ago(r.at, now)}</span>
              </span>
              {r.due && <span className={`upd-due due-${r.due.tone}`}>{r.due.label}</span>}
            </button>
          ))}
        </div>
      ))}
      {total > SHOWN && (
        <button className="mini-btn" onClick={() => setAll(!all)}>{all ? 'Show fewer' : `Show ${total - SHOWN} more`}</button>
      )}
    </section>
  );
}
