import type { Task } from './derive';
import { lineLate, type PlanLine } from './planUtil';
import { addDays, fmtDate, istDate, mondayOf } from './time';

// More visual data: the sums behind the project status bar and the weekly done-against-due chart. Pure functions
// over tasks or plan lines the page already loaded, so each rule can be tested on its own.

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// ---------- the status bar: where a project's work stands ----------

export type SplitKey = 'done' | 'doing' | 'todo' | 'blocked' | 'late';
// Left to right on the bar, and the order of the counts written under it.
export const SPLIT_ORDER: readonly SplitKey[] = ['done', 'doing', 'todo', 'blocked', 'late'];
const WORD: Record<SplitKey, string> = { done: 'done', doing: 'in progress', todo: 'not started', blocked: 'blocked', late: 'late' };

export type StatusSplit = Record<SplitKey, number> & { total: number };

export const emptySplit = (): StatusSplit => ({ done: 0, doing: 0, todo: 0, blocked: 0, late: 0, total: 0 });

// A task counts once. Late means open and past its current due date (the same test as Task.overdue and the Home
// charts), and a late task counts in late and not in its status, so the segments add up to the total. The status
// words mirror statusKey in components/task-ui.tsx: blocked when a block is set, not started with no health yet,
// in progress otherwise. Dropped tasks are not work and are left out.
export function taskSplit(tasks: Pick<Task, 'statusCategory' | 'dueOn' | 'blocked' | 'health'>[], today: string): StatusSplit {
  const s = emptySplit();
  for (const t of tasks) {
    if (t.statusCategory === 'dropped') continue;
    let k: SplitKey;
    if (t.statusCategory === 'done') k = 'done';
    else if (t.dueOn < today) k = 'late';
    else if (t.blocked) k = 'blocked';
    else if (!t.health || t.health === 'not_started') k = 'todo';
    else k = 'doing';
    s[k]++;
    s.total++;
  }
  return s;
}

// A plan board has the same four status words on its lines. A line is late by its next checkpoint (lineLate), the
// plan board's own rule, and then counts in late. Removed lines are not in the plan state, so they are not counted.
export function lineSplit(lines: Pick<PlanLine, 'status' | 'dueOn' | 'checkpoints'>[], today: string): StatusSplit {
  const s = emptySplit();
  for (const l of lines) {
    let k: SplitKey;
    if (l.status === 'Done') k = 'done';
    else if (lineLate(l as PlanLine, today)) k = 'late';
    else if (l.status === 'Blocked') k = 'blocked';
    else if (l.status === 'In progress') k = 'doing';
    else k = 'todo';
    s[k]++;
    s.total++;
  }
  return s;
}

// The non-zero parts in bar order, each with the words written under the bar.
export function splitParts(s: StatusSplit): { key: SplitKey; n: number; word: string }[] {
  return SPLIT_ORDER.filter((k) => s[k] > 0).map((key) => ({ key, n: s[key], word: WORD[key] }));
}

// "5 done · 2 in progress · 1 blocked · 1 late". Zeros are left out.
export function splitText(s: StatusSplit): string {
  if (s.total === 0) return 'No tasks yet';
  return splitParts(s).map((p) => `${p.n} ${p.word}`).join(' · ');
}

// The bar's label for screen readers.
export function splitSummary(s: StatusSplit, what = 'tasks'): string {
  if (s.total === 0) return `No ${what} yet.`;
  return `${plural(s.total, what.replace(/s$/, ''), what)}: ${splitParts(s).map((p) => `${p.n} ${p.word}`).join(', ')}.`;
}

// ---------- the weekly chart: done against due, week by week ----------

export type DueDone = { weekStart: string; due: number; done: number };
// What the chart needs of a piece of work: the day it is due and the day it was finished (both IST dates).
export type Dated = { dueOn: string | null; doneOn: string | null };

// Tasks: due on the current due date, done on the day the task closed. Dropped tasks are not work.
export function taskDates(tasks: Pick<Task, 'statusCategory' | 'dueOn' | 'closedAt'>[]): Dated[] {
  return tasks.filter((t) => t.statusCategory !== 'dropped').map((t) => ({
    dueOn: t.dueOn, doneOn: t.statusCategory === 'done' && t.closedAt ? istDate(t.closedAt) : null,
  }));
}

// Plan lines: due on the line's own date, done on the day it was completed.
export function lineDates(lines: Pick<PlanLine, 'dueOn' | 'completedOn' | 'status'>[]): Dated[] {
  return lines.map((l) => ({ dueOn: l.dueOn, doneOn: l.status === 'Done' ? l.completedOn : null }));
}

// The last `weeks` weeks, Monday to Sunday in IST, oldest first; the last holds `today`. A piece of work counts as
// due in the week of its due date and as done in the week it was finished, so a task finished late is done in a
// later week than the one it was due in.
export function dueDoneByWeek(items: Dated[], today: string, weeks = 6): DueDone[] {
  const last = mondayOf(today);
  const out: DueDone[] = [];
  for (let i = weeks - 1; i >= 0; i--) out.push({ weekStart: addDays(last, -7 * i), due: 0, done: 0 });
  const byWeek = new Map(out.map((w) => [w.weekStart, w]));
  for (const it of items) {
    if (it.dueOn) { const w = byWeek.get(mondayOf(it.dueOn)); if (w) w.due++; }
    if (it.doneOn) { const w = byWeek.get(mondayOf(it.doneOn)); if (w) w.done++; }
  }
  return out;
}

export const weeksEmpty = (weeks: DueDone[]) => weeks.every((w) => w.due === 0 && w.done === 0);

export function dueDoneSummary(weeks: DueDone[]): string {
  if (weeksEmpty(weeks)) return `Nothing was due or finished in the last ${weeks.length} weeks.`;
  const parts = weeks.map((w) => `week of ${fmtDate(w.weekStart)}: ${w.done} done, ${w.due} due`);
  return `Work done against work due, the last ${weeks.length} weeks. ${parts.join('; ')}.`;
}
