'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Fragment, useState } from 'react';
import { ago, type UpdateGroup, type UpdateItem } from '@/lib/updates';
import { useReadOnly } from './readonly';

// "Updates for you": changes other people made to your tasks, tasks blocked on you, or your project's
// tasks. Grouped by project, one line per task: its current title, then who did what. Small renames stay
// out. Renders nothing when there is nothing new. "Seen" is saved on the person's account, so it holds on
// every device: "Mark all seen", a project's own "Mark seen", or opening a task clears its line.
// A click opens the task in the page's own drawer.

const SHOWN = 6;

export function UpdatesCard({ items, groups, meId, now, onOpen }: { items: UpdateItem[]; groups: UpdateGroup[]; meId: string; now: string; onOpen: (taskId: string) => void }) {
  const router = useRouter();
  const [all, setAll] = useState(false);
  const readOnly = useReadOnly(); // "seen" is saved on that person's account: not while viewing as them
  const [cleared, setCleared] = useState<Set<string>>(new Set());
  const live = groups.map((g) => ({ ...g, rows: g.rows.filter((r) => !cleared.has(r.taskId)) })).filter((g) => g.rows.length);
  const total = live.reduce((n, g) => n + g.rows.length, 0);
  if (total === 0) return null;
  const seen = (body: { taskIds?: string[]; upTo?: string }, refresh: boolean) => {
    if (readOnly) return;
    const ids = body.taskIds ?? [];
    if (ids.length) setCleared((c) => new Set([...c, ...ids]));
    // If the server refuses or cannot be reached, put the lines back instead of claiming they were seen.
    const undo = () => { if (ids.length) setCleared((c) => { const n = new Set(c); ids.forEach((id) => n.delete(id)); return n; }); };
    fetch('/api/v1/me/updates/seen', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      .then((res) => { if (!res.ok) undo(); else if (refresh) router.refresh(); }).catch(undo);
  };
  // The newest item's own time, so one that lands a moment later still counts as new.
  const markAll = () => seen({ upTo: items[0]?.at }, true);
  // Cap the lines, not the projects: keep whole groups until the cap, then cut inside the last one.
  let left = all ? Infinity : SHOWN;
  const shown = live.map((g) => { const rows = g.rows.slice(0, Math.max(0, left)); left -= rows.length; return { ...g, rows }; }).filter((g) => g.rows.length);
  return (
    <section className="callout updates" aria-label="Updates for you">
      <div className="callout-head">
        <h2>Updates for you <span className="count-badge">{total}</span></h2>
        {!readOnly && <button className="mini-btn" onClick={markAll}>Mark all seen</button>}
      </div>
      {shown.map((g) => (
        <div key={g.projectId ?? 'none'} className="upd-group">
          <div className="upd-project-row">
            <h3 className="upd-project">{g.projectId ? <Link className="rlink" href={`/projects/${g.projectId}`}>{g.name}</Link> : g.name}</h3>
            {!readOnly && live.length > 1 && (
              <button className="linkbtn upd-seen" onClick={() => seen({ taskIds: live.find((x) => x.projectId === g.projectId)!.rows.map((r) => r.taskId) }, false)}>Mark seen</button>
            )}
          </div>
          {g.rows.map((r) => (
            <button key={r.taskId} className={`callout-row upd-row${r.closed ? ' is-closed' : ''}`} onClick={() => { onOpen(r.taskId); seen({ taskIds: [r.taskId] }, false); }}>
              <span className="upd-mark" aria-hidden>{r.closed ? '✓' : '●'}</span>
              <span className="upd-body">
                <span className="upd-title">{r.title}</span>
                <span className="upd-meta">
                  {r.ownerName && <><b>{r.ownerName}</b>’s task · </>}
                  {r.parts.map((p, i) => <Fragment key={i}>{i > 0 && '; '}<b>{p.who}</b> {p.text}</Fragment>)} · {ago(r.at, now)}
                </span>
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
