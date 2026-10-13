'use client';

import { useEffect } from 'react';
import { cutBy } from './ime';
import { notify } from './toast';

// A box with a maxLength drops the rest of a long paste or a long dictation without a word.
// This listener sees the text before the browser cuts it and says so, once, for every field in the app.
export function LimitNotice() {
  useEffect(() => {
    let last = 0;
    const onBefore = (ev: Event) => {
      const e = ev as InputEvent;
      const t = e.target;
      if (!(t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement)) return;
      if (t.maxLength < 0 || e.inputType === 'insertCompositionText') return; // no limit, or still composing
      const text = e.data ?? e.dataTransfer?.getData('text/plain') ?? '';
      if (!text) return;
      const cut = cutBy(t.value, t.selectionStart ?? t.value.length, t.selectionEnd ?? t.value.length, text, t.maxLength);
      if (cut > 0 && Date.now() - last > 1500) {
        last = Date.now();
        notify(`This box holds ${t.maxLength} characters. The last ${cut} were left out.`);
      }
    };
    document.addEventListener('beforeinput', onBefore, true);
    return () => document.removeEventListener('beforeinput', onBefore, true);
  }, []);
  return null;
}

// "12 left" under a long box once it is close to the limit, so a long dictation never runs out unseen.
export function Count({ value, max }: { value: string; max: number }) {
  const left = max - value.length;
  if (left > max * 0.3) return null;
  return <span className="dim small" role="status" aria-live="polite">{left} left</span>;
}
