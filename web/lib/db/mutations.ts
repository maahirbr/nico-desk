// Writes. Every helper changes the task row and writes its event rows in ONE transaction (R8).
// Pass `version` to get optimistic concurrency: a stale version throws DeskError("stale_version").
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "./client";
import { isIsoDate, istDay, todayIST } from "./dates";
import { events, notices, people, tasks, teamMembers } from "./schema";

export type Task = typeof tasks.$inferSelect;
type TaskPatch = Partial<typeof tasks.$inferInsert>;
type Db = ReturnType<typeof getDb>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type EventInsert = typeof events.$inferInsert;
type Health = NonNullable<Task["health"]>;
type Priority = NonNullable<Task["priority"]>;

export type DeskErrorCode =
  | "not_found"
  | "invalid"
  | "reason_required"
  | "red_rule"
  | "not_open"
  | "not_closed"
  | "not_lead"
  | "not_owner"
  | "not_pending"
  | "stale_version";

export class DeskError extends Error {
  constructor(
    public code: DeskErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DeskError";
  }
}

// ---- small helpers ----

let eventSeq = 0;
// Ids sort in write order, so events with the same `at` keep their order in taskLog.
function newEventId() {
  eventSeq = (eventSeq + 1) % 1_679_616;
  const t = Date.now().toString(36).padStart(9, "0");
  const n = eventSeq.toString(36).padStart(4, "0");
  return `evt_${t}${n}${Math.random().toString(36).slice(2, 5)}`;
}

function newTaskId() {
  return `tsk_${Math.random().toString(36).slice(2, 10)}`;
}

const snake = (k: string) => k.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);

function cleanText(label: string, value: string | undefined, min: number, max: number) {
  const v = (value ?? "").trim();
  if (v.length < min || v.length > max) {
    throw new DeskError(min > 0 ? "reason_required" : "invalid", `${label} must be ${min} to ${max} characters`);
  }
  return v;
}

function requireDate(label: string, value: string | undefined): string {
  if (!value || !isIsoDate(value)) throw new DeskError("invalid", `${label} must be a date (YYYY-MM-DD)`);
  return value;
}

async function loadTask(tx: Tx, id: string): Promise<Task> {
  const [row] = await tx.select().from(tasks).where(eq(tasks.id, id));
  if (!row) throw new DeskError("not_found", `task ${id} not found`);
  return row;
}

function mustBeOpen(task: Task) {
  if (task.statusCategory !== "open") throw new DeskError("not_open", "task is closed");
}

async function mustBeLead(tx: Tx, teamId: string, personId: string) {
  const [row] = await tx
    .select({ p: teamMembers.personId })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.personId, personId), eq(teamMembers.appRole, "lead")));
  if (!row) throw new DeskError("not_lead", "only a lead may do this");
}

type WriteOpts = {
  changes: TaskPatch; // each changed key writes one event
  silent?: TaskPatch; // columns set with the change but without their own event
  actorId: string;
  at: string;
  version?: number;
  reasonFields?: string[]; // event fields that carry `reason`
  reason?: string;
  leadEvents?: EventInsert[]; // written before the field events, e.g. _reopened
};

// Updates the task and appends its events. Skips untouched fields. Bumps version.
async function writeChanges(tx: Tx, task: Task, o: WriteOpts): Promise<Task> {
  const current = task as Record<string, unknown>;
  const changed = Object.entries(o.changes).filter(([k, v]) => (current[k] ?? null) !== (v ?? null));
  if (changed.length === 0 && !o.leadEvents?.length) return task;
  const reasonFields = new Set(o.reasonFields ?? []);
  const rows: EventInsert[] = [
    ...(o.leadEvents ?? []),
    ...changed.map(([k, v]) => ({
      id: newEventId(),
      entityType: "task" as const,
      entityId: task.id,
      field: snake(k),
      before: current[k] ?? null,
      after: v ?? null,
      reason: reasonFields.has(snake(k)) ? o.reason : undefined,
      actorId: o.actorId,
      origin: "app" as const,
      at: o.at,
    })),
  ];
  const expected = o.version ?? task.version;
  const [updated] = await tx
    .update(tasks)
    .set({ ...Object.fromEntries(changed), ...o.silent, version: sql`${tasks.version} + 1` })
    .where(and(eq(tasks.id, task.id), eq(tasks.version, expected)))
    .returning();
  if (!updated) throw new DeskError("stale_version", "task changed since you loaded it");
  await tx.insert(events).values(rows);
  return updated;
}

