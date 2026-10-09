// Reads for the views, plus a re-export of the writes in mutations.ts.
// Dates are plain ISO strings in Asia/Kolkata. "Today" is always passed in from JS, never now().
import { and, asc, desc, eq, ilike, ne, or, sql } from "drizzle-orm";
import { getDb, rowsOf } from "./client";
import { addDays, mondayOf, todayIST } from "./dates";
import { events, people, tasks, teamMembers } from "./schema";
import type { Task } from "./mutations";

export * from "./mutations";
export { addDays, isIsoDate, istDay, mondayOf, todayIST } from "./dates";

export type Person = typeof people.$inferSelect;
export type EventRow = typeof events.$inferSelect;
export type Outcome = "ahead" | "on_time" | "late";

export async function getPerson(id: string): Promise<Person | null> {
  const [row] = await getDb().select().from(people).where(eq(people.id, id));
  return row ?? null;
}

// Everyone on the team's roster, once each, whatever their app roles. Callers filter on `active`.
export async function listPeople(teamId: string): Promise<Person[]> {
  const rows = await getDb()
    .selectDistinct({ person: people })
    .from(people)
    .innerJoin(teamMembers, eq(teamMembers.personId, people.id))
    .where(eq(teamMembers.teamId, teamId))
    .orderBy(asc(people.displayName));
  return rows.map((r) => r.person);
}

export async function listTasksForPerson(personId: string, opts: { open?: boolean } = {}): Promise<Task[]> {
  const where = opts.open
    ? and(eq(tasks.ownerId, personId), eq(tasks.statusCategory, "open"))
    : eq(tasks.ownerId, personId);
  return getDb().select().from(tasks).where(where).orderBy(asc(tasks.dueOn), asc(tasks.id));
}

// The week view (FR-30): tasks due or closed in the week, plus every open overdue task.
export async function listTasksForTeamWeek(teamId: string, weekMondayISO: string): Promise<Task[]> {
  const from = weekMondayISO;
  const to = addDays(from, 6);
  return getDb()
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.teamId, teamId),
        ne(tasks.statusCategory, "dropped"),
        or(
          sql`${tasks.dueOn} BETWEEN ${from} AND ${to}`,
          sql`${tasks.closedOn} BETWEEN ${from} AND ${to}`,
          and(eq(tasks.statusCategory, "open"), sql`${tasks.dueOn} < ${todayIST()}`),
        ),
      ),
    )
    .orderBy(asc(tasks.ownerId), asc(tasks.dueOn), asc(tasks.id));
}

export type StatusGroups = {
  byHealth: Record<string, Task[]>; // open tasks, keyed by health ("none" when unset)
  closed: Record<Outcome, Task[]>; // done tasks closed in the week, keyed by outcome
};

// The status view (FR-31). `weekMondayISO` picks the closed-this-week group; default is this week.
export async function listTasksByStatus(teamId: string, weekMondayISO?: string): Promise<StatusGroups> {
  const from = weekMondayISO ?? mondayOf(todayIST());
  const to = addDays(from, 6);
  const db = getDb();
  const open = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.teamId, teamId), eq(tasks.statusCategory, "open")))
    .orderBy(asc(tasks.dueOn), asc(tasks.id));
  const done = await db
    .select({ task: tasks, outcome: sql<Outcome>`o.outcome` })
    .from(tasks)
    .innerJoin(sql`task_outcome o`, sql`o.task_id = ${tasks.id}`)
    .where(and(eq(tasks.teamId, teamId), sql`${tasks.closedOn} BETWEEN ${from} AND ${to}`))
    .orderBy(asc(tasks.closedOn), asc(tasks.id));
  const byHealth: StatusGroups["byHealth"] = {};
  for (const t of open) (byHealth[t.health ?? "none"] ??= []).push(t);
  const closed: StatusGroups["closed"] = { ahead: [], on_time: [], late: [] };
  for (const d of done) closed[d.outcome].push(d.task);
  return { byHealth, closed };
}

export type LedgerWeek = {
  weekMonday: string;
  counted: number;
  ahead: number;
  onTime: number;
  late: number;
  openOverdue: number;
};

