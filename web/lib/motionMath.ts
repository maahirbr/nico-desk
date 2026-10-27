// Pure helpers for the motion pass. No React, no DOM, so each rule can be tested on its own.

// The longest any single movement may run, except the first-load stagger (DESIGN.md, Motion).
export const MAX_MS = 300;

// How long a number takes to count up.
export const COUNT_MS = 280;

// Ease-out cubic: fast first, soft landing.
export function easeOut(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - c, 3);
}

// The number to show `t` (0 to 1) of the way through a count from `from` to `to`. Whole numbers only.
// At t = 1 it is exactly `to`, so the page always ends on the true value.
export function countUpValue(to: number, t: number, from = 0): number {
  if (t >= 1) return to;
  return Math.round(from + (to - from) * easeOut(t));
}

// Delay for the nth item of a list that staggers in. The step is small and the count is capped, so
// the whole list has arrived within `step * cap + one item` however long it is.
export function staggerDelay(index: number, step = 30, cap = 8): number {
  return Math.min(Math.max(0, index), cap) * step;
}

// A key is "first" until it has been seen. Nothing is written here, so React may call it twice.
export function isFirst(seen: ReadonlySet<string>, key: string): boolean {
  return !seen.has(key);
}

// Clamp a duration so nothing the app starts runs longer than MAX_MS.
export function capMs(ms: number): number {
  return Math.min(MAX_MS, Math.max(0, ms));
}

// Says whether text is a plain whole number that can be counted up. A figure with a separator, a unit or
// a percent sign stays as written.
export function countable(text: string): number | null {
  return /^\d{1,6}$/.test(text.trim()) ? Number(text.trim()) : null;
}