async function inTask<T>(taskId: string, fn: (tx: Tx, task: Task) => Promise<T>): Promise<T> {
  return getDb().transaction(async (tx) => fn(tx, await loadTask(tx, taskId)));
}

// ---- mutations ----

export type CreateTaskInput = {
  teamId: string;
  title: string;
  ownerId: string;
  dueOn: string;
  projectId?: string | null;
  note?: string | null;
  byPersonId: string;
  // A task made from an approved note draft passes origin "notes" and "<note id>#<draft id>".
  origin?: "app" | "notes";
  originRef?: string | null;
};

export async function createTask(input: CreateTaskInput): Promise<Task> {
  return getDb().transaction((tx) => createTaskIn(tx, input));
}

// Same as createTask, inside a transaction the caller owns (so a draft approval is one commit).
export async function createTaskIn(tx: Tx, input: CreateTaskInput): Promise<Task> {
  const title = cleanText("title", input.title, 3, 200);
  const dueOn = requireDate("due date", input.dueOn);
  const note = input.note ? cleanText("note", input.note, 0, 200) : null;
  const at = new Date().toISOString();
  const taskOrigin = input.origin ?? "app";
  const [owner] = await tx
    .select({ id: people.id })
    .from(people)
    .innerJoin(teamMembers, eq(teamMembers.personId, people.id))
    .where(and(eq(people.id, input.ownerId), eq(people.active, true), eq(teamMembers.teamId, input.teamId)));
  if (!owner) throw new DeskError("invalid", "owner must be an active person on the team roster");
  const row: typeof tasks.$inferInsert = {
    id: newTaskId(),
    teamId: input.teamId,
    title,
    ownerId: input.ownerId,
    projectId: input.projectId ?? null,
    firstDueOn: dueOn,
    dueOn,
    note,
    health: "not_started",
    status: "open",
    statusCategory: "open",
    origin: taskOrigin,
    originRef: taskOrigin === "app" ? null : (input.originRef ?? null),
    createdBy: input.byPersonId,
    createdAt: at,
    version: 1,
  };
  const [created] = await tx.insert(tasks).values(row).returning();
  const after = Object.fromEntries(Object.entries(created).filter(([k]) => k !== "searchTsv").map(([k, v]) => [snake(k), v]));
  await tx.insert(events).values({
    id: newEventId(),
    entityType: "task",
    entityId: created.id,
    field: "_created",
    before: null,
    after,
    actorId: input.byPersonId,
    origin: taskOrigin,
    at,
  });
  return created;
}

export async function renegotiate(
  taskId: string,
  a: { dueOn: string; reason: string; byPersonId: string; version?: number },
): Promise<Task> {
  const reason = cleanText("reason", a.reason, 10, 280);
  const dueOn = requireDate("new due date", a.dueOn);
  return inTask(taskId, async (tx, task) => {
    mustBeOpen(task);
    if (dueOn === task.dueOn) throw new DeskError("invalid", "new due date must differ from the current one");
    return writeChanges(tx, task, {
      changes: { dueOn },
      reasonFields: ["due_on"],
      reason,
      actorId: a.byPersonId,
      at: new Date().toISOString(),
      version: a.version,
    });
  });
}

