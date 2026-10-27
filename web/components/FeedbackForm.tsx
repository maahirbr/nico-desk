'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Help } from './HelpMode';
import { isRealEnter } from './ime';
import { Count } from './LimitNotice';
import { Select } from './Select';
import { useReadOnly } from './readonly';
import { api } from './task-ui';
import { notify } from './toast';
import { shrinkImage } from './shrinkImage';

// The writing box at the top of the Feedback tab, for everyone signed in. One thought per note, so teammates can back it
// with "+1". Up to three screenshots: pasted into the box, dropped on the card, or picked with "Add screenshot". They
// are shrunk in the browser and uploaded after the note is saved. Nothing is emailed. The page it is about is a pick
// from the main screens (optional), so it records no query string.
export const FEEDBACK_LIMIT = 4000;
const MAX_SHOTS = 3;

export const PAGES: [string, string][] = [
  ['', 'Not about one page'], ['/me', 'Home'], ['/team', 'Team'], ['/projects', 'Projects'], ['/tasks/new', 'New Task'],
  ['/ledger', 'Ledger'], ['/reminders', 'Reminders'], ['/admin', 'Roster'], ['/guide', 'Guide'],
];

export function FeedbackForm() {
  const router = useRouter();
  const readOnly = useReadOnly();
  const [text, setText] = useState('');
  const [page, setPage] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [shots, setShots] = useState<{ blob: Blob; url: string }[]>([]);
  const [drag, setDrag] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const ok = text.trim().length > 0 && !busy && !readOnly;
  useEffect(() => () => shots.forEach((x) => URL.revokeObjectURL(x.url)), []); // eslint-disable-line react-hooks/exhaustive-deps

  async function addShots(files: Blob[]) {
    setErr(null);
    for (const f of files.filter((x) => x.type.startsWith('image/'))) {
      if (shots.length >= MAX_SHOTS) { setErr(`A note holds ${MAX_SHOTS} pictures.`); break; }
      try {
        const blob = await shrinkImage(f);
        setShots((all) => (all.length >= MAX_SHOTS ? all : [...all, { blob, url: URL.createObjectURL(blob) }]));
      } catch (e) { setErr((e as Error).message); }
    }
  }
  const drop = (i: number) => setShots((all) => { URL.revokeObjectURL(all[i].url); return all.filter((_, j) => j !== i); });

  async function send() {
    if (!ok) return;
    setBusy(true); setErr(null);
    try {
      const { id } = await api('/feedback', 'POST', { body: text.trim(), path: page || null });
      let failed = 0;
      for (const x of shots) {
        const r = await fetch(`/api/v1/feedback/${id}/images`, { method: 'POST', headers: { 'content-type': x.blob.type }, body: x.blob }).catch(() => null);
        if (!r?.ok) failed++;
      }
      notify(failed ? `Sent, but ${failed} picture${failed === 1 ? '' : 's'} did not upload.` : 'Sent. Thank you, the team can read it now.');
      shots.forEach((x) => URL.revokeObjectURL(x.url));
      setText(''); setPage(''); setShots([]);
      router.refresh();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  if (readOnly) return <p className="lede">Feedback is written by each person for themselves, so it is off in View as.</p>;
  return (
    <form className={`card card-pad stack${drag ? ' fb-drag' : ''}`} onSubmit={(e) => { e.preventDefault(); void send(); }}
      onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDrag(true); } }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); void addShots(Array.from(e.dataTransfer.files)); }}>
      <label className="f">
        <span>Your Experience</span>
        <textarea rows={5} maxLength={FEEDBACK_LIMIT} value={text} aria-required="true" placeholder="What is working well? What is confusing, missing or wrong?"
          onChange={(e) => setText(e.target.value)}
          onPaste={(e) => {
            const imgs = Array.from(e.clipboardData.items).filter((i) => i.kind === 'file' && i.type.startsWith('image/')).map((i) => i.getAsFile()).filter((f): f is File => !!f);
            if (imgs.length) { e.preventDefault(); void addShots(imgs); }
          }}
          onKeyDown={(e) => { if (isRealEnter(e) && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void send(); } }} />
        <Count value={text} max={FEEDBACK_LIMIT} />
      </label>
      <p className="hint" style={{ margin: 0 }}>One thought per note, so others can +1 it.</p>
      <div className="fb-shots">
        {shots.map((x, i) => (
          <span key={x.url} className="fb-shot">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={x.url} alt={`Screenshot ${i + 1}`} />
            <button type="button" className="fb-shot-x" aria-label={`Remove screenshot ${i + 1}`} onClick={() => drop(i)}>×</button>
          </span>
        ))}
        {shots.length < MAX_SHOTS && (
          <button type="button" className="btn ghost" onClick={() => file.current?.click()}>+ Add screenshot</button>
        )}
        <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden
          onChange={(e) => { void addShots(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
        <span className="hint">or paste one into the box</span>
      </div>
      <label className="f">
        <span><Help term="feedback_page">Page (optional)</Help></span>
        <Select value={page} onChange={setPage}>{PAGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
      </label>
      {err && <p className="err" role="alert">{err}</p>}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button type="submit" className="btn" disabled={!ok}>{busy ? 'Sending…' : 'Send'}</button>
      </div>
    </form>
  );
}
