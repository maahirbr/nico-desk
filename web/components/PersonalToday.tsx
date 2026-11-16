'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Task } from '@/lib/derive';
import { fmtDate, NO_DATE } from '@/lib/time';
import { TODAY_NOTES, usePersonalOpen } from './PersonalDrawer';
import { useReadOnly } from './readonly';
import { TaskRow } from './task-ui';
import { notify } from './toast';

// Today's 3 (16 Nov), at the top of my Personal page: up to three of my own open tasks, from any project, that I pick
// to focus on today. Only I see them (lib/focus.ts). A pick is the task's own row, so ticking or changing it follows the
// task's usual rules; ✕ only takes it off today's list. The next day starts empty, with "Bring back" for what is left.
// Home and every team page stay as they are.
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MAX = 3;

export function PersonalToday({ picks, carry, options, today, meId, meName, personalId, projectNames }: {
  picks: Task[]; carry: string[]; options: Task[]; today: string; meId: string; meName: string; personalId: string;
  projectNames: Record<string, string>;
}) {
  const router = useRouter();
  const readOnly = useReadOnly();
  const open = usePersonalOpen();
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const ids = picks.map((t) => t.id);
  const choices = options.filter((t) => !ids.includes(t.id));
  const done = picks.filter((t) => t.statusCategory === 'done').length;
  const where = (t: Task) => (t.projectId === personalId ? 'Personal 🔒' : t.projectId ? projectNames[t.projectId] ?? '' : '');
  const when = (t: Task) => (t.dueOn === NO_DATE ? 'No date' : t.dueOn < today ? `Late, due ${fmtDate(t.dueOn)}` : t.dueOn === today ? 'Due today' : `Due ${fmtDate(t.dueOn)}`);
  const save = async (next: string[]) => {
    setBusy(true);
    try {
      const r = await fetch('/api/v1/me/focus', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ids: next }) });
      if (!r.ok) throw new Error((await r.json().catch(() => null))?.error?.message ?? 'Could not save your picks. Try again.');
      setPicking(false); router.refresh();
    } catch (e) { notify((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <section className="ptoday" aria-labelledby="ptoday-h">
      <div className="psec-head">
        <h2 id="ptoday-h">Today <span className="ptoday-date">{WEEKDAYS[new Date(`${today}T00:00:00Z`).getUTCDay()]}, {fmtDate(today)}</span></h2>
        {!readOnly && <button type="button" className="btn ghost" onClick={() => window.dispatchEvent(new Event(TODAY_NOTES))}>Today’s notes</button>}
      </div>
      {picks.length === 0 && <p className="small dim ptoday-hint">Pick up to {MAX} of your tasks to focus on today, from any project. Only you see them.</p>}
      {picks.length > 0 && (
        <div className="tlist">
          {picks.map((t) => (
            <div key={t.id} className="ptoday-item">
              <TaskRow t={t} today={today} names={{ [meId]: meName }} sub={where(t)} canTick={!readOnly} canBlock={!readOnly}
                onOpen={() => open(t.id)} onStatus={(s) => open(t.id, s)} />
              {!readOnly && <button type="button" className="row-btn" title="Take off today’s list" aria-label={`Take “${t.title}” off today’s list`}
                disabled={busy} onClick={() => void save(ids.filter((x) => x !== t.id))}>✕</button>}
            </div>
          ))}
        </div>
      )}
      {done > 0 && done === picks.length && (
        <p className="ptoday-clear" role="status">{done === 1 ? 'Today’s pick is done.' : `All ${done} of today’s picks are done.`} Pick another, or call it a day.</p>
      )}
      {!readOnly && picks.length < MAX && (picking ? (
        <div className="ptoday-pick" onKeyDown={(e) => { if (e.key === 'Escape') setPicking(false); }}>
          {choices.length === 0 ? <p className="small dim">No open tasks of yours to pick.</p> : (
            <ul aria-label="Your open tasks">
              {choices.map((t, i) => (
                <li key={t.id}>
                  <button type="button" autoFocus={i === 0} disabled={busy} onClick={() => void save([...ids, t.id])}>
                    <span className="ptoday-pick-title">{t.title}</span>
                    <span className={`ptoday-pick-meta${t.dueOn < today ? ' late-text' : ''}`}>{[where(t), when(t)].filter(Boolean).join(' · ')}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="linkbtn" onClick={() => setPicking(false)}>Close</button>
        </div>
      ) : (
        <div className="row ptoday-acts">
          <button type="button" className="mini-btn" onClick={() => setPicking(true)}>+ Pick a task</button>
          {picks.length === 0 && carry.length > 0 && (
            <button type="button" className="mini-btn" disabled={busy} onClick={() => void save(carry)}>Bring back {carry.length} from last time</button>
          )}
        </div>
      ))}
    </section>
  );
}