// The Red rule (FR-12): off_track needs a new due date (today or later) and a reason, in one call.
export async function setHealth(
  taskId: string,
  a: { health: Health; dueOn?: string; reason?: string; byPersonId: string; version?: number },
): Promise<Task> {
  return inTask(taskId, async (tx, task) => {
    mustBeOpen(task);
    const changes: TaskPatch = { health: a.health };
    let reason: string | undefined;
    if (a.health === "off_track" && task.health !== "off_track") {
      if (!a.dueOn || !a.reason) throw new DeskError("red_rule", "off_track needs a new due date and a reason");
      const dueOn = requireDate("new due date", a.dueOn);
      if (dueOn < todayIST()) throw new DeskError("red_rule", "new due date must be today or later");
      if (dueOn === task.dueOn) throw new DeskError("red_rule", "new due date must differ from the current one");
      reason = cleanText("reason", a.reason, 10, 280);
      changes.dueOn = dueOn;
    }
    return writeChanges(tx, task, {
      changes,
      reasonFields: ["due_on"],
      reason,
      actorId: a.byPersonId,
      at: new Date().toISOString(),
      version: a.version,
    });
  });
}

export async function close(
  taskId: string,
  a: { as: "done" | "dropped"; reason?: string; byPersonId: string; version?: number },
): Promise<Task> {
  const now = new Date();
  return inTask(taskId, async (tx, task) => {
    mustBeOpen(task);
    if (a.as === "done") {
      return writeChanges(tx, task, {
        changes: { status: "done", statusCategory: "done", closedAt: now.toISOString(), closedOn: istDay(now) },
        actorId: a.byPersonId,
        at: now.toISOString(),
        version: a.version,
      });
    }
    const reason = cleanText("reason", a.reason, 1, 280);
    return writeChanges(tx, task, {
      changes: { status: "dropped", statusCategory: "dropped" },
      reasonFields: ["status", "status_category"],
      reason,
      actorId: a.byPersonId,
      at: now.toISOString(),
      version: a.version,
    });
  });
}

export async function reopen(
  taskId: string,
  a: { reason: string; byPersonId: string; version?: number },
): Promise<Task> {
  const reason = cleanText("reason", a.reason, 1, 280);
  return inTask(taskId, async (tx, task) => {
    await mustBeLead(tx, task.teamId, a.byPersonId);
    if (task.statusCategory === "open") throw new DeskError("not_closed", "task is already open");
    const at = new Date().toISOString();
    return writeChanges(tx, task, {
      changes: { status: "open", statusCategory: "open", closedAt: null, closedOn: null },
      leadEvents: [
        {
          id: newEventId(),
          entityType: "task",
          entityId: task.id,
          field: "_reopened",
          before: task.statusCategory,
          after: "open",
          reason,
          actorId: a.byPersonId,
          origin: "app",
          at,
        },
      ],
      actorId: a.byPersonId,
      at,
      version: a.version,
    });
  });
}

export async function setPriority(
  taskId: string,
  a: { priority: Priority; byPersonId: string; version?: number },
): Promise<Task> {
  return inTask(taskId, async (tx, task) => {
    await mustBeLead(tx, task.teamId, a.byPersonId);
    const at = new Date().toISOString();
    return writeChanges(tx, task, {
      changes: { priority: a.priority },
      silent: { prioritySetBy: a.byPersonId, prioritySetAt: at },
      actorId: a.byPersonId,
      at,
      version: a.version,
    });
  });
}

// Raise a block with blockedOnId and ask, or clear it with blockedOnId = null (note is optional).
export async function setBlockedOn(
  taskId: string,
  a: { blockedOnId: string | null; ask?: string; note?: string; byPersonId: string; version?: number },
): Promise<Task> {
  return inTask(taskId, async (tx, task) => {
    mustBeOpen(task);
    const at = new Date().toISOString();
    const raising = a.blockedOnId !== null;
    const ask = raising ? cleanText("ask", a.ask, 10, 280) : null;
    const note = !raising && a.note ? cleanText("note", a.note, 1, 280) : undefined;
    if (raising) {
      // FR-23: the named person must be active, on the roster, and not the owner.
      const [who] = await tx
        .select({ id: people.id })
        .from(people)
        .innerJoin(teamMembers, eq(teamMembers.personId, people.id))
        .where(and(eq(people.id, a.blockedOnId!), eq(people.active, true), eq(teamMembers.teamId, task.teamId)));
      if (!who || a.blockedOnId === task.ownerId) {
        throw new DeskError("invalid", "name an active person on the roster other than the owner");
      }
    }
    const saved = await writeChanges(tx, task, {
      changes: { blockedOnId: a.blockedOnId, blockedAsk: ask },
      silent: { blockedAt: raising ? at : null },
      reasonFields: ["blocked_on_id", "blocked_ask"],
      reason: note,
      actorId: a.byPersonId,
      at,
      version: a.version,
    });
    if (raising) {
      await tx
        .insert(notices)
        .values({
          id: `ntc_${Math.random().toString(36).slice(2, 10)}`,
          personId: a.blockedOnId!,
          taskId: task.id,
          kind: "blocked_on_you",
          forDate: todayIST(),
          createdAt: at,
        })
        .onConflictDoNothing();
    }
    return saved;
  });
}

