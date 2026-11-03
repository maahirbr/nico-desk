'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { viewKey } from '@/lib/remember';
import { useReadOnly } from './readonly';

// A proper first day (the PM's call, 2 Nov): for someone in their first 7 days, Home opens with a welcome. It says where
// they stand (their projects, the tasks waiting for them) and offers three small steps that tick themselves: read the
// Guide, add a photo, nickname or phone number (opening the profile ticks it; none is required), open a task. All three done, it says so and goes. ✕ closes it for good. No tour.
// What was done is kept per person in this browser (localStorage, always in try/catch); the profile step comes from the server.
export type Welcome = { firstName: string; projects: string[]; waiting: number; late: number; dueToday: number; profileDone: boolean; firstTaskId: string | null };

const KEYS = { closed: 'welcome-closed', guide: 'guide-read', task: 'first-task-opened', profile: 'profile-seen' } as const;
const read = (k: string) => { try { return localStorage.getItem(k) !== null; } catch { return false; } };
const write = (k: string) => { try { localStorage.setItem(k, '1'); } catch { /* storage blocked */ } };

// Called by the Guide page and by opening a task, so the steps tick.
export function markWelcomeStep(meId: string, step: 'guide' | 'task' | 'profile') { write(viewKey(meId, KEYS[step])); }

export function WelcomeCard({ w, meId, onOpenTask }: { w: Welcome; meId: string; onOpenTask: (id: string) => void }) {
  const readOnly = useReadOnly();
  const [ready, setReady] = useState(false);
  const [closed, setClosed] = useState(true);
  const [guide, setGuide] = useState(false);
  const [seenProfile, setSeenProfile] = useState(false);
  const [task, setTask] = useState(false);
  useEffect(() => {
    setClosed(read(viewKey(meId, KEYS.closed)));
    setGuide(read(viewKey(meId, KEYS.guide)));
    setSeenProfile(read(viewKey(meId, KEYS.profile)));
    setTask(read(viewKey(meId, KEYS.task)));
    setReady(true);
  }, [meId]);
  if (!ready || closed || readOnly) return null;
  const close = () => { write(viewKey(meId, KEYS.closed)); setClosed(true); };
  // The profile step ticks once they open their profile (4 Nov): a photo, nickname or phone is welcome, never required.
  const profileDone = w.profileDone || seenProfile;
  const allDone = guide && profileDone && task;
  const list = (xs: string[]) => (xs.length < 3 ? xs.join(' and ') : `${xs.slice(0, 2).join(', ')} and ${xs.length - 2} more`);
  return (
    <section className="card card-pad welcome" aria-label="Welcome">
      <div className="welcome-head">
        <h2>{allDone ? 'You’re all set 🎉' : `Welcome to NicoDesk, ${w.firstName}! 👋`}</h2>
        <button type="button" className="welcome-x" aria-label="Close the welcome" onClick={close}>✕</button>
      </div>
      {allDone ? <p className="small dim welcome-lede">That’s the basics. This card won’t show again.</p> : (<>
        <ul className="welcome-facts">
          <li>{w.projects.length ? <>You’re on {w.projects.length === 1 ? 'one project' : `${w.projects.length} projects`}: {list(w.projects)}.</> : 'You’re not on a project yet.'}</li>
          <li>{w.waiting ? <>{w.waiting === 1 ? 'One task is' : `${w.waiting} tasks are`} waiting for you{[w.late ? `${w.late} late` : '', w.dueToday ? `${w.dueToday} due today` : ''].filter(Boolean).map((x) => `, ${x}`).join('')}.</> : 'No tasks yet. When someone gives you one, it shows up right here.'}</li>
        </ul>
        <p className="small dim welcome-lede">Three quick things to get started:</p>
        <ol className="welcome-steps">
          <li className={guide ? 'done' : ''}><span className="welcome-tick" aria-hidden>{guide ? '✓' : ''}</span>
            <Link href="/guide">Read the quick guide</Link> <span className="dim small">(1 minute)</span></li>
          <li className={profileDone ? 'done' : ''}><span className="welcome-tick" aria-hidden>{profileDone ? '✓' : ''}</span>
            <Link href="/me/profile" onClick={() => markWelcomeStep(meId, 'profile')}>Add a photo, nickname or phone number</Link></li>
          <li className={task ? 'done' : ''}><span className="welcome-tick" aria-hidden>{task ? '✓' : ''}</span>
            {w.firstTaskId
              ? <button type="button" className="linkbtn" onClick={() => { markWelcomeStep(meId, 'task'); setTask(true); onOpenTask(w.firstTaskId!); }}>Open your first task</button>
              : <Link href="/tasks/new" onClick={() => { markWelcomeStep(meId, 'task'); }}>Add your first task</Link>}</li>
        </ol>
      </>)}
    </section>
  );
}
