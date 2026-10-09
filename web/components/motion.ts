'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// The three gestures in DESIGN.md Motion need a little state: a line that just arrived, a date
// that just moved, a state that was just set. The movement itself is CSS (globals.css, .arrive,
// .date-old, .date-new, .state-set), on transform and opacity only.

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Ids of tasks this browser tab just made. The row that shows one of them rises in, once.
export const arrivals = new Set<string>();

// Returns the previous value for `ms` after `value` changes, then undefined. It does nothing on the
// first render, and nothing at all when the person asked for reduced motion.
export function usePreviousWhileChanging<T>(value: T, ms: number): T | undefined {
  const [seen, setSeen] = useState(value);
  const [from, setFrom] = useState<T | undefined>(undefined);
  if (seen !== value) {
    setSeen(value);
    setFrom(reduced() ? undefined : seen);
  }
  useEffect(() => {
    if (from === undefined) return;
    const id = setTimeout(() => setFrom(undefined), ms);
    return () => clearTimeout(id);
  }, [from, ms]);
  return from;
}

// Panels and pop-ups fade and slide out before they unmount. Reads --dur-panel, so it is instant
// when reduced motion zeroes the token.
export function useClosing(onClose: () => void): [boolean, () => void] {
  const [closing, setClosing] = useState(false);
  const started = useRef(false);
  const close = useCallback(() => {
    if (started.current) return;
    started.current = true;
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--dur-panel').trim();
    const n = parseFloat(raw);
    const ms = Number.isNaN(n) ? 0 : raw.endsWith('ms') ? n : n * 1000;
    if (reduced() || ms <= 0) { onClose(); return; }
    setClosing(true);
    setTimeout(onClose, ms);
  }, [onClose]);
  return [closing, close];
}

// Ref callback for a field that should take focus on open. Only where there is a hover pointer and
// a real keyboard: a phone keeps the keyboard closed until the person taps a field.
export function focusOnDesktop(el: HTMLElement | null) {
  if (el && typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches) el.focus();
}
