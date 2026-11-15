'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { countdown } from '@/lib/planUtil';
import { fmtDate } from '@/lib/time';
import { DateField } from './DateField';
import { useReadOnly } from './readonly';
import { Modal } from './task-ui';
import { notify } from './toast';

// The top of my Personal page (13 Nov): the title stays "Personal" (as Home shows it), my own description under it,
// and Settings, where I change that description (emoji welcome) and the page's accent colour.
export type Accent = 'orange' | 'sage' | 'indigo';
export const ACCENTS: { key: Accent; label: string }[] = [
  { key: 'orange', label: 'Rust' }, { key: 'sage', label: 'Sage' }, { key: 'indigo', label: 'Indigo' },
];

// goal (15 Nov): my own date with my own label ("FY27 review"), shown under the title as a countdown.
export function PersonalHeader({ description, accent, notesFirst, goalLabel = null, goalOn = null, today }: {
  description: string | null; accent: Accent | null; notesFirst: boolean; goalLabel?: string | null; goalOn?: string | null; today: string;
}) {
  const readOnly = useReadOnly();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [d, setD] = useState(description ?? '');
  const [a, setA] = useState<Accent>(accent ?? 'orange');
  const [top, setTop] = useState<'tasks' | 'notes'>(notesFirst ? 'notes' : 'tasks');
  const [gl, setGl] = useState(goalLabel ?? '');
  const [go, setGo] = useState(goalOn ?? '');
  const [busy, setBusy] = useState(false);
  const cd = goalOn ? countdown(today, goalOn) : null;
  const left = cd ? `${cd.months ? `${cd.months} mo ` : ''}${cd.days} d ${cd.past ? 'ago' : 'to go'}` : '';
  const save = async () => {
    setBusy(true);
    try {
      const r = await fetch('/api/v1/me/personal', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ description: d.trim() || null, accent: a, notesFirst: top === 'notes', goalLabel: go ? (gl.trim() || 'My goal') : null, goalOn: go || null }) });
      if (!r.ok) throw new Error((await r.json().catch(() => null))?.error?.message ?? 'Could not save. Try again.');
      setOpen(false); router.refresh();
    } catch (e) { notify((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <header className="page-head">
      <div>
        <h1>Personal 🔒</h1>
        <p className="summary">{description || 'Only you can see this. Not your team, not admins.'}</p>
        {description && <p className="small dim">Only you can see this.</p>}
        {goalOn && <p className={`personal-goal${cd?.past ? ' past' : ''}`}><span aria-hidden>🎯</span> <b>{goalLabel || 'My goal'}</b> · {fmtDate(goalOn)} · <span className={cd?.past ? 'late-text' : 'dim'}>{left}</span></p>}
      </div>
      {!readOnly && <button type="button" className="btn ghost" onClick={() => { setD(description ?? ''); setA(accent ?? 'orange'); setTop(notesFirst ? 'notes' : 'tasks'); setGl(goalLabel ?? ''); setGo(goalOn ?? ''); setOpen(true); }}>Settings</button>}
      {open && (
        <Modal title="Personal settings" onClose={() => setOpen(false)}>
          <div className="stack">
            <label className="f"><span>Description</span>
              <input maxLength={200} value={d} onChange={(e) => setD(e.target.value)} />
            </label>
            <div className="f"><span>Date</span>
              <div className="row personal-goal-pick">
                <input maxLength={40} value={gl} placeholder="A goal or something else? e.g. Accomplishments" aria-label="What the date is for" onChange={(e) => setGl(e.target.value)} />
                <DateField noQuick value={go} onChange={(e) => setGo(e.target.value)} aria-label="The date" />
                {go && <button type="button" className="linkbtn" onClick={() => { setGo(''); setGl(''); }}>Clear</button>}
              </div>
              <p className="small dim" style={{ margin: 0 }}>It shows at the top of this page, with a countdown.</p>
            </div>
            <fieldset className="f accent-pick"><legend>Accent colour</legend>
              {ACCENTS.map((x) => (
                <label key={x.key} className={`accent-swatch accent-${x.key}${a === x.key ? ' on' : ''}`}>
                  {/* The colour circle is the choice itself: the radio stays for keyboards and screen readers, unseen. */}
                  <input type="radio" name="accent" className="sr-radio" checked={a === x.key} onChange={() => setA(x.key)} />
                  <span className="accent-dot" aria-hidden />{x.label}
                </label>
              ))}
            </fieldset>
            <fieldset className="f accent-pick"><legend>Show on top</legend>
              <label className="accent-swatch"><input type="radio" name="top" checked={top === 'tasks'} onChange={() => setTop('tasks')} />Tasks</label>
              <label className="accent-swatch"><input type="radio" name="top" checked={top === 'notes'} onChange={() => setTop('notes')} />Notes</label>
            </fieldset>
            <div className="row" style={{ justifyContent: 'flex-end', gap: 'var(--space-sm)' }}>
              <button type="button" className="btn ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button type="button" className="btn" disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </Modal>
      )}
    </header>
  );
}
