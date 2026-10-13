import type { Task } from './derive';

// The status word and the derived flag of a task, as pure functions. The task rows (components/task-ui.tsx, a client
// file) and the search filters (lib/search.ts) both read these, so "late" and "at risk" mean the same everywhere.

export type StatusKey = 'todo' | 'doing' | 'blocked' | 'done' | 'dropped';
export type FlagKey = 'late' | 'at_risk' | 'ahead' | 'on_time';

export function statusOf(t: Pick<Task, 'statusCategory' | 'blocked' | 'health'>): StatusKey {
  if (t.statusCategory === 'done') return 'done';
  if (t.statusCategory === 'dropped') return 'dropped';
  if (t.blocked) return 'blocked';
  if (!t.health || t.health === 'not_started') return 'todo';
  return 'doing';
}

// Days of warning before an unstarted or blocked task counts as at risk.
export const RISK_DAYS = 2;
export const daysTo = (d: string, today: string) => Math.round((Date.parse(`${d}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);

// Late, at risk, ahead and on time are worked out from the dates and never stored.
export function flagKeyOf(t: Task, today: string): FlagKey | null {
  if (t.statusCategory === 'done') return t.outcome === 'ahead' ? 'ahead' : t.outcome === 'late' ? 'late' : t.outcome === 'on_time' ? 'on_time' : null;
  if (t.statusCategory !== 'open') return null;
  const n = daysTo(t.dueOn, today);
  if (n < 0) return 'late';
  const k = statusOf(t);
  return n <= RISK_DAYS && (k === 'todo' || k === 'blocked') ? 'at_risk' : null;
}
