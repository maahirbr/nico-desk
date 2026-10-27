'use client';

import { useEffect, useState } from 'react';
import type { SetupAction, SetupStep } from '@/lib/setup';
import { Fold } from './Fold';
import { Help } from './HelpMode';
import { IMPORT_EVENT } from './MeetingSection';
import { OPEN_ADD_EVENT, OPEN_SETTINGS_EVENT, SHOW_SETUP_EVENT, setupKey } from './setupEvents';
import { useReadOnly } from './readonly';
import { useViewer } from './viewer';

// The setup check-list at the top of a project page (docs/DESIGN-19-OCT.md section 1). The server works out which
// steps are done (lib/setup.ts), so a step ticks by itself after a write elsewhere on the page: the boards already
// refresh the page. Each button opens UI that already exists, by window event. Hiding the list is kept per person and
// per project in this browser (localStorage, always in try/catch). It stays closed until the browser has been asked,
// so a person who hid it never sees it flash. In View as the list shows with no buttons and no way to hide it.

// The rhythm step has no button yet: its form lives in MeetingSection, which is off project pages until gate G1.
const EVENT_OF: Partial<Record<SetupAction, string>> = { settings: OPEN_SETTINGS_EVENT, add: OPEN_ADD_EVENT, minutes: IMPORT_EVENT };

function dwellMs(): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--dwell-confirm').trim();
  const n = parseFloat(raw);
  return Number.isNaN(n) ? 4000 : raw.endsWith('ms') ? n : n * 1000;
}

export function SetupList({ projectId, steps }: { projectId: string; steps: SetupStep[] }) {
  const { meId } = useViewer();
  const readOnly = useReadOnly();
  const key = setupKey(meId, projectId);
  const [hidden, setHidden] = useState<boolean | null>(readOnly ? false : null); // null: the browser has not been asked yet
  const allDone = steps.every((s) => s.done);
  // 'ready' is the short moment after the last step ticks. A list that is already complete on load never shows.
  const [phase, setPhase] = useState<'list' | 'ready' | 'gone'>(allDone ? 'gone' : 'list');

  useEffect(() => {
    if (readOnly) return;
    try { setHidden(localStorage.getItem(key) !== null); } catch { setHidden(false); /* storage blocked: show it */ }
  }, [key, readOnly]);

  useEffect(() => {
    const again = () => setHidden(false);
    window.addEventListener(SHOW_SETUP_EVENT, again);
    return () => window.removeEventListener(SHOW_SETUP_EVENT, again);
  }, []);

  useEffect(() => {
    if (allDone && phase === 'list') setPhase('ready');
    else if (!allDone && phase === 'ready') setPhase('list');
  }, [allDone, phase]);

  // The dwell has its own effect: its timer must outlive the phase change that starts it.
  useEffect(() => {
    if (phase !== 'ready') return;
    const t = setTimeout(() => setPhase('gone'), dwellMs());
    return () => clearTimeout(t);
  }, [phase]);

  const hide = () => {
    setHidden(true);
    try { localStorage.setItem(key, '1'); } catch { /* storage blocked: hidden until the page is reloaded */ }
  };

  const first = steps.find((s) => !s.done);
  const open = hidden === false && phase !== 'gone';
  const done = steps.filter((s) => s.done).length;
  return (
    // data-primary: while an open step holds the one primary button, the board's own primary turns outline (globals.css).
    <div className="setup" data-primary={open && !readOnly && phase === 'list' && first ? '' : undefined}>
      <Fold open={open} scroll={false}>
        <section className="card setup-card" aria-label="Set up this project">
          <div className="setup-head">
            <h2><Help term="setup_list">{phase === 'ready' ? 'Ready for the first meeting.' : 'Set up this project'}</Help></h2>
            <span className="setup-count" aria-live="polite">{done} of {steps.length} done</span>
          </div>
          <ul className="setup-steps">
            {steps.map((st) => {
              const event = EVENT_OF[st.action];
              return (
                <li key={st.key} className="setup-row" data-done={st.done}>
                  <span className="setup-mark" data-done={st.done} aria-hidden>
                    <svg viewBox="0 0 12 12"><path d="M2.9 6.3l2.2 2.2 4-4.6" pathLength={1} /></svg>
                  </span>
                  <div className="setup-body">
                    <p className="setup-words">{st.title}{st.done && <span className="setup-sr"> (done)</span>}</p>
                    <Fold open={st === first} scroll={false}><p className="setup-hint">{st.hint}</p></Fold>
                  </div>
                  {!st.done && !readOnly && event && (
                    <button type="button" className={st === first ? 'btn' : 'btn ghost'} onClick={() => window.dispatchEvent(new CustomEvent(event, { detail: st.key }))}>{st.button}</button>
                  )}
                </li>
              );
            })}
          </ul>
          {!readOnly && <button type="button" className="act setup-hide" onClick={hide}>Hide this list</button>}
        </section>
      </Fold>
    </div>
  );
}
