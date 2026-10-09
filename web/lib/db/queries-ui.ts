// Read-only queries for the week sheet. Nothing here writes; the mutations stay in mutations.ts.
import { and, asc, eq, inArray, lt, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb, rowsOf } from "./client";
import { addDays, istDay, mondayOf } from "./dates";
import { drafts, events, notes, people, tasks, teamMembers } from "./schema";
import type { Task } from "./mutations";

export type DueMove = { taskId: string; from: string; to: string; reason: string | null; at: string };

// Every date move of the given tasks, oldest first. due_on events hold ISO days in before and after.
export async function dueMovesOf(taskIds: string[]): Promise<Map<string, DueMove[]>> {
  const out = new Map<string, DueMove[]>();
  if (taskIds.length === 0) return out;
  const rows = await getDb()
    .select()
    .from(events)
    .where(and(eq(events.entityType, "task"), eq(events.field, "due_on"), inArray(events.entityId, taskIds)))
    .orderBy(asc(events.at), asc(events.id));
  for (const e of rows) {
    if (typeof e.before !== "string" || typeof e.after !== "string") continue;
    const list = out.get(e.entityId) ?? [];
    list.push({ taskId: e.entityId, from: e.before, to: e.after, reason: e.reason, at: e.at });
    out.set(e.entityId, list);
  }
  return out;
}

export type TaskQuote = { taskId: string; quote: string | null; noteTitle: string; heldAt: string };

// Where a note-origin task came from. The quote exists when an accepted draft is linked to the task.
// Without a draft row, origin_ref ("noteId#item") still names the note.
export async function quotesFor(list: Task[]): Promise<Map<string, TaskQuote>> {
  const out = new Map<string, TaskQuote>();
  const fromNotes = list.filter((t) => t.origin === "notes");
  if (fromNotes.length === 0) return out;
  const db = getDb();
  const linked = await db
    .select({ taskId: drafts.taskId, quote: drafts.sourceQuote, noteTitle: notes.title, heldAt: notes.heldAt })
    .from(drafts)
    .innerJoin(notes, eq(notes.id, drafts.noteId))
    .where(inArray(drafts.taskId, fromNotes.map((t) => t.id)));
  for (const r of linked) if (r.taskId) out.set(r.taskId, { taskId: r.taskId, quote: r.quote, noteTitle: r.noteTitle, heldAt: r.heldAt });
  const noteIds = [...new Set(fromNotes.filter((t) => !out.has(t.id)).map((t) => (t.originRef ?? "").split("#")[0]).filter(Boolean))];
  if (noteIds.length === 0) return out;
  const found = new Map(
    (await db.select({ id: notes.id, title: notes.title, heldAt: notes.heldAt }).from(notes).where(inArray(notes.id, noteIds))).map((n) => [n.id, n]),
  );
  for (const t of fromNotes) {
    if (out.has(t.id)) continue;
    const n = found.get((t.originRef ?? "").split("#")[0]);
    if (n) out.set(t.id, { taskId: t.id, quote: null, noteTitle: n.title, heldAt: n.heldAt });
  }
  return out;
}

// The note source of every note-origin task of a team, as plain objects for the desk on the client.
export async function quotesOfTeam(teamId: string): Promise<TaskQuote[]> {
  const list = await getDb()
    .select()
    .from(tasks)
    .where(and(eq(tasks.teamId, teamId), eq(tasks.origin, "notes")));
  return [...(await quotesFor(list)).values()];
}

// Titles of tasks by id. The drafting table uses it to name the task a draft may repeat.
export async function taskTitlesOf(ids: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (ids.length === 0) return out;
  const rows = await getDb().select({ id: tasks.id, title: tasks.title }).from(tasks).where(inArray(tasks.id, ids));
  for (const r of rows) out[r.id] = r.title;
  return out;
}

// Open tasks owned by other people that wait on this person.
export async function openBlockedOn(personId: string): Promise<Task[]> {
  return getDb()
    .select()
    .from(tasks)
    .where(and(eq(tasks.blockedOnId, personId), eq(tasks.statusCategory, "open"), ne(tasks.ownerId, personId)))
    .orderBy(asc(tasks.dueOn), asc(tasks.id));
}

// The fields the desk replays. Anything else in the log does not change what a desk line shows.
const DESK_FIELDS = ["_created", "title", "owner_id", "due_on", "health", "status_category", "closed_on", "ask_state"];

