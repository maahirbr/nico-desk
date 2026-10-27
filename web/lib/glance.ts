import type { Task } from './derive';
import { addDays, fmtDate, istDate, mondayOf } from './time';

// Home at a glance: the sums behind four small charts. Pure functions over tasks the page already loaded, so
// each rule can be tested on its own. Late means open and past its current due date, the same as Task.overdue.

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// ---------- this week: done, open, late ----------

export type WeekSplit = { done: number; open: number; late: number; total: number };

// The same tasks the Team page shows for a week, for one person: open work due by the end of the week (late
// work included, counted as late), and anything closed during the week. Dropped tasks are not work.
export function weekSplit(tasks: Task[], personId: string, today: string): WeekSplit {
  const start = mondayOf(today);
  const end = addDays(start, 6);
  const out: WeekSplit = { done: 0, open: 0, late: 0, total: 0 };
  for (const t of tasks) {
    if (t.ownerId !== personId) continue;
    if (t.statusCategory === 'done') {
      const on = t.closedAt ? istDate(t.closedAt) : null;
      if (on && on >= start && on <= end) out.done++;
    } else if (t.statusCategory === 'open') {
      if (t.dueOn < today) out.late++;
      else if (t.dueOn <= end) out.open++;
    }
  }
  out.total = out.done + out.open + out.late;
  return out;
}

export function weekSummary(s: WeekSplit): string {
  if (s.total === 0) return 'Nothing due or finished this week.';
  return `This week: ${s.done} done, ${s.open} open, ${s.late} late.`;
}

// ---------- on-time trend: your own rate, week by week ----------

export type TrendWeek = { weekStart: string; closed: number; kept: number; rate: number | null };

// The ledger's rule (lib/service.ts ledger, LedgerView keptOf): a task belongs to the week of its FIRST due
// date, and counts once it has closed. Kept means closed ahead of or on that date. The rate is a whole percent,
// or null for a week with nothing closed. Weeks run oldest to newest and the last is the one holding `today`.
export function onTimeTrend(tasks: Task[], personId: string, today: string, weeks = 4): TrendWeek[] {
  const last = mondayOf(today);
  const out: TrendWeek[] = [];
  for (let i = weeks - 1; i >= 0; i--) out.push({ weekStart: addDays(last, -7 * i), closed: 0, kept: 0, rate: null });
  const byWeek = new Map(out.map((w) => [w.weekStart, w]));
  for (const t of tasks) {
    if (t.ownerId !== personId || t.statusCategory === 'dropped' || !t.outcome) continue;
    const w = byWeek.get(mondayOf(t.firstDueOn));
    if (!w) continue;
    w.closed++;
    if (t.outcome === 'ahead' || t.outcome === 'on_time') w.kept++;
  }
  for (const w of out) w.rate = w.closed ? Math.round((100 * w.kept) / w.closed) : null;
  return out;
}

// `subject` is whose rate it is: "Your" on Home, "Wren's" on a teammate's page.
export function trendSummary(weeks: TrendWeek[], subject = 'Your'): string {
  const withData = weeks.filter((w) => w.rate !== null);
  if (withData.length === 0) return 'No finished tasks in the last four weeks yet, so no on-time rate.';
  const parts = weeks.map((w) => `week of ${fmtDate(w.weekStart)}: ${w.rate === null ? 'nothing finished' : `${w.rate}% of ${plural(w.closed, 'finished task')} on time`}`);
  return `${subject} on-time rate, ${parts.join('; ')}.`;
}

// ---------- load by project: your open tasks, and how many are late ----------

export type LoadRow = { id: string | null; name: string; open: number; late: number };

const byLoad = (a: LoadRow, b: LoadRow) => b.open - a.open || b.late - a.late || a.name.localeCompare(b.name);