// Sets the one-line note (200 characters). Each edit is an event (FR-4).
export async function appendNoteToTask(
  taskId: string,
  a: { note: string; byPersonId: string; version?: number },
): Promise<Task> {
  const note = cleanText("note", a.note, 1, 200);
  return inTask(taskId, async (tx, task) =>
    writeChanges(tx, task, { changes: { note }, actorId: a.byPersonId, at: new Date().toISOString(), version: a.version }),
  );
}

// A free update for the log (FR-21). No task field changes, so no version bump.
export async function addUpdate(taskId: string, a: { text: string; byPersonId: string }): Promise<void> {
  const text = cleanText("update", a.text, 1, 280);
  await inTask(taskId, async (tx, task) => {
    await tx.insert(events).values({
      id: newEventId(),
      entityType: "task",
      entityId: task.id,
      field: "_update",
      before: null,
      after: text,
      actorId: a.byPersonId,
      origin: "app",
      at: new Date().toISOString(),
    });
  });
}

// ---- asks (docs/DESIGN-HANDOUT.md 4.3) ----
// An ask is a task owned by the person who must answer and asked by the person who needs it.
// ask_state: asked (waiting for the owner), accepted (the owner said yes or later), returned (sent back).

async function mustBeRosterPerson(tx: Tx, teamId: string, personId: string, label: string) {
  const [row] = await tx
    .select({ id: people.id })
    .from(people)
    .innerJoin(teamMembers, eq(teamMembers.personId, people.id))
    .where(and(eq(people.id, personId), eq(people.active, true), eq(teamMembers.teamId, teamId)));
  if (!row) throw new DeskError("invalid", `${label} must be an active person on the team roster`);
}

export type CreateAskInput = {
  askedById: string;
  ownerId: string;
  title: string;
  dueOn: string;
  forTaskId?: string | null;
  teamId: string;
};

export async function createAsk(input: CreateAskInput): Promise<Task> {
  const title = cleanText("title", input.title, 3, 200);
  const dueOn = requireDate("due date", input.dueOn);
  if (input.askedById === input.ownerId) throw new DeskError("invalid", "an ask must be made of someone else");
  return getDb().transaction(async (tx) => {
    await mustBeRosterPerson(tx, input.teamId, input.ownerId, "owner");
    await mustBeRosterPerson(tx, input.teamId, input.askedById, "asker");
    let projectId: string | null = null;
    if (input.forTaskId) {
      const forTask = await loadTask(tx, input.forTaskId);
      if (forTask.teamId !== input.teamId) throw new DeskError("invalid", "the line this ask unblocks is on another team");
      projectId = forTask.projectId; // the ask sits in the same project as the line it unblocks
    }
    const at = new Date().toISOString();
    const [created] = await tx
      .insert(tasks)
      .values({
        id: newTaskId(),
        teamId: input.teamId,
        title,
        ownerId: input.ownerId,
        projectId,
        firstDueOn: dueOn,
        dueOn,
        health: "on_track",
        status: "open",
        statusCategory: "open",
        origin: "app",
        originRef: null,
        createdBy: input.askedById,
        createdAt: at,
        askedById: input.askedById,
        forTaskId: input.forTaskId ?? null,
        askState: "asked",
        version: 1,
      })
      .returning();
    const after = Object.fromEntries(Object.entries(created).filter(([k]) => k !== "searchTsv").map(([k, v]) => [snake(k), v]));
    await tx.insert(events).values({
      id: newEventId(),
      entityType: "task",
      entityId: created.id,
      field: "_created",
      before: null,
      after,
      actorId: input.askedById,
      origin: "app",
      at,
    });
    return created;
  });
}

