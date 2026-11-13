'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useReadOnly } from './readonly';
import { Modal } from './task-ui';
import { notify } from './toast';

// The top of my Personal page (13 Nov): the title stays "Personal 🔒" (as Home shows it), my own description under it,
// and Settings, where I change that description (emoji welcome) and the page's accent colour.
export type Accent = 'orange' | 'sage' | 'indigo';
export const ACCENTS: { key: Accent; label: string }[] = [
  { key: 'orange', label: 'Rust' }, { key: 'sage', label: 'Sage' }, { key: 'indigo', label: 'Indigo' },
];

export function PersonalHeader({ description, accent, notesFirst }: { description: string | null; accent: Accent | null; notesFirst: boolean }) {
  const readOnly = useReadOnly();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [d, setD] = useState(description ?? '');
  const [a, setA] = useState<Accent>(accent ?? 'orange');
  const [top, setTop] = useState<'tasks' | 'notes'>(notesFirst ? 'notes' : 'tasks');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const r = await fetch('/api/v1/me/personal', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ description: d.trim() || null, accent: a, notesFirst: top === 'notes' }) });
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
      </div>
      {!readOnly && <button type="button" className="btn ghost" onClick={() => { setD(description ?? ''); setA(accent ?? 'orange'); setTop(notesFirst ? 'notes' : 'tasks'); setOpen(true); }}>Settings</button>}
      {open && (
        <Modal title="Personal settings" onClose={() => setOpen(false)}>
          <div className="stack">
            <label className="f"><span>Description</span>
              <input maxLength={200} value={d} onChange={(e) => setD(e.target.value)} />
            </label>
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