// One row per project the person is on, with their own open tasks in it and the late part of those. A project
// they hold open tasks in but are not listed on still gets a row, so the rows add up to all their open work.
// Tasks with no project go in one row at the end. Rows with open work come first, the biggest at the top.
export function loadByProject(tasks: Task[], personId: string, projects: { id: string; name: string }[], projectNames: Record<string, string>, today: string): LoadRow[] {
  const rows = new Map<string, LoadRow>(projects.map((p) => [p.id, { id: p.id, name: p.name, open: 0, late: 0 }]));
  const none: LoadRow = { id: null, name: 'No project', open: 0, late: 0 };
  for (const t of tasks) {
    if (t.ownerId !== personId || t.statusCategory !== 'open') continue;
    let row = none;
    if (t.projectId) {
      row = rows.get(t.projectId) ?? { id: t.projectId, name: projectNames[t.projectId] ?? 'Another project', open: 0, late: 0 };
      rows.set(t.projectId, row);
    }
    row.open++;
    if (t.dueOn < today) row.late++;
  }
  return [...[...rows.values()].sort(byLoad), ...(none.open ? [none] : [])];
}

export function loadSummary(rows: LoadRow[]): string {
  const withWork = rows.filter((r) => r.open > 0);
  if (withWork.length === 0) return 'You have no open tasks in any project.';
  const parts = withWork.map((r) => `${r.name}: ${r.open} open${r.late ? `, ${r.late} late` : ''}`);
  return `Your open tasks by project. ${parts.join('; ')}.`;
}

// ---------- team load (leads and admins) ----------

export type TeamRow = { id: string; name: string; open: number; late: number };

// Open and late tasks per person, for the people in `people`. Someone with no open task is left out, as the
// ledger leaves out people with no tasks. The biggest load comes first.
export function teamLoad(tasks: Task[], people: { id: string; name: string }[], today: string): TeamRow[] {
  const rows = new Map<string, TeamRow>(people.map((p) => [p.id, { id: p.id, name: p.name, open: 0, late: 0 }]));
  for (const t of tasks) {
    if (t.statusCategory !== 'open') continue;
    const r = rows.get(t.ownerId);
    if (!r) continue;
    r.open++;
    if (t.dueOn < today) r.late++;
  }
  return [...rows.values()].filter((r) => r.open > 0).sort(byLoad);
}

export function teamSummary(rows: TeamRow[]): string {
  if (rows.length === 0) return 'No one on the team has an open task.';
  return `Open tasks by person. ${rows.map((r) => `${r.name}: ${r.open} open${r.late ? `, ${r.late} late` : ''}`).join('; ')}.`;
}

// ---------- bar and line geometry ----------

// A bar's length as a share of the longest, 0 to 1. The longest bar fills the track, none is shown below a sliver.
export function barShare(n: number, max: number): number {
  return max <= 0 || n <= 0 ? 0 : Math.max(0.04, Math.min(1, n / max));
}

// Where a rate (0 to 100) sits on a line chart `height` tall, with `pad` kept clear top and bottom.
export function lineY(rate: number, height: number, pad: number): number {
  return Math.round((pad + (1 - rate / 100) * (height - 2 * pad)) * 100) / 100;
}

// The runs of consecutive weeks that have a rate, as lists of [week index, rate]. A week with nothing finished
// breaks the line instead of dropping it to zero.
export function trendRuns(weeks: TrendWeek[]): [number, number][][] {
  const runs: [number, number][][] = [];
  let cur: [number, number][] = [];
  weeks.forEach((w, i) => {
    if (w.rate === null) { if (cur.length) runs.push(cur); cur = []; } else cur.push([i, w.rate]);
  });
  if (cur.length) runs.push(cur);
  return runs;
}

export type Glance = {
  week: WeekSplit;
  trend: TrendWeek[];
  load: LoadRow[];
  team: TeamRow[] | null; // null unless the viewer is a lead or an admin
};

export function glanceOf(tasks: Task[], opts: {
  personId: string; today: string; projects: { id: string; name: string }[]; projectNames: Record<string, string>;
  people: { id: string; name: string }[]; showTeam: boolean;
}): Glance {
  return {
    week: weekSplit(tasks, opts.personId, opts.today),
    trend: onTimeTrend(tasks, opts.personId, opts.today),
    load: loadByProject(tasks, opts.personId, opts.projects, opts.projectNames, opts.today),
    team: opts.showTeam ? teamLoad(tasks, opts.people, opts.today) : null,
  };
}
