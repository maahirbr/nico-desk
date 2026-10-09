'use client';

import { useEffect, useState } from 'react';

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
