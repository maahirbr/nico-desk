'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Help } from './HelpMode';
import { isRealEnter } from './ime';
import { Count } from './LimitNotice';
import { Select } from './Select';
import { useReadOnly } from './readonly';
import { api } from './task-ui';
import { notify } from './toast';

// The writing box at the top of the Feedback tab, for everyone signed in. The note goes to the admins inside the app.
// Nothing is emailed. The page it is about is a pick from the main screens (optional), so it records no query string.
export const FEEDBACK_LIMIT = 4000;

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
  const ok = text.trim().length > 0 && !busy && !readOnly;

  async function send() {
    if (!ok) return;
    setBusy(true); setErr(null);
    try {
      await api('/feedback', 'POST', { body: text.trim(), path: page || null });
      notify('Sent. Thank you, the admins can read it now.');
      setText(''); setPage('');
      router.refresh();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  if (readOnly) return <p className="lede">Feedback is written by each person for themselves, so it is off in View as.</p>;
  return (
    <form className="card card-pad stack" onSubmit={(e) => { e.preventDefault(); void send(); }}>
      <label className="f">
        <span>What is confusing, missing or wrong?</span>
        <textarea rows={5} maxLength={FEEDBACK_LIMIT} value={text} aria-required="true" placeholder="Tell us in your own words"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (isRealEnter(e) && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void send(); } }} />
        <Count value={text} max={FEEDBACK_LIMIT} />
      </label>
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
