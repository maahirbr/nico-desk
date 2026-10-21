import type { Me } from './auth';
import type { Db, Tx } from './db';
import type { EventRow, Task } from './derive';
import { bad, forbidden, notFound } from './errors';
import { flagKeyOf, statusOf } from './flags';
import { plainOf } from './comments';
import { listPeople, newId, projectTasks } from './service';
import { getProject, planState, type MeetEvery, type Project } from './plan';
import { lineLate } from './planUtil';
import { isLeadOrAdmin } from './roles';
import { seesTask } from './sight';
import { addDays, fmtDate, isDate, today as todayIst } from './time';
import { firstMeetingDate, nextAfterHeld, nextMeetingDate, WEEKDAYS, weekdayOf, type Rhythm } from './meetDates';
import { buildUpdates, groupUpdates, UPDATE_DAYS } from './updates';
import { projectFor, sightFor } from './visibility';

// Meeting rhythm and agenda for a project (13 Oct).
//
// The rhythm is four columns on projects: meet_every, meet_day (ISO weekday, 1 Monday to 7 Sunday), meet_next and meet_last.
// The date maths is pure and takes `today`, so tests pin it. The agenda is built from rows with no model: what is late,
// blocked or at risk, what is due before the next meeting, the open asks and actions on a plan board, what changed since
// the last meeting, and the new comments. It reads through lib/visibility.ts, so a person sees only what they already could.

export * from './meetDates';

// ---------- who may ----------

async function rolesOf(tx: Tx, teamId: string, personId: string): Promise<Set<string>> {
  const { rows } = await tx.query<{ app_role: string }>(`SELECT app_role FROM team_members WHERE team_id = $1 AND person_id = $2`, [teamId, personId]);
  return new Set(rows.map((r) => r.app_role));
}

// The project's owner or lead, a team lead or an admin: the same rule as changing the project, archiving it, or marking a meeting held.
export const mayRunMeeting = (p: Pick<Project, 'ownerId' | 'leadId'>, meId: string, roles: Iterable<string>): boolean =>
  p.ownerId === meId || p.leadId === meId || isLeadOrAdmin(roles);

async function meetingContext(tx: Tx, meId: string, id: string): Promise<Project> {
  const { rows } = await tx.query<{ id: string }>(`SELECT id FROM projects WHERE id = $1 FOR UPDATE`, [id]);
  if (!rows[0]) throw notFound('No such project.');
  const p = await getProject(tx, id);
  const roles = await rolesOf(tx, p.teamId, meId);
  if (roles.size === 0) throw forbidden('You are not on this project’s team.');
  if (!mayRunMeeting(p, meId, roles)) throw forbidden('Only the project owner, its lead or a team lead can set the meeting rhythm or mark a meeting held.');
  if (p.archivedAt) throw bad('project_archived', 'This project is archived. Restore it before changing it.');
  return p;
}

// ---------- writing ----------

export type RhythmInput = { every: MeetEvery | null; day?: number | null; next?: string | null };

export async function setMeetingRhythm(db: Db, meId: string, id: string, input: RhythmInput, today = todayIst()): Promise<Rhythm> {
  const out = await db.transaction(async (tx) => {
    const p = await meetingContext(tx, meId, id);
    let every = input.every;
    let day: number | null = input.day ?? null;
    let next: string | null = input.next ?? null;
    if (!every) { day = null; next = null; }
    else if (every === 'as_needed') day = null;
    if (day !== null && (!Number.isInteger(day) || day < 1 || day > 7)) throw bad('invalid_body', 'Pick a weekday from Monday to Sunday.', 'day');
    if (next !== null) {
      if (!isDate(next)) throw bad('invalid_body', 'Use a real date, YYYY-MM-DD.', 'next');
      if (next < today) throw bad('invalid_body', 'The next meeting must be today or later.', 'next');
      if (day !== null && weekdayOf(next) !== day) throw bad('invalid_body', `${fmtDate(next)} is a ${WEEKDAYS[weekdayOf(next) - 1]}, not a ${WEEKDAYS[day - 1]}. Change the day or the date.`, 'next');
    }
    if (every && every !== 'as_needed' && next === null) next = firstMeetingDate(every, day, today);
    every = every ?? null;
    await tx.query(`UPDATE projects SET meet_every = $2, meet_day = $3, meet_next = $4 WHERE id = $1`, [id, every, day, next]);
    await tx.query(
      `INSERT INTO events (id, entity_type, entity_id, field, before, after, actor_id, origin, at) VALUES ($1,'project',$2,'meeting_rhythm',$3::jsonb,$4::jsonb,$5,'app',now())`,
      [newId('evt'), id, JSON.stringify({ every: p.meetEvery, day: p.meetDay, next: p.meetNext }), JSON.stringify({ every, day, next }), meId]);
    return { meetEvery: every, meetDay: day, meetNext: next, meetLast: p.meetLast } satisfies Rhythm;
  });
  return out;
}

