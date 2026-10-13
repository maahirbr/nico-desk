'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import '../app/guide.css';
import { viewKey } from '@/lib/remember';
import { useReadOnly } from './readonly';
import { useViewer } from './viewer';

// One line at the top of Home for a person's first visits. Dismissing it, or opening the guide from it, is kept
// per person in this browser (localStorage, always in try/catch). It stays hidden until the browser has been asked,
// so a person who dismissed it never sees it flash. With storage blocked it simply does not show.
export function GuideNote() {
  const { meId } = useViewer();
  const readOnly = useReadOnly();
  const key = viewKey(meId, 'guide-note');
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (readOnly) return; // an admin looking in as someone else leaves nothing kept
    try { setShow(localStorage.getItem(key) === null); } catch { /* storage blocked: no note */ }
  }, [key, readOnly]);

  const dismiss = () => {
    setShow(false);
    try { localStorage.setItem(key, '1'); } catch { /* storage blocked: the note is already hidden */ }
  };

  if (!show) return null;
  return (
    <p className="guide-note">
      <span>New here? <Link href="/guide" onClick={dismiss}>Read the two-minute guide.</Link></span>
      <button type="button" className="guide-note-x" aria-label="Dismiss the guide note" onClick={dismiss}>
        <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M3 3l6 6M9 3l-6 6" /></svg>
      </button>
    </p>
  );
}
