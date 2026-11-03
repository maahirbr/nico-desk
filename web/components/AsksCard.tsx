'use client';

import { ago } from '@/lib/updates';
import { Help } from './HelpMode';
import { TaskLink } from './TaskLink';

// "Update asked" on Home: someone asked for an update on one of my tasks (lib/asks.ts). Reply opens the task, where the
// ask shows with a box for the update and the status buttons above it. Adding an update or changing the task answers it,
// and the line goes. In-app only, nothing is sent anywhere.
export type HomeAsk = { id: string; taskId: string; title: string; askerName: string; question: string | null; askedAt: string; project: string | null };

export function AsksCard({ items, now, onOpen }: { items: HomeAsk[]; now: string; onOpen: (taskId: string) => void }) {
  if (items.length === 0) return null;
  return (
    <section className="callout" aria-label="Update asked">
      <h2><Help term="update_asked">Update asked</Help> <span className="count-badge">{items.length}</span></h2>
      {items.map((i) => (
        <div key={i.id} className="wait-item">
          <div className="callout-row wait-row">
            <span className="wait-body">
              <span className="wait-title">
                <b>{i.askerName}</b>{' · '}
                <TaskLink id={i.taskId} className="callout-link" onOpen={() => onOpen(i.taskId)}>{i.title}</TaskLink>
              </span>
              <span className="upd-meta">
                {i.question ? <>“{i.question}” · </> : 'Asked for an update · '}{ago(i.askedAt, now)}{i.project && <> · {i.project}</>}
              </span>
            </span>
            <button className="mini-btn" onClick={() => onOpen(i.taskId)}>Reply</button>
          </div>
        </div>
      ))}
    </section>
  );
}