// "Meeting held": the last meeting is today and the next date moves on. Once a day.
export async function markMeetingHeld(db: Db, meId: string, id: string, today = todayIst()): Promise<Rhythm> {
  return db.transaction(async (tx) => {
    const p = await meetingContext(tx, meId, id);
    if (p.meetLast === today) throw bad('already_held', 'This meeting is already marked held today.');
    const next = nextAfterHeld(p, today);
    await tx.query(`UPDATE projects SET meet_last = $2, meet_next = $3 WHERE id = $1`, [id, today, next]);
    await tx.query(
      `INSERT INTO events (id, entity_type, entity_id, field, before, after, actor_id, origin, at) VALUES ($1,'project',$2,'meeting_held',$3::jsonb,$4::jsonb,$5,'app',now())`,
      [newId('evt'), id, JSON.stringify({ last: p.meetLast, next: p.meetNext }), JSON.stringify({ last: today, next }), meId]);
    return { meetEvery: p.meetEvery, meetDay: p.meetDay, meetNext: next, meetLast: today } satisfies Rhythm;
  });
}

// ---------- the agenda ----------

export type AgendaRow = {
  id: string;
  taskId: string | null; // set for a task: the board opens it
  title: string;
  note: string; // one plain sentence: why it is here
  tone?: 'late' | 'soon';
};
export type AgendaSection = {
  key: 'late' | 'blocked' | 'at_risk' | 'soon' | 'lines' | 'asks' | 'actions' | 'changed' | 'finished' | 'comments';
  title: string;
  rows: AgendaRow[];
  more: number; // rows left out of this list
};
export type Agenda = {
  projectId: string;
  next: string | null; // the next meeting as it shows today
  last: string | null;
  since: string; // the first day the "changed" lists cover
  horizon: string; // tasks due on or before this date are listed as due before the next meeting
  sections: AgendaSection[]; // only sections with rows
  total: number;
};

const SECTION_CAP = 25;
const DAY = 86_400_000;
const dayWord = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;
const daysBetweenDates = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);
const istStart = (date: string) => new Date(`${date}T00:00:00+05:30`);
const first = (name: string | undefined) => (name ?? 'Someone').split(' ')[0];

