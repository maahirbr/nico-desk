import type { TaskLink } from './links';
import { istDate } from './time';

// Derived values from SPEC.md 3.4. Never stored: computed from the task row and its events.

export type Health = 'not_started' | 'off_track' | 'on_track' | 'ahead';
export type Outcome = 'ahead' | 'on_time' | 'late';
// How a late task went late. 'flagged_early': the owner moved the date on or before the date first given.
// 'missed': the date passed with no move first (a later move, after the date passed, does not change this).
export type LateKind = 'flagged_early' | 'missed';

export type TaskRow = {
  id: string;
  team_id: string;
  title: string;
  description: string | null;
  owner_id: string;
  project_id: string | null;
  workstream: string | null;
  first_due_on: string;
  due_on: string;
  note: string | null;
  health: Health | null;
  status: string;
  status_category: 'open' | 'done' | 'dropped';
  priority: 'high' | 'normal' | 'low' | null;
  priority_set_by: string | null;
  priority_set_at: string | null;
  blocked_on_id: string | null;
  blocked_ask: string | null;
  blocked_at: string | null;
  origin: 'app' | 'sheet' | 'granola';
  origin_ref: string | null;
  created_by: string | null;
  created_at: string;
  closed_at: string | null;
  version: number;
};

export type EventRow = {
  id: string;
  entity_type: 'task' | 'project';
  entity_id: string;
  field: string;
  before: unknown;
  after: unknown;
  reason: string | null;
  actor_id: string | null;
  origin: string;
  at: string;
};

export type Renegotiation = { at: string; from: string; to: string; reason: string | null; kind: 'open' | 'late' };

export type Task = {
  id: string;
  teamId: string;
  title: string;
  description: string | null;
  ownerId: string;
  projectId: string | null;
  workstream: string | null;
  firstDueOn: string;
  dueOn: string;
  dateMoves: number;
  note: string | null;
  health: Health | null;
  statusCategory: 'open' | 'done' | 'dropped';
  sourceStatus: string;
  outcome: Outcome | null;
  lateKind: LateKind | null;
  metRevisedDate: boolean | null;
  overdue: boolean;
  slippedSilently: boolean;
  renegotiations: Renegotiation[];
  priority: { value: 'high' | 'normal' | 'low'; setBy: string; setAt: string } | null;
  blocked: { onId: string | null; ask: string; at: string } | null; // ask is the block reason; a person is optional
  origin: 'app' | 'sheet' | 'granola';
  readOnly: boolean;
  createdBy: string | null;
  createdAt: string;
  closedAt: string | null;
  endedAt: string | null; // when it was done or dropped (a drop sets no closed_at, so its status event)
  version: number;
  links: TaskLink[]; // filled by loadTasks in lib/service.ts
};

// Completed lists: the most recently finished first.
export const latestEndedFirst = (a: Task, b: Task) => (b.endedAt ?? '').localeCompare(a.endedAt ?? '');

// "Added since": the tasks made at or after a cutoff, from any source, in the order they were made, so a meeting
// can close by reading back what it agreed. Dropped ones are left out: dropping is how a to-do is taken back.
export function addedSince(list: Task[], cutoff: Date): Task[] {
  const at = (t: Task) => new Date(t.createdAt).getTime();
  return list.filter((t) => t.statusCategory !== 'dropped' && at(t) >= cutoff.getTime()).sort((a, b) => at(a) - at(b));
}

// The sort picker on finished lists. Ties, and tasks not yet finished, fall back to the due date.
export type EndedSort = 'recent' | 'oldest' | 'due';
export function sortEnded(list: Task[], by: EndedSort, due: 'dueOn' | 'firstDueOn' = 'dueOn'): Task[] {
  const byDue = (a: Task, b: Task) => a[due].localeCompare(b[due]);
  const oldest = (a: Task, b: Task) => !a.endedAt || !b.endedAt ? (a.endedAt ? -1 : b.endedAt ? 1 : 0) : a.endedAt.localeCompare(b.endedAt);
  const cmp = by === 'due' ? byDue : (a: Task, b: Task) => (by === 'recent' ? latestEndedFirst(a, b) : oldest(a, b)) || byDue(a, b);
  return [...list].sort(cmp);
}

export function renegotiations(events: EventRow[]): Renegotiation[] {
  return events
    .filter((e) => e.field === 'due_on')
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.id < b.id ? -1 : 1))
    .map((e) => {
      const from = String(e.before);
      return { at: e.at, from, to: String(e.after), reason: e.reason, kind: istDate(e.at) <= from ? 'open' : 'late' };
    });
}

export function derive(row: TaskRow, events: EventRow[], today: string): Task {
  const reneg = renegotiations(events);
  const closedOn = row.closed_at ? istDate(row.closed_at) : null;
  const done = row.status_category === 'done' && closedOn !== null;

  // The due date in force at close: the last renegotiation at or before the close, else the first date.
  let dueAtClose = row.first_due_on;
  if (row.closed_at) for (const r of reneg) if (r.at <= row.closed_at) dueAtClose = r.to;

  const outcome: Outcome | null = !done
    ? null
    : closedOn! < row.first_due_on
      ? 'ahead'
      : closedOn! === row.first_due_on
        ? 'on_time'
        : 'late';

  // The first move decides it: a move made on or before the first date is 'open' in renegotiations().
  const lateKind: LateKind | null = outcome !== 'late' ? null : reneg[0]?.kind === 'open' ? 'flagged_early' : 'missed';

  const overdue = row.status_category === 'open' && today > row.due_on;
  const slippedSilently = overdue || reneg.some((r) => r.kind === 'late') || (done && closedOn! > dueAtClose);

  return {
    id: row.id,
    teamId: row.team_id,
    title: row.title,
    ownerId: row.owner_id,
    projectId: row.project_id,
    description: row.description ?? null,
    workstream: row.workstream ?? null,
    firstDueOn: row.first_due_on,
    dueOn: row.due_on,
    dateMoves: reneg.length,
    note: row.note,
    health: row.health,
    statusCategory: row.status_category,
    sourceStatus: row.status,
    outcome,
    lateKind,
    metRevisedDate: done && reneg.length > 0 ? closedOn! <= dueAtClose : null,
    overdue,
    slippedSilently,
    renegotiations: reneg,
    priority: row.priority
      ? { value: row.priority, setBy: row.priority_set_by!, setAt: row.priority_set_at! }
      : null,
    blocked: row.blocked_ask ? { onId: row.blocked_on_id, ask: row.blocked_ask, at: row.blocked_at! } : null,
    origin: row.origin,
    readOnly: row.origin === 'sheet',
    createdBy: row.created_by,
    createdAt: row.created_at,
    closedAt: row.closed_at,
    endedAt: row.status_category === 'open' ? null : row.closed_at
      ? new Date(row.closed_at).toISOString()
      : events.filter((e) => e.field === 'status_category').map((e) => new Date(e.at).toISOString()).sort().pop() ?? null,
    version: row.version,
    links: [],
  };
}

export function closedOn(t: Task): string | null {
  return t.closedAt ? istDate(t.closedAt) : null;
}