// Only the owner answers, and only while the ask is waiting (ask_state = 'asked').
function mustBeAskedOwner(task: Task, personId: string) {
  mustBeOpen(task);
  if (task.askState !== "asked") throw new DeskError("not_pending", "this ask is not waiting for an answer");
  if (task.ownerId !== personId) throw new DeskError("not_owner", "only the person asked may answer");
}

// "Yes, by then", or "yes, by this date": a date the owner picks becomes the first date on record.
// The first_due_on lock is open for this one move (0002_ask.sql), and only together with due_on.
export async function acceptAsk(
  taskId: string,
  a: { byPersonId: string; dueOn?: string; version?: number },
): Promise<Task> {
  const picked = a.dueOn === undefined ? undefined : requireDate("due date", a.dueOn);
  return inTask(taskId, async (tx, task) => {
    mustBeAskedOwner(task, a.byPersonId);
    const pick = picked !== undefined && picked !== task.dueOn;
    const changes: TaskPatch = { askState: "accepted" };
    if (pick) {
      changes.firstDueOn = picked;
      changes.dueOn = picked;
    }
    return writeChanges(tx, task, {
      changes,
      reasonFields: ["first_due_on", "due_on"],
      reason: pick ? "Date picked by the owner when saying yes" : undefined,
      actorId: a.byPersonId,
      at: new Date().toISOString(),
      version: a.version,
    });
  });
}

// "Later, because": the ask is accepted for a later date. first_due_on stays the asked date, so the
// record still judges the answer against it. The move needs a reason and turns the line off_track.
export async function acceptAskLater(
  taskId: string,
  a: { byPersonId: string; dueOn: string; reason: string; version?: number },
): Promise<Task> {
  const reason = cleanText("reason", a.reason, 10, 280);
  const dueOn = requireDate("new due date", a.dueOn);
  return inTask(taskId, async (tx, task) => {
    mustBeAskedOwner(task, a.byPersonId);
    if (dueOn <= task.dueOn) throw new DeskError("invalid", "a later date must be after the asked date");
    return writeChanges(tx, task, {
      changes: { askState: "accepted", health: "off_track", dueOn },
      reasonFields: ["due_on"],
      reason,
      actorId: a.byPersonId,
      at: new Date().toISOString(),
      version: a.version,
    });
  });
}

// "Not me, because": a reason is required. With toPersonId the ask moves to that person and stays asked,
// still asked by the same person. Without it the ask goes back to the asker as returned.
export async function declineAsk(
  taskId: string,
  a: { byPersonId: string; reason: string; toPersonId?: string | null; version?: number },
): Promise<Task> {
  const reason = cleanText("reason", a.reason, 10, 280);
  return inTask(taskId, async (tx, task) => {
    mustBeAskedOwner(task, a.byPersonId);
    const changes: TaskPatch = {};
    if (a.toPersonId) {
      if (a.toPersonId === task.ownerId || a.toPersonId === task.askedById) {
        throw new DeskError("invalid", "hand the ask to someone other than yourself or the asker");
      }
      await mustBeRosterPerson(tx, task.teamId, a.toPersonId, "new owner");
      changes.ownerId = a.toPersonId;
    } else {
      if (!task.askedById) throw new DeskError("invalid", "this task is not an ask");
      changes.ownerId = task.askedById;
      changes.askState = "returned";
    }
    return writeChanges(tx, task, {
      changes,
      reasonFields: ["owner_id"],
      reason,
      actorId: a.byPersonId,
      at: new Date().toISOString(),
      version: a.version,
    });
  });
}