// Pure: the rows the agenda is made of in, sections out. Tests call it with plain objects.
export function buildAgenda(input: {
  project: Pick<Project, 'id' | 'kind' | 'meetEvery' | 'meetDay' | 'meetNext' | 'meetLast'>;
  tasks: Task[];
  events: EventRow[];
  plan: Awaited<ReturnType<typeof planState>> | null;
  comments: { id: string; subjectKind: 'task' | 'project'; subjectId: string; body: string; at: string; author: string }[];
  names: Record<string, string>;
  today: string;
}): Agenda {
  const { project: p, tasks, names, today } = input;
  const next = nextMeetingDate(p, today);
  const horizon = next ?? addDays(today, UPDATE_DAYS);
  const sinceDay = p.meetLast ?? addDays(today, -UPDATE_DAYS);
  // The last meeting's own day counts as discussed: what changed after it ended starts the next morning.
  const cutoff = p.meetLast ? istStart(addDays(p.meetLast, 1)) : istStart(sinceDay);
  const now = new Date(istStart(addDays(today, 1)).getTime() - 1);
  const days = Math.min(90, Math.max(UPDATE_DAYS, Math.ceil((now.getTime() - cutoff.getTime()) / DAY)));
  const who = (id: string | null | undefined) => (id ? first(names[id]) : 'Nobody');

  // Each open task sits in the first group that fits: late, blocked, at risk, then due before the next meeting.
  const open = tasks.filter((t) => t.statusCategory === 'open');
  const byDue = (a: Task, b: Task) => a.dueOn.localeCompare(b.dueOn) || a.title.localeCompare(b.title);
  const groups: Record<'late' | 'blocked' | 'at_risk' | 'soon', Task[]> = { late: [], blocked: [], at_risk: [], soon: [] };
  for (const t of open.sort(byDue)) {
    const flag = flagKeyOf(t, today);
    if (flag === 'late') groups.late.push(t);
    else if (statusOf(t) === 'blocked') groups.blocked.push(t);
    else if (flag === 'at_risk') groups.at_risk.push(t);
    else if (t.dueOn <= horizon) groups.soon.push(t);
  }
  const taskRow = (t: Task, note: string, tone?: AgendaRow['tone']): AgendaRow => ({ id: t.id, taskId: t.id, title: t.title, note, ...(tone ? { tone } : {}) });
  const owner = (t: Task) => who(t.ownerId);
  const rows: Record<AgendaSection['key'], AgendaRow[]> = {
    late: groups.late.map((t) => taskRow(t, `${owner(t)}. ${dayWord(Math.abs(daysBetweenDates(t.dueOn, today)))} late, was due ${fmtDate(t.dueOn)}.${t.blocked ? ' Also blocked.' : ''}`, 'late')),
    blocked: groups.blocked.map((t) => taskRow(t, `${owner(t)}. ${t.blocked?.onId ? `Waiting on ${who(t.blocked.onId)}: ` : ''}${t.blocked?.ask ?? ''}`.trim())),
    at_risk: groups.at_risk.map((t) => taskRow(t, `${owner(t)}. Due ${t.dueOn === today ? 'today' : fmtDate(t.dueOn)} and not started.`, 'soon')),
    soon: groups.soon.map((t) => taskRow(t, `${owner(t)}. Due ${t.dueOn === today ? 'today' : fmtDate(t.dueOn)}.`)),
    lines: [], asks: [], actions: [], changed: [], finished: [], comments: [],
  };

  if (input.plan) {
    for (const l of input.plan.lines) {
      const blocked = l.status === 'Blocked', late = lineLate(l, today);
      if (!blocked && !late) continue;
      const why = [late ? 'late' : '', blocked ? 'blocked' : ''].filter(Boolean).join(' and ');
      rows.lines.push({ id: l.id, taskId: null, title: `${l.num}. ${l.what}`, note: `${l.ownerWith ? `${l.ownerWith}. ` : ''}${why[0].toUpperCase()}${why.slice(1)}.`, ...(late ? { tone: 'late' as const } : {}) });
    }
    for (const a of input.plan.asks) {
      if (a.done) continue;
      rows.asks.push({ id: a.id, taskId: null, title: a.short || a.text, note: `${a.ownerName ? `${a.ownerName}. ` : ''}${a.dueOn ? `Due ${fmtDate(a.dueOn)}.` : 'No date.'}`, ...(a.dueOn && a.dueOn < today ? { tone: 'late' as const } : {}) });
    }
    for (const a of [...input.plan.actions].filter((x) => !x.done).sort((x, y) => (x.dueOn ?? '9999').localeCompare(y.dueOn ?? '9999'))) {
      rows.actions.push({ id: a.id, taskId: null, title: a.task, note: `${a.ownerName ? `${a.ownerName}. ` : ''}${a.dueOn ? `Due ${fmtDate(a.dueOn)}.` : 'No date.'}`, ...(a.dueOn && a.dueOn < today ? { tone: 'late' as const } : {}) });
    }
  }

  // What changed: the same reader as Updates, in the project lead's view and with nobody's own changes left out.
  // The stand-in viewer is a lead of this project only, so the lead cases (date moved, blocked, dropped, reassigned) all show.
  const ME = '__meeting__';
  const items = buildUpdates({
    events: input.events.map((e) => ({ id: e.id, entity_id: e.entity_id, field: e.field, before: e.before, after: e.after, reason: e.reason, actor_id: e.actor_id, at: e.at })),
    tasks, leadOf: { [p.id]: [ME] }, names, viewerId: ME, now, seenAt: p.meetLast ? cutoff.toISOString() : null, days,
  });
  const grouped = groupUpdates(items, tasks, {}, names, ME, today).flatMap((g) => g.rows);
  for (const r of grouped) rows.changed.push({ id: `chg-${r.taskId}`, taskId: r.taskId, title: r.title, note: `${r.summary}.` });
  if (input.plan) {
    // plan_activity has its own summary line per change (a date moved, a line done).
    for (const a of input.plan.activity.filter((x) => new Date(x.at) >= cutoff && new Date(x.at) <= now)) {
      rows.changed.push({ id: `act-${a.id}`, taskId: null, title: a.summary, note: `${a.actorName ? `${first(a.actorName)}, ` : ''}${fmtDate(new Date(a.at).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }))}.` });
    }
  }
  for (const t of tasks.filter((x) => x.statusCategory === 'done' && x.endedAt && new Date(x.endedAt) >= cutoff && new Date(x.endedAt) <= now)
    .sort((a, b) => (b.endedAt ?? '').localeCompare(a.endedAt ?? ''))) {
    const flag = t.outcome === 'late' ? ' Late.' : t.outcome === 'ahead' ? ' Ahead.' : '';
    rows.finished.push(taskRow(t, `${owner(t)}. Done ${fmtDate(new Date(t.endedAt!).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }))}.${flag}`));
  }
  const titleOf = new Map(tasks.map((t) => [t.id, t.title]));
  for (const c of input.comments) {
    const text = plainOf(c.body, (k, id) => (k === 'person' ? names[id] ?? null : null));
    const where = c.subjectKind === 'task' ? ` on “${titleOf.get(c.subjectId) ?? 'a task'}”` : '';
    rows.comments.push({ id: c.id, taskId: c.subjectKind === 'task' ? c.subjectId : null, title: text.length > 140 ? `${text.slice(0, 137)}...` : text, note: `${first(c.author)}${where}.` });
  }

  const titles: Record<AgendaSection['key'], string> = {
    late: 'Late', blocked: 'Blocked', at_risk: 'At risk', soon: next ? 'Due before the next meeting' : 'Due in the next 7 days',
    lines: 'Lines of work off course', asks: 'Open asks', actions: 'Actions still open',
    changed: p.meetLast ? `Changed since ${fmtDate(p.meetLast)}` : 'Changed in the last 7 days',
    finished: p.meetLast ? `Finished since ${fmtDate(p.meetLast)}` : 'Finished in the last 7 days',
    comments: p.meetLast ? `New comments since ${fmtDate(p.meetLast)}` : 'New comments in the last 7 days',
  };
  const order: AgendaSection['key'][] = ['late', 'blocked', 'at_risk', 'soon', 'lines', 'asks', 'actions', 'changed', 'finished', 'comments'];
  const sections = order.filter((k) => rows[k].length).map((k) => ({ key: k, title: titles[k], rows: rows[k].slice(0, SECTION_CAP), more: Math.max(0, rows[k].length - SECTION_CAP) }));
  return { projectId: p.id, next, last: p.meetLast, since: p.meetLast ? addDays(p.meetLast, 1) : sinceDay, horizon, sections, total: order.reduce((n, k) => n + rows[k].length, 0) };
}

