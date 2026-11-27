'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { FeedbackAsk } from '@/lib/feedbackAsk';
import { useReadOnly } from './readonly';
import { shrinkImage } from './shrinkImage';

// The feedback ask on Home (lib/feedbackAsk.ts). One note, right here, on one row: something to improve or something
// that works, a line of text, an optional screenshot (📎), Send. Sending ticks the card off; then only the count stays,
// which everyone sees (an admin also sees who has not shared, on hover). "Later" hides it for the rest of today in this
// browser only (localStorage, in try/catch).
const LATER = 'feedback-ask-later';
const MAX_SHOTS = 3;

export function FeedbackAskCard({ ask, today, firstName }: { ask: FeedbackAsk; today: string; firstName: string }) {
  const router = useRouter();
  const readOnly = useReadOnly();
  const [later, setLater] = useState(true);
  const [kind, setKind] = useState<'fix' | 'praise'>('fix');
  const [text, setText] = useState('');
  const [shots, setShots] = useState<Blob[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => { try { setLater(localStorage.getItem(LATER) === today); } catch { setLater(false); } }, [today]);
  const count = ask.of != null && (
    <span className="small dim fask-count" title={ask.notYet.length ? `Not yet: ${ask.notYet.join(', ')}` : undefined}>{ask.shared} of {ask.of} have given feedback so far</span>
  );
  if (done) return <section className="card card-pad fask fask-done" role="status"><p>💛 Thank you, {firstName}! That really helps.</p>{count}</section>;
  if (!ask.open || later) return count ? <section className="card fask fask-quiet">{count}<span aria-hidden>🙏</span></section> : null;
  const add = async (files: File[]) => {
    for (const f of files.filter((x) => x.type.startsWith('image/')).slice(0, MAX_SHOTS - shots.length)) {
      try { const b = await shrinkImage(f); setShots((s) => [...s, b].slice(0, MAX_SHOTS)); } catch (e) { setErr((e as Error).message); }
    }
  };
  const send = async () => {
    if (text.trim().length < 3 || busy) return;
    setBusy(true); setErr(null);
    const r = await fetch('/api/v1/feedback', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ body: text.trim(), kind, path: '/me' }) }).catch(() => null);
    if (!r?.ok) { setBusy(false); setErr((await r?.json().catch(() => null))?.error?.message ?? 'Could not send it. Try again.'); return; }
    const { id } = (await r.json()) as { id: string };
    for (const b of shots) await fetch(`/api/v1/feedback/${id}/images`, { method: 'POST', headers: { 'content-type': b.type }, body: b }).catch(() => null);
    setBusy(false); setDone(true); router.refresh();
  };
  return (
    <section className="card card-pad fask" aria-label="Share feedback">
      <h2>{firstName}, how’s NicoDesk working for you? 🙏</h2>
      <p className="fask-lede">Share <b>one thing</b> to improve or one thing that works. It shapes what we build next.</p>
      <div className="fask-row">
        <div className="seg fask-kind" role="group" aria-label="What kind of note">
          <button type="button" aria-pressed={kind === 'fix'} onClick={() => setKind('fix')}>To improve</button>
          <button type="button" aria-pressed={kind === 'praise'} onClick={() => setKind('praise')}>Working well</button>
        </div>
        <input className="fask-text" maxLength={1000} value={text} readOnly={readOnly} placeholder={kind === 'fix' ? 'What’s confusing, missing or wrong?' : 'What do you like?'} aria-label="Your note"
          onChange={(e) => setText(e.target.value)}
          onPaste={(e) => { const imgs = Array.from(e.clipboardData.items).filter((i) => i.kind === 'file' && i.type.startsWith('image/')).map((i) => i.getAsFile()).filter((f): f is File => !!f); if (imgs.length) { e.preventDefault(); void add(imgs); } }} />
        <button type="button" className="fask-clip" title="Add a screenshot" aria-label="Add a screenshot" disabled={shots.length >= MAX_SHOTS} onClick={() => file.current?.click()}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21.4 11.1l-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5" /></svg>
          {shots.length > 0 && <span className="fask-n">{shots.length}</span>}
        </button>
        <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(e) => { void add(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
        <button type="button" className="btn" disabled={busy || text.trim().length < 3} onClick={() => void send()}>{busy ? 'Sending…' : 'Send'}</button>
        <button type="button" className="btn ghost" onClick={() => { try { localStorage.setItem(LATER, today); } catch { /* storage blocked */ } setLater(true); }}>Later</button>
      </div>
      {(err || count) && <p className="fask-foot">{count}{err && <span className="err small" role="alert">{err}</span>}</p>}
    </section>
  );
}