export type DeskEvent = { field: string; before: string | null; after: string | null; reason: string | null; at: string; day: string };
export type DeskTask = {
  id: string;
  title: string;
  ownerId: string;
  firstDueOn: string;
  dueOn: string;
  health: string | null;
  statusCategory: string;
  closedOn: string | null;
  createdAt: string;
  askedById: string | null; // set when the line is an ask
  forTaskId: string | null;
  askState: string | null; // as created; later ask_state events are in `events`
  events: DeskEvent[]; // after the _created event, oldest first; day is the Asia/Kolkata day it happened
};

const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

// Every task of a team as it was created, with the later events that change what a desk line shows.
// The desk replays these on the client, so dragging the scrubber never asks the server.
export async function deskHistory(teamId: string): Promise<DeskTask[]> {
  const db = getDb();
  const ids = (await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.teamId, teamId))).map((r) => r.id);
  if (ids.length === 0) return [];
  const rows = await db
    .select()
    .from(events)
    .where(and(eq(events.entityType, "task"), inArray(events.field, DESK_FIELDS), inArray(events.entityId, ids)))
    .orderBy(asc(events.at), asc(events.id));
  const out = new Map<string, DeskTask>();
  for (const e of rows) {
    if (e.field === "_created") {
      const a = (e.after ?? {}) as Record<string, unknown>;
      out.set(e.entityId, {
        id: e.entityId,
        title: str(a.title) ?? "",
        ownerId: str(a.owner_id) ?? "",
        firstDueOn: str(a.first_due_on) ?? "",
        dueOn: str(a.due_on) ?? str(a.first_due_on) ?? "",
        health: str(a.health),
        statusCategory: str(a.status_category) ?? "open",
        closedOn: str(a.closed_on),
        createdAt: str(a.created_at) ?? e.at,
        askedById: str(a.asked_by_id),
        forTaskId: str(a.for_task_id),
        askState: str(a.ask_state),
        events: [],
      });
      continue;
    }
    out.get(e.entityId)?.events.push({ field: e.field, before: str(e.before), after: str(e.after), reason: e.reason, at: e.at, day: istDay(e.at) });
  }
  return [...out.values()];
}

// One line of the ledger book. The week is the Monday of first_due_on. outcome comes from the task_outcome
// view, so it is judged against the first date. A line is counted when it has an outcome or is open past its current date.
export type LedgerLine = {
  id: string;
  ownerId: string;
  title: string;
  firstDueOn: string;
  dueOn: string;
  closedOn: string | null;
  outcome: "ahead" | "on_time" | "late" | null;
  openOverdue: boolean;
  counted: boolean;
  moves: DueMove[];
};

// Lines for the weeks from weeksBack Mondays before this week to the end of this week. Dropped tasks are left out.
// A line that is not counted yet comes back only when its date was moved with a reason, so the move has a row to hang on.
export async function ledgerLines(teamId: string, weeksBack: number, today: string): Promise<LedgerLine[]> {
  const from = addDays(mondayOf(today), -7 * weeksBack);
  const to = addDays(mondayOf(today), 6);
  const res = await getDb().execute(sql`
    SELECT t.id, t.owner_id, t.title,
           to_char(t.first_due_on, 'YYYY-MM-DD') AS first_due_on,
           to_char(t.due_on, 'YYYY-MM-DD') AS due_on,
           to_char(t.closed_on, 'YYYY-MM-DD') AS closed_on,
           o.outcome,
           (t.status_category = 'open' AND t.due_on < ${today}::date) AS open_overdue
    FROM tasks t
    JOIN task_outcome o ON o.task_id = t.id
    WHERE t.team_id = ${teamId} AND t.status_category <> 'dropped'
      AND t.first_due_on >= ${from}::date AND t.first_due_on <= ${to}::date
    ORDER BY t.first_due_on, t.id`);
  const rows = rowsOf(res);
  const moves = await dueMovesOf(rows.map((r) => r.id as string));
  const out: LedgerLine[] = [];
  for (const r of rows) {
    const outcome = (r.outcome as LedgerLine["outcome"]) ?? null;
    const openOverdue = r.open_overdue === true;
    const list = moves.get(r.id as string) ?? [];
    const counted = outcome !== null || openOverdue;
    if (!counted && list.length === 0) continue;
    out.push({
      id: r.id as string,
      ownerId: r.owner_id as string,
      title: r.title as string,
      firstDueOn: r.first_due_on as string,
      dueOn: r.due_on as string,
      closedOn: (r.closed_on as string | null) ?? null,
      outcome,
      openOverdue,
      counted,
      moves: list,
    });
  }
  return out;
}