// The ledger (FR-33, section 3.4): week = Monday of first_due_on. Done tasks are judged by
// task_outcome (closed_on against first_due_on). Open tasks count only when past their CURRENT due_on.
// Dropped tasks are left out. Pass personId for one person's row.
export async function ledger(teamId: string, weeksBack: number, personId?: string, today: string = todayIST()): Promise<LedgerWeek[]> {
  const thisMonday = mondayOf(today);
  const from = addDays(thisMonday, -7 * weeksBack);
  const who = personId ? sql`AND t.owner_id = ${personId}` : sql``;
  const res = await getDb().execute(sql`
    WITH s AS (
      SELECT (t.first_due_on - (extract(isodow FROM t.first_due_on)::int - 1)) AS week,
             o.outcome,
             (t.status_category = 'open' AND t.due_on < ${today}::date) AS open_overdue
      FROM tasks t
      JOIN task_outcome o ON o.task_id = t.id
      WHERE t.team_id = ${teamId} AND t.status_category <> 'dropped' ${who}
        AND t.first_due_on >= ${from}::date
    )
    SELECT to_char(week, 'YYYY-MM-DD') AS week_monday,
           count(*) FILTER (WHERE outcome IS NOT NULL OR open_overdue)::int AS counted,
           count(*) FILTER (WHERE outcome = 'ahead')::int AS ahead,
           count(*) FILTER (WHERE outcome = 'on_time')::int AS on_time,
           count(*) FILTER (WHERE outcome = 'late')::int AS late,
           count(*) FILTER (WHERE open_overdue)::int AS open_overdue
    FROM s GROUP BY week ORDER BY week`);
  const found = new Map(
    rowsOf(res).map((r) => [
      r.week_monday as string,
      {
        weekMonday: r.week_monday as string,
        counted: Number(r.counted),
        ahead: Number(r.ahead),
        onTime: Number(r.on_time),
        late: Number(r.late),
        openOverdue: Number(r.open_overdue),
      },
    ]),
  );
  const out: LedgerWeek[] = [];
  for (let w = from; w <= thisMonday; w = addDays(w, 7)) {
    out.push(found.get(w) ?? { weekMonday: w, counted: 0, ahead: 0, onTime: 0, late: 0, openOverdue: 0 });
  }
  return out;
}

// The task log: its events in order (oldest first). Pass newestFirst for the display order (FR-20).
export async function taskLog(taskId: string, opts: { newestFirst?: boolean } = {}): Promise<EventRow[]> {
  const order = opts.newestFirst ? [desc(events.at), desc(events.id)] : [asc(events.at), asc(events.id)];
  return getDb()
    .select()
    .from(events)
    .where(and(eq(events.entityType, "task"), eq(events.entityId, taskId)))
    .orderBy(...order);
}

export type LoadCell = { ownerId: string; weekMonday: string; open: number };

// Load view (FR-76): open tasks per person per week, four weeks from a Monday (default this week).
export async function loadView(teamId: string, fromMondayISO?: string): Promise<LoadCell[]> {
  const from = fromMondayISO ?? mondayOf(todayIST());
  const to = addDays(from, 28);
  const res = await getDb().execute(sql`
    SELECT owner_id,
           to_char(due_on - (extract(isodow FROM due_on)::int - 1), 'YYYY-MM-DD') AS week_monday,
           count(*)::int AS open
    FROM tasks
    WHERE team_id = ${teamId} AND status_category = 'open'
      AND due_on >= ${from}::date AND due_on < ${to}::date
    GROUP BY owner_id, week_monday ORDER BY week_monday, owner_id`);
  return rowsOf(res).map((r) => ({
    ownerId: r.owner_id as string,
    weekMonday: r.week_monday as string,
    open: Number(r.open),
  }));
}

// Full text on title and note: every word is a prefix match. Falls back to ILIKE when that finds nothing.
export async function searchTasks(teamId: string, q: string, limit = 50): Promise<Task[]> {
  const words = q.match(/[\p{L}\p{N}]+/gu) ?? [];
  if (words.length === 0) return [];
  const db = getDb();
  const query = words.map((w) => `${w}:*`).join(" & ");
  const hits = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.teamId, teamId), sql`${tasks.searchTsv} @@ to_tsquery('simple', ${query})`))
    .orderBy(sql`ts_rank(${tasks.searchTsv}, to_tsquery('simple', ${query})) DESC`, asc(tasks.id))
    .limit(limit);
  if (hits.length > 0) return hits;
  const like = `%${q.trim().replace(/[\\%_]/g, "\\$&")}%`;
  return db
    .select()
    .from(tasks)
    .where(and(eq(tasks.teamId, teamId), or(ilike(tasks.title, like), ilike(tasks.note, like))))
    .orderBy(asc(tasks.id))
    .limit(limit);
}