// The loader. Reads only what this viewer may see: the project must be visible, and tasks pass the same test as everywhere.
export async function meetingAgenda(db: Db, me: Me, projectId: string, today = todayIst()): Promise<Agenda> {
  const p = await projectFor(db, me, projectId);
  const sight = await sightFor(db, me);
  const [allTasks, people] = await Promise.all([projectTasks(db, p.id, today), listPeople(db, me.team.id)]);
  const tasks = allTasks.filter((t) => seesTask(sight, t));
  const names = Object.fromEntries(people.map((x) => [x.id, x.displayName]));
  const sinceDay = p.meetLast ? addDays(p.meetLast, 1) : addDays(today, -UPDATE_DAYS);
  const cutoff = istStart(sinceDay).toISOString();
  const [events, comments, plan] = await Promise.all([
    db.query<EventRow>(
      `SELECT e.* FROM events e JOIN tasks t ON t.id = e.entity_id
       WHERE e.entity_type = 'task' AND t.project_id = $1 AND e.at >= $2
         AND e.field IN ('_created','owner_id','due_on','blocked_ask','blocked_on_id','status_category','title')`,
      [p.id, cutoff]),
    db.query<{ id: string; subject_kind: 'task' | 'project'; subject_id: string; body: string; created_at: string | Date; author: string }>(
      `SELECT c.id, c.subject_kind, c.subject_id, c.body, c.created_at, COALESCE(a.nickname, a.display_name) AS author FROM comments c JOIN people a ON a.id = c.author_id
       WHERE c.deleted_at IS NULL AND c.created_at >= $2
         AND ((c.subject_kind = 'project' AND c.subject_id = $1) OR (c.subject_kind = 'task' AND c.subject_id IN (SELECT id FROM tasks WHERE project_id = $1)))
       ORDER BY c.created_at DESC LIMIT 20`,
      [p.id, cutoff]),
    p.kind === 'plan' ? planState(db, p.id) : Promise.resolve(null),
  ]);
  return buildAgenda({
    project: p, tasks, events: events.rows, plan, names, today,
    comments: comments.rows.map((c) => ({ id: c.id, subjectKind: c.subject_kind, subjectId: c.subject_id, body: c.body, at: new Date(c.created_at).toISOString(), author: c.author })),
  });
}