// Who owes whom, for the Owed matrix. One edge per open task per pair, so a task counts once in a cell.
// "blocked": the task waits on that person (blocked_on_id). "set": a lead of the team created it for someone else.
// The log keeps who created a task, not who assigned it, so created_by stands in for "set by".
export type OwedEdge = { taskId: string; ownerId: string; toId: string; via: "blocked" | "set" };

export async function owedEdges(teamId: string): Promise<OwedEdge[]> {
  const db = getDb();
  const [open, leads] = await Promise.all([
    db
      .select({ id: tasks.id, ownerId: tasks.ownerId, blockedOnId: tasks.blockedOnId, createdBy: tasks.createdBy })
      .from(tasks)
      .where(and(eq(tasks.teamId, teamId), eq(tasks.statusCategory, "open")))
      .orderBy(asc(tasks.dueOn), asc(tasks.id)),
    db.select({ id: teamMembers.personId }).from(teamMembers).where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.appRole, "lead"))),
  ]);
  const lead = new Set(leads.map((l) => l.id));
  const out: OwedEdge[] = [];
  for (const t of open) {
    if (t.blockedOnId && t.blockedOnId !== t.ownerId) out.push({ taskId: t.id, ownerId: t.ownerId, toId: t.blockedOnId, via: "blocked" });
    if (t.createdBy && lead.has(t.createdBy) && t.createdBy !== t.ownerId && t.createdBy !== t.blockedOnId) {
      out.push({ taskId: t.id, ownerId: t.ownerId, toId: t.createdBy, via: "set" });
    }
  }
  return out;
}

// Open tasks of a team whose date is before today, oldest date first. Monday mode lists them to carry or close.
// The row keeps version and origin, because the actions need the version and refuse a task that comes from a Sheet.
export async function openPastDue(teamId: string, today: string): Promise<Task[]> {
  return getDb()
    .select()
    .from(tasks)
    .where(and(eq(tasks.teamId, teamId), eq(tasks.statusCategory, "open"), lt(tasks.dueOn, today)))
    .orderBy(asc(tasks.dueOn), asc(tasks.id));
}

type PersonRow = typeof people.$inferSelect;
export type AskRow = { task: Task; askedBy: PersonRow; forTaskTitle: string | null };
export type WaitingRow = { task: Task; owner: PersonRow; forTaskTitle: string | null };

// Asks that wait on this person to answer (ask_state = 'asked'), soonest date first.
export async function asksOf(personId: string): Promise<AskRow[]> {
  const forTask = alias(tasks, "for_task");
  const rows = await getDb()
    .select({ task: tasks, askedBy: people, forTaskTitle: forTask.title })
    .from(tasks)
    .innerJoin(people, eq(people.id, tasks.askedById))
    .leftJoin(forTask, eq(forTask.id, tasks.forTaskId))
    .where(and(eq(tasks.ownerId, personId), eq(tasks.askState, "asked"), eq(tasks.statusCategory, "open")))
    .orderBy(asc(tasks.dueOn), asc(tasks.id));
  return rows;
}

// Open asks this person made of other people (asked or accepted), with the owner. Returned asks are not here:
// they are back with the asker.
export async function waitingOn(personId: string): Promise<WaitingRow[]> {
  const forTask = alias(tasks, "for_task");
  const rows = await getDb()
    .select({ task: tasks, owner: people, forTaskTitle: forTask.title })
    .from(tasks)
    .innerJoin(people, eq(people.id, tasks.ownerId))
    .leftJoin(forTask, eq(forTask.id, tasks.forTaskId))
    .where(
      and(
        eq(tasks.askedById, personId),
        ne(tasks.ownerId, personId),
        inArray(tasks.askState, ["asked", "accepted"]),
        eq(tasks.statusCategory, "open"),
      ),
    )
    .orderBy(asc(tasks.dueOn), asc(tasks.id));
  return rows;
}
