'use client';

import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Help } from './HelpMode';
import { isRealEnter } from './ime';
import { Count } from './LimitNotice';
import { Modal, api } from './task-ui';
import { notify } from './toast';

// "Send feedback" in the account menu. The note goes to the admins inside the app. Nothing is emailed.
// The page box is ticked by default and shows the path it will record, so the person sees what is kept.
export const FEEDBACK_LIMIT = 4000;

export function FeedbackDialog({ onClose }: { onClose: () => void }) {
  const path = usePathname() || '/';
  const [text, setText] = useState('');
  const [about, setAbout] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ok = text.trim().length > 0 && !busy;

  async function send() {
    if (!ok) return;
    setBusy(true); setErr(null);
    try {
      await api('/feedback', 'POST', { body: text.trim(), path: about ? path : null });
      notify('Sent. The admins can read it now.');
      onClose();
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  return (
    <Modal title="Send feedback" onClose={onClose}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <label className="f">
          <span>What is confusing, missing or wrong?</span>
          <textarea rows={6} maxLength={FEEDBACK_LIMIT} value={text} autoFocus aria-label="Your feedback" aria-required="true"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (isRealEnter(e) && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void send(); } }} />
          <Count value={text} max={FEEDBACK_LIMIT} />
        </label>
        <Help term="feedback_page" host>
          <label className="fb-about">
            <input type="checkbox" checked={about} onChange={(e) => setAbout(e.target.checked)} />
            <span>This is about this page <span className="mono small dim">{path}</span></span>
          </label>
        </Help>
        {err && <p className="err" role="alert">{err}</p>}
        <div className="row" style={{ justifyContent: 'flex-end', gap: 'var(--space-sm)' }}>
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn" disabled={!ok}>{busy ? 'Sending…' : 'Send'}</button>
        </div>
      </form>
    </Modal>
  );
}
