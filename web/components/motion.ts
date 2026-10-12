'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MotionProps } from 'motion/react';
import { COUNT_MS, countUpValue, isFirst } from '@/lib/motionMath';

// The three gestures in DESIGN.md Motion need a little state: a line that just arrived, a date
// that just moved, a state that was just set. The movement itself is CSS (globals.css, .arrive,
// .date-old, .date-new, .state-set), on transform and opacity only.

export const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

// Shared presets for the `motion` package (Select, date picker). Each returns props to spread on a
// `motion.*` element. Under reduced motion they return no animation at all. Nothing runs over 0.3s.
const OFF = { initial: false as const, transition: { duration: 0 } };

// A bottom sheet or drawer rising from the edge.
export function sheetMotion() {
  if (reduced()) return { ...OFF, exit: { opacity: 0, transition: { duration: 0 } } };
  return {
    initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%', transition: { duration: 0.16 } },
    transition: { type: 'spring' as const, visualDuration: 0.24, bounce: 0 },
  };
}

// The scrim behind a bottom sheet.
export function scrimMotion() {
  if (reduced()) return { ...OFF, exit: { opacity: 0, transition: { duration: 0 } } };
  return { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0, transition: { duration: 0.16 } }, transition: { duration: 0.16 } };
}

// A pop-up scaling out of the point it was opened from (`origin` is a CSS transform-origin).
export function popoverMotion(origin: string) {
  if (reduced()) return { ...OFF, style: { transformOrigin: origin }, exit: { opacity: 0, transition: { duration: 0 } } };
  return {
    initial: { opacity: 0, scale: 0.96 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.96, transition: { duration: 0.1 } },
    transition: { duration: 0.14, ease: [0.2, 0, 0, 1] as [number, number, number, number] }, style: { transformOrigin: origin },
  };
}

// Content that fades in with a small shift. `index` staggers a row of them on first load (0.03s steps).
export function fadeShift(index = 0) {
  if (reduced()) return OFF;
  return {
    initial: { opacity: 0, y: 4 }, animate: { opacity: 1, y: 0 },
    transition: { duration: 0.16, delay: Math.min(index, 6) * 0.03, ease: [0.2, 0, 0, 1] as [number, number, number, number] },
  };
}

// Ref callback for a field that should take focus on open. Only where there is a hover pointer and
// a real keyboard: a phone keeps the keyboard closed until the person taps a field.
export function focusOnDesktop(el: HTMLElement | null) {
  if (el && typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches) el.focus();
}

// ---------- motion pass (workstream 4) ----------
// Every value below stays under 0.3s, except the first-load stagger, which is CSS (globals.css .stagger).
// Each preset returns nothing that moves under reduced motion.

const EASE_OUT = [0.2, 0, 0, 1] as [number, number, number, number];

// A side drawer springing in from the right. Pass `closing` to send it back out.
// Spread on a `motion.aside`.
export function drawerMotion(closing = false): MotionProps {
  if (reduced()) return { initial: false, animate: { opacity: closing ? 0 : 1 }, transition: { duration: 0 } };
  const out = { duration: 0.16, ease: EASE_OUT };
  const spring = { type: 'spring' as const, visualDuration: 0.28, bounce: 0.12 };
  return { initial: { opacity: 0, x: 32 }, animate: closing ? { opacity: 0, x: 32, transition: out } : { opacity: 1, x: 0 }, transition: spring };
}

// A dialog rising a little and settling with a small spring. Spread on a `motion.div`.
export function modalMotion(closing = false): MotionProps {
  if (reduced()) return { initial: false as const, animate: { opacity: closing ? 0 : 1 }, transition: { duration: 0 } };
  return {
    initial: { opacity: 0, y: 12, scale: 0.98 },
    animate: closing ? { opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.14, ease: EASE_OUT } } : { opacity: 1, y: 0, scale: 1 },
    transition: { type: 'spring' as const, visualDuration: 0.26, bounce: 0.1 },
  };
}

// The marker that slides between the items of a nav or a tab row (a shared layout animation).
export function indicatorMotion(): MotionProps {
  return { transition: reduced() ? { duration: 0 } : { type: 'spring' as const, visualDuration: 0.24, bounce: 0 } };
}

// Keys of lists already shown in this tab. A list staggers in the first time only.
const seenViews = new Set<string>();

// True the first time a list with this key mounts in this browser tab, false after. It reads the set in the
// first render and writes it in an effect, so React may render twice without losing the answer.
export function useFirstView(key: string): boolean {
  const [first] = useState(() => isFirst(seenViews, key));
  useEffect(() => { seenViews.add(key); }, [key]);
  return first && !reduced();
}

// Set once the app has hydrated. A page that is part of the first document load keeps its numbers as the
// server wrote them (counting would flash the final value first), so a count-up only runs on later visits.
let hydrated = false;
export function markHydrated() { setTimeout(() => { hydrated = true; }, 0); }

// Counts a whole number up from 0 once per session per key. The first render, the server render and reduced
// motion all show the true value, so the number is never wrong, only late to arrive.
export function useCountUp(to: number, key: string): number {
  const [first] = useState(() => hydrated && !reduced() && isFirst(seenViews, `count:${key}`));
  const [shown, setShown] = useState(first ? 0 : to);
  const done = useRef(!first);
  useEffect(() => {
    seenViews.add(`count:${key}`);
    if (done.current) { setShown(to); return; }
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const t = (now - t0) / COUNT_MS;
      setShown(countUpValue(to, t));
      if (t < 1) raf = requestAnimationFrame(step); else done.current = true;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, key]);
  return shown;
}
