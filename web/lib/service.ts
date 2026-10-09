import type { Db, Tx } from './db';
import { derive, type AskState, type EventRow, type Health, type Task, type TaskRow } from './derive';
import { ApiError, bad, forbidden, notFound } from './errors';
import { addDays, istDate, mondayOf, today as todayIst } from './time';

// Every write goes through here, so the rules in SPEC.md section 2 hold for the API and the pages alike.

export type Person = {
  id: string;
  displayName: string;
  role: string;
  department: string;
  email: string;
  active: boolean;
  appRoles: AppRole[];
};
export type AppRole = 'member' | 'lead' | 'admin';

let seq = 0;
export function newId(prefix: string): string {
  seq = (seq + 1) % 1296;
  return `${prefix}_${Date.now().toString(36)}${seq.toString(36).padStart(2, '0')}${Math.random().toString(36).slice(2, 6)}`;
}

const REASON_MIN = 10;
const REASON_MAX = 280;

function needReason(reason: unknown, field = 'reason'): string {
  const r = typeof reason === 'string' ? reason.trim() : '';
  if (r.length < REASON_MIN || r.length > REASON_MAX)
    throw bad('reason_required', `A reason of ${REASON_MIN} to ${REASON_MAX} characters is required.`, field);
  return r;
}

// ---------- people and roles ----------

type PersonRow = { id: string; display_name: string; role: string; department: string; email: string; active: boolean; app_roles: AppRole[] | null };

function toPerson(r: PersonRow): Person {
  return {
    id: r.id, displayName: r.display_name, role: r.role, department: r.department, email: r.email, active: r.active,
    appRoles: r.app_roles ?? [],
  };
}

const PERSON_SQL = `
  SELECT p.*, array_remove(array_agg(m.app_role ORDER BY m.app_role), NULL) AS app_roles
  FROM people p LEFT JOIN team_members m ON m.person_id = p.id AND m.team_id = $1`;

export async function listPeople(db: Tx, teamId: string): Promise<Person[]> {
  const { rows } = await db.query<PersonRow>(
    `${PERSON_SQL} WHERE p.id IN (SELECT person_id FROM team_members WHERE team_id = $1) GROUP BY p.id ORDER BY p.display_name`,
    [teamId],
  );
  return rows.map(toPerson);
}

export async function getPerson(db: Tx, teamId: string, id: string): Promise<Person | null> {
  const { rows } = await db.query<PersonRow>(`${PERSON_SQL} WHERE p.id = $2 GROUP BY p.id`, [teamId, id]);
  return rows[0] ? toPerson(rows[0]) : null;
}

export async function findPersonByEmail(db: Tx, email: string): Promise<{ id: string; active: boolean } | null> {
  const { rows } = await db.query<{ id: string; active: boolean }>(
    `SELECT id, active FROM people WHERE lower(email) = lower($1)`,
    [email],
  );
  return rows[0] ?? null;
}

export async function teamsOf(db: Tx, personId: string): Promise<{ id: string; name: string; teamType: string }[]> {
  const { rows } = await db.query<{ id: string; name: string; team_type: string }>(
    `SELECT DISTINCT t.* FROM teams t JOIN team_members m ON m.team_id = t.id WHERE m.person_id = $1 ORDER BY t.name`,
    [personId],
  );
  return rows.map((r) => ({ id: r.id, name: r.name, teamType: r.team_type }));
}

async function rolesIn(db: Tx, teamId: string, personId: string): Promise<Set<AppRole>> {
  const { rows } = await db.query<{ app_role: AppRole }>(
    `SELECT m.app_role FROM team_members m JOIN people p ON p.id = m.person_id
     WHERE m.team_id = $1 AND m.person_id = $2 AND p.active`,
    [teamId, personId],
  );
  return new Set(rows.map((r) => r.app_role));
}

async function activeMember(db: Tx, teamId: string, personId: string, field: string): Promise<void> {
  const roles = await rolesIn(db, teamId, personId);
  if (roles.size === 0) throw bad('owner_not_on_roster', 'That person is not an active member of this team.', field);
}

export async function listProjects(db: Tx, teamId: string): Promise<{ id: string; name: string }[]> {
  const { rows } = await db.query<{ id: string; name: string }>(
    `SELECT id, name FROM projects WHERE team_id = $1 ORDER BY name`,
    [teamId],
  );
  return rows;
}

// ---------- reading tasks ----------

// The desk holds tasks and agreed asks. An ask still waiting, or closed without a task, stays off it
// (listAsks and getTask still see it).
const ON_DESK = `(ask_state IS NULL OR ask_state = 'accepted')`;

async function loadTasks(db: Tx, where: string, params: unknown[], today: string, deskOnly = true): Promise<Task[]> {
  const { rows } = await db.query<TaskRow>(`SELECT * FROM tasks WHERE ${where}${deskOnly ? ` AND ${ON_DESK}` : ''}`, params);
  if (rows.length === 0) return [];
  const { rows: events } = await db.query<EventRow>(
    `SELECT * FROM events WHERE entity_type = 'task' AND entity_id = ANY($1) AND field = 'due_on' ORDER BY at, id`,
    [rows.map((r) => r.id)],
  );
  const byTask = new Map<string, EventRow[]>();
  for (const e of events) byTask.set(e.entity_id, [...(byTask.get(e.entity_id) ?? []), e]);
  return rows.map((r) => derive(r, byTask.get(r.id) ?? [], today));
}

export async function getTask(db: Tx, id: string, today = todayIst()): Promise<Task> {
  const [t] = await loadTasks(db, 'id = $1', [id], today, false);
  if (!t) throw notFound('No such task.');
  return t;
}

export async function teamTasks(db: Tx, teamId: string, today = todayIst()): Promise<Task[]> {
  return loadTasks(db, 'team_id = $1', [teamId], today);
}

export type LogLine = EventRow & { actorName: string | null };

export async function taskLog(db: Tx, taskId: string, before?: string, limit = 50): Promise<LogLine[]> {
  const { rows } = await db.query<LogLine>(
    `SELECT e.*, p.display_name AS "actorName" FROM events e LEFT JOIN people p ON p.id = e.actor_id
     WHERE e.entity_type = 'task' AND e.entity_id = $1
       AND ($2::text IS NULL OR (e.at, e.id) < (SELECT at, id FROM events WHERE id = $2))
     ORDER BY e.at DESC, e.id DESC LIMIT $3`,
    [taskId, before ?? null, Math.min(Math.max(limit, 1), 200)],
  );
  return rows;
}

// ---------- writing tasks ----------

type Ctx = { row: TaskRow; roles: Set<AppRole>; meId: string; isOwner: boolean; isLead: boolean };
type Change = { set: Partial<TaskRow>; reasons?: Partial<Record<keyof TaskRow, string>>; extra?: { field: string; after: unknown }[] };

async function insertEvent(
  tx: Tx,
  e: { entityId: string; field: string; before: unknown; after: unknown; reason?: string | null; actorId: string | null; at: string },
) {
  const j = (v: unknown) => (v === null || v === undefined ? null : JSON.stringify(v));
  await tx.query(
    `INSERT INTO events (id, entity_type, entity_id, field, before, after, reason, actor_id, origin, at)
     VALUES ($1, 'task', $2, $3, $4::jsonb, $5::jsonb, $6, $7, 'app', $8)`,
    [newId('evt'), e.entityId, e.field, j(e.before), j(e.after), e.reason ?? null, e.actorId, e.at],
  );
}

async function notice(tx: Tx, personId: string, taskId: string, kind: string, forDate: string) {
  await tx.query(
    `INSERT INTO notices (id, person_id, task_id, kind, for_date, created_at) VALUES ($1,$2,$3,$4,$5,now())
     ON CONFLICT (person_id, task_id, kind, for_date) DO NOTHING`,
    [newId('ntc'), personId, taskId, kind, forDate],
  );
}

// Fields written in this order, so the Red rule logs health before due_on (SPEC.md 3.5).
const ORDER: (keyof TaskRow)[] = [
  'title', 'description', 'note', 'project_id', 'workstream', 'owner_id', 'health', 'due_on', 'status', 'status_category', 'closed_at',
  'blocked_on_id', 'blocked_ask', 'blocked_at', 'priority', 'priority_set_by', 'priority_set_at',
];
// Columns that are bookkeeping for another field, not events of their own.
const SILENT = new Set<keyof TaskRow>(['blocked_at', 'priority_set_by', 'priority_set_at']);

async function mutate(
  db: Db,
  meId: string,
  taskId: string,
  version: number,
  allow: (c: Ctx) => boolean,
  build: (c: Ctx) => Change,
  after?: (tx: Tx, c: Ctx) => Promise<void>,
): Promise<Task> {
  await db.transaction(async (tx) => {
    const { rows } = await tx.query<TaskRow>(`SELECT * FROM tasks WHERE id = $1 FOR UPDATE`, [taskId]);
    const row = rows[0];
    if (!row) throw notFound('No such task.');
    const roles = await rolesIn(tx, row.team_id, meId);
    if (roles.size === 0) throw forbidden('You are not on this task’s team.');
    if (row.origin === 'sheet') throw new ApiError(403, 'read_only_mirror', 'This task comes from a Sheet. Edit it there.');
    if (row.version !== version) throw new ApiError(409, 'version_conflict', 'Someone changed this task. Reload and try again.');
    if (row.ask_state && row.ask_state !== 'accepted') throw bad('ask_open', 'This ask is not agreed yet. Answer it first.');
    const ctx: Ctx = { row, roles, meId, isOwner: row.owner_id === meId, isLead: roles.has('lead') };
    if (!allow(ctx)) throw forbidden();
    const change = build(ctx);
    const at = new Date().toISOString();
    const fields = ORDER.filter((f) => f in change.set && change.set[f] !== row[f]);
    if (fields.length === 0 && !change.extra?.length) throw bad('no_change', 'Nothing to change.');
    if (fields.length) {
      const sets = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
      await tx.query(`UPDATE tasks SET ${sets}, version = version + 1 WHERE id = $1`, [taskId, ...fields.map((f) => change.set[f])]);
    }
    for (const f of fields) {
      if (SILENT.has(f)) continue;
      await insertEvent(tx, {
        entityId: taskId, field: f, before: row[f], after: change.set[f], reason: change.reasons?.[f] ?? null, actorId: meId, at,
      });
    }
    for (const x of change.extra ?? []) {
      await insertEvent(tx, { entityId: taskId, field: x.field, before: null, after: x.after, reason: null, actorId: meId, at });
    }
    if (after) await after(tx, ctx);
  });
  return getTask(db, taskId);
}

export type CreateInput = { teamId: string; title: string; description?: string | null; ownerId: string; dueOn: string; projectId?: string | null; workstream?: string | null; note?: string | null };

export async function createTask(db: Db, meId: string, input: CreateInput): Promise<Task> {
  const today = todayIst();
  if (input.dueOn < today) throw bad('date_in_past', 'The due date must be today or later.', 'dueOn');
  const id = newId('tsk');
  await db.transaction(async (tx) => {
    const roles = await rolesIn(tx, input.teamId, meId);
    if (roles.size === 0) throw forbidden('You are not on this team.');
    await activeMember(tx, input.teamId, input.ownerId, 'ownerId');
    if (input.projectId) {
      const { rows } = await tx.query(`SELECT 1 FROM projects WHERE id = $1 AND team_id = $2`, [input.projectId, input.teamId]);
      if (!rows.length) throw bad('invalid_body', 'No such project on this team.', 'projectId');
    }
    const at = new Date().toISOString();
    const row = {
      title: input.title.trim(), description: input.description?.trim() || null, owner_id: input.ownerId, project_id: input.projectId ?? null, workstream: input.workstream?.trim() || null,
      first_due_on: input.dueOn, due_on: input.dueOn, note: input.note?.trim() || null, health: 'not_started',
      status: 'open', status_category: 'open', origin: 'app',
    };
    await tx.query(
      `INSERT INTO tasks (id, team_id, title, description, owner_id, project_id, workstream, first_due_on, due_on, note, health, status,
         status_category, origin, created_by, created_at)
       VALUES ($1,$2,$3,$16,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [id, input.teamId, row.title, row.owner_id, row.project_id, row.workstream, row.first_due_on, row.due_on, row.note, row.health,
        row.status, row.status_category, row.origin, meId, at, row.description],
    );
    await insertEvent(tx, { entityId: id, field: '_created', before: null, after: row, actorId: meId, at });
    if (input.ownerId !== meId) await notice(tx, input.ownerId, id, 'assigned', today);
  });
  return getTask(db, id);
}

export type EditInput = { version: number; title?: string; description?: string | null; note?: string | null; projectId?: string | null; workstream?: string | null; ownerId?: string };

export async function editTask(db: Db, meId: string, id: string, input: EditInput): Promise<Task> {
  return mutate(
    db, meId, id, input.version,
    (c) => {
      const may = c.isOwner || c.isLead || c.row.created_by === meId;
      if (!may) return false;
      if (input.ownerId !== undefined && input.ownerId !== c.row.owner_id && !c.isLead && !c.isOwner) return false;
      return true;
    },
    (c) => {
      const set: Partial<TaskRow> = {};
      if (input.title !== undefined) set.title = input.title.trim();
      if (input.description !== undefined) set.description = input.description?.trim() || null;
      if (input.note !== undefined) set.note = input.note?.trim() || null;
      if (input.projectId !== undefined) set.project_id = input.projectId;
      if (input.workstream !== undefined) set.workstream = input.workstream?.trim() || null;
      if (input.ownerId !== undefined) set.owner_id = input.ownerId;
      return { set };
    },
    async (tx, c) => {
      if (input.ownerId !== undefined && input.ownerId !== c.row.owner_id) {
        await activeMember(tx, c.row.team_id, input.ownerId, 'ownerId');
        if (input.ownerId !== meId) await notice(tx, input.ownerId, id, 'assigned', todayIst());
      }
      if (input.projectId) {
        const { rows } = await tx.query(`SELECT 1 FROM projects WHERE id = $1 AND team_id = $2`, [input.projectId, c.row.team_id]);
        if (!rows.length) throw bad('invalid_body', 'No such project on this team.', 'projectId');
      }
    },
  );
}

function checkNewDate(newDueOn: string | undefined, current: string): string {
  if (!newDueOn) throw bad('reason_required', 'A new date is required.', 'newDueOn');
  if (newDueOn < todayIst()) throw bad('date_in_past', 'The new date must be today or later.', 'newDueOn');
  if (newDueOn === current) throw bad('invalid_body', 'The new date is the same as the current one.', 'newDueOn');
  return newDueOn;
}

const openOnly = (c: Ctx) => {
  if (c.row.status_category !== 'open') throw bad('invalid_body', 'The task is closed. A lead can reopen it.');
};

// A person sets one of two working states: not started, or in progress (stored as on_track).
// Ahead, at risk and late are judged by the app from the dates, never picked (team decision,
// 9 Oct, replacing SPEC.md FR-10 to FR-12's picked health and Red rule). An early warning
// is a date move, which the ledger counts as moved in time.
export async function setHealth(
  db: Db, meId: string, id: string, input: { version: number; health: Health; reason?: string },
): Promise<Task> {
  return mutate(db, meId, id, input.version, (c) => c.isOwner || c.isLead, (c) => {
    openOnly(c);
    if (input.health !== 'not_started' && input.health !== 'on_track') {
      throw bad('invalid_body', 'Pick Not started or In progress. Ahead, at risk and late are worked out from the dates.', 'health');
    }
    // Starting work is a plain fact; going back to not started says why.
    if (input.health === 'not_started' && c.row.health !== 'not_started') {
      return { set: { health: 'not_started' }, reasons: { health: needReason(input.reason) } };
    }
    const note = input.reason?.trim().slice(0, 280);
    return { set: { health: input.health }, ...(note ? { reasons: { health: note } } : {}) };
  });
}

// FR-15, FR-16: the only way to change due_on.
export async function renegotiate(db: Db, meId: string, id: string, input: { version: number; newDueOn: string; reason: string }): Promise<Task> {
  return mutate(db, meId, id, input.version, (c) => c.isOwner || c.isLead, (c) => {
    openOnly(c);
    const reason = needReason(input.reason);
    return { set: { due_on: checkNewDate(input.newDueOn, c.row.due_on) }, reasons: { due_on: reason } };
  });
}

export async function closeTask(db: Db, meId: string, id: string, input: { version: number; as: 'done' | 'dropped'; reason?: string }): Promise<Task> {
  return mutate(db, meId, id, input.version, (c) => c.isOwner || c.isLead, (c) => {
    openOnly(c);
    if (input.as === 'done') {
      // Done is one tick; a note on what was delivered is welcome but not required.
      const note = input.reason?.trim().slice(0, 280);
      return {
        set: { status: 'done', status_category: 'done', closed_at: new Date().toISOString(), blocked_on_id: null, blocked_ask: null, blocked_at: null },
        ...(note ? { reasons: { status_category: note } } : {}),
      };
    }
    const reason = needReason(input.reason);
    return { set: { status: 'dropped', status_category: 'dropped', blocked_on_id: null, blocked_ask: null, blocked_at: null }, reasons: { status_category: reason } };
  });
}

export async function reopenTask(db: Db, meId: string, id: string, input: { version: number; reason: string }): Promise<Task> {
  const reason = needReason(input.reason);
  await db.transaction(async (tx) => {
    const { rows } = await tx.query<TaskRow>(`SELECT * FROM tasks WHERE id = $1 FOR UPDATE`, [id]);
    const row = rows[0];
    if (!row) throw notFound('No such task.');
    const roles = await rolesIn(tx, row.team_id, meId);
    if (row.origin === 'sheet') throw new ApiError(403, 'read_only_mirror', 'This task comes from a Sheet. Edit it there.');
    if (!roles.has('lead')) throw forbidden('Only a lead can reopen a task.');
    if (row.version !== input.version) throw new ApiError(409, 'version_conflict', 'Someone changed this task. Reload and try again.');
    if (row.status_category === 'open') throw bad('invalid_body', 'The task is already open.');
    const at = new Date().toISOString();
    await tx.query(
      `UPDATE tasks SET status = 'open', status_category = 'open', closed_at = NULL, health = COALESCE(health, 'on_track'),
         version = version + 1 WHERE id = $1`,
      [id],
    );
    await insertEvent(tx, { entityId: id, field: '_reopened', before: row.status_category, after: 'open', reason, actorId: meId, at });
    await insertEvent(tx, { entityId: id, field: 'status', before: row.status, after: 'open', actorId: meId, at });
    await insertEvent(tx, { entityId: id, field: 'status_category', before: row.status_category, after: 'open', actorId: meId, at });
    if (row.closed_at) await insertEvent(tx, { entityId: id, field: 'closed_at', before: row.closed_at, after: null, actorId: meId, at });
  });
  return getTask(db, id);
}

// FR-23 to FR-26
// A block always has a reason. Naming a person is optional: a block can be a supplier, a tool or a
// decision; when a person is named they get an in-app notice.
export async function blockTask(db: Db, meId: string, id: string, input: { version: number; onId?: string | null; ask: string }): Promise<Task> {
  const ask = input.ask.trim();
  const onId = input.onId || null;
  if (ask.length < 10 || ask.length > 280) throw bad('reason_required', 'Give a block reason (10 to 280 characters).', 'ask');
  return mutate(
    db, meId, id, input.version,
    (c) => c.isOwner,
    (c) => {
      openOnly(c);
      if (onId && onId === c.row.owner_id) throw bad('invalid_body', 'A task cannot be blocked on its own owner.', 'onId');
      return { set: { blocked_on_id: onId, blocked_ask: ask, blocked_at: new Date().toISOString() } };
    },
    async (tx, c) => {
      if (!onId) return;
      await activeMember(tx, c.row.team_id, onId, 'onId');
      await notice(tx, onId, id, 'blocked_on_you', todayIst());
    },
  );
}

export async function unblockTask(db: Db, meId: string, id: string, input: { version: number; note?: string }): Promise<Task> {
  return mutate(
    db, meId, id, input.version,
    (c) => c.isOwner || c.isLead || c.row.blocked_on_id === meId,
    (c) => {
      if (!c.row.blocked_ask) throw bad('invalid_body', 'The task is not blocked.');
      // Clearing a block is good news; a note on what unblocked it is welcome, not required.
      const note = input.note?.trim().slice(0, 280);
      return { set: { blocked_on_id: null, blocked_ask: null, blocked_at: null }, ...(note ? { reasons: { blocked_ask: note } } : {}) };
    },
  );
}

// FR-27, FR-28
export async function setPriority(db: Db, meId: string, id: string, input: { version: number; value: 'high' | 'normal' | 'low' }): Promise<Task> {
  return mutate(db, meId, id, input.version, (c) => c.isLead, () => ({
    set: { priority: input.value, priority_set_by: meId, priority_set_at: new Date().toISOString() },
  }));
}

// FR-21: a free update changes no field, so it takes no version.
export async function addUpdate(db: Db, meId: string, id: string, text: string): Promise<void> {
  const t = text.trim();
  if (t.length < 1 || t.length > 280) throw bad('invalid_body', 'An update is 1 to 280 characters.', 'text');
  await db.transaction(async (tx) => {
    const { rows } = await tx.query<TaskRow>(`SELECT * FROM tasks WHERE id = $1`, [id]);
    const row = rows[0];
    if (!row) throw notFound('No such task.');
    if (row.origin === 'sheet') throw new ApiError(403, 'read_only_mirror', 'This task comes from a Sheet. Edit it there.');
    const roles = await rolesIn(tx, row.team_id, meId);
    if (row.owner_id !== meId && !roles.has('lead')) throw forbidden();
    await insertEvent(tx, { entityId: id, field: '_update', before: null, after: t, actorId: meId, at: new Date().toISOString() });
  });
}

// ---------- asks (v2) ----------
// An ask is a task row that waits for an agreement. Asked: the owner has not answered. Yes sets the
// first date, once. A counter date waits for the asker. Can't closes it with a reason. Every step
// appends to the events log. Until agreed, an ask is off the desk (see ON_DESK).

export type AskInput = { teamId: string; title: string; toId: string; dueOn: string; description?: string | null; projectId?: string | null };

export async function createAsk(db: Db, meId: string, input: AskInput): Promise<Task> {
  const today = todayIst();
  if (input.dueOn < today) throw bad('date_in_past', 'The date must be today or later.', 'dueOn');
  if (input.toId === meId) throw bad('invalid_body', 'To give yourself a task, add a task. An ask goes to someone else.', 'toId');
  const id = newId('tsk');
  await db.transaction(async (tx) => {
    if ((await rolesIn(tx, input.teamId, meId)).size === 0) throw forbidden('You are not on this team.');
    await activeMember(tx, input.teamId, input.toId, 'toId');
    if (input.projectId) {
      const { rows } = await tx.query(`SELECT 1 FROM projects WHERE id = $1 AND team_id = $2`, [input.projectId, input.teamId]);
      if (!rows.length) throw bad('invalid_body', 'No such project on this team.', 'projectId');
    }
    const at = new Date().toISOString();
    const title = input.title.trim();
    const description = input.description?.trim() || null;
    await tx.query(
      `INSERT INTO tasks (id, team_id, title, description, owner_id, project_id, first_due_on, due_on, health, status, status_category,
         origin, created_by, created_at, ask_state, ask_due_on)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$7,'not_started','open','open','app',$8,$9,'asked',$7)`,
      [id, input.teamId, title, description, input.toId, input.projectId ?? null, input.dueOn, meId, at],
    );
    await insertEvent(tx, {
      entityId: id, field: '_created', before: null, actorId: meId, at,
      after: { title, owner_id: input.toId, project_id: input.projectId ?? null, due_on: input.dueOn, ask_state: 'asked', ask_due_on: input.dueOn },
    });
    await insertEvent(tx, { entityId: id, field: 'ask_state', before: null, after: 'asked', actorId: meId, at });
  });
  return getTask(db, id);
}

type Ev = { field: string; before: unknown; after: unknown; reason?: string | null };

// One locked step on an ask: the right person, the right version, the right state. `step` returns
// the columns to set and the events to write; the version rises by one.
async function askStep(
  db: Db, meId: string, id: string, version: number, who: 'owner' | 'asker', from: AskState,
  step: (row: TaskRow) => { set: Record<string, unknown>; events: Ev[] },
): Promise<Task> {
  await db.transaction(async (tx) => {
    const { rows } = await tx.query<TaskRow>(`SELECT * FROM tasks WHERE id = $1 FOR UPDATE`, [id]);
    const row = rows[0];
    if (!row || !row.ask_state) throw notFound('No such ask.');
    if ((await rolesIn(tx, row.team_id, meId)).size === 0) throw forbidden('You are not on this task’s team.');
    if ((who === 'owner' ? row.owner_id : row.created_by) !== meId)
      throw forbidden(who === 'owner' ? 'Only the person asked can answer.' : 'Only the person who asked can decide on a counter date.');
    if (row.version !== version) throw new ApiError(409, 'version_conflict', 'Someone changed this ask. Reload and try again.');
    if (row.ask_state !== from) throw bad('ask_state', from === 'asked' ? 'This ask is already answered.' : 'There is no counter date to decide on.');
    const { set, events } = step(row);
    const cols = Object.keys(set);
    await tx.query(
      `UPDATE tasks SET ${cols.map((c, i) => `${c} = $${i + 2}`).join(', ')}, version = version + 1 WHERE id = $1`,
      [id, ...cols.map((c) => set[c])],
    );
    const at = new Date().toISOString();
    for (const e of events) await insertEvent(tx, { entityId: id, ...e, actorId: meId, at });
  });
  return getTask(db, id);
}

export type AskAnswer =
  | { version: number; answer: 'yes' }
  | { version: number; answer: 'counter'; counterOn: string; reason?: string }
  | { version: number; answer: 'cant'; reason: string };

// The asked person answers. "Yes, by then" sets the first date, once. "Not by then" offers another
// date. "Can't" gives a reason.
export async function answerAsk(db: Db, meId: string, id: string, input: AskAnswer): Promise<Task> {
  return askStep(db, meId, id, input.version, 'owner', 'asked', (row) => {
    const asked = row.ask_due_on ?? row.first_due_on;
    if (input.answer === 'yes') {
      if (asked < todayIst()) throw bad('date_in_past', 'That date has passed. Offer a new date instead.');
      return {
        set: { ask_state: 'accepted', first_due_on: asked, due_on: asked },
        events: [
          { field: 'ask_state', before: 'asked', after: 'accepted' },
          { field: 'first_due_on', before: row.first_due_on, after: asked },
        ],
      };
    }
    if (input.answer === 'counter') {
      if (input.counterOn < todayIst()) throw bad('date_in_past', 'The new date must be today or later.', 'counterOn');
      if (input.counterOn === asked) throw bad('invalid_body', 'That is the date you were asked for. Answer yes instead.', 'counterOn');
      const note = input.reason?.trim().slice(0, 280) || null;
      return {
        set: { ask_state: 'countered', ask_counter_on: input.counterOn, ask_reason: note },
        events: [
          { field: 'ask_state', before: 'asked', after: 'countered', reason: note },
          { field: 'ask_counter_on', before: null, after: input.counterOn },
        ],
      };
    }
    const reason = needReason(input.reason);
    return {
      set: { ask_state: 'cant', ask_reason: reason },
      events: [{ field: 'ask_state', before: 'asked', after: 'cant', reason }],
    };
  });
}

// The asker takes or leaves the counter date. Taking it sets the first date, once, to that date.
export async function respondToCounter(db: Db, meId: string, id: string, input: { version: number; accept: boolean; reason?: string }): Promise<Task> {
  return askStep(db, meId, id, input.version, 'asker', 'countered', (row) => {
    if (!input.accept) {
      const note = input.reason?.trim().slice(0, 280) || null;
      return { set: { ask_state: 'declined' }, events: [{ field: 'ask_state', before: 'countered', after: 'declined', reason: note }] };
    }
    const on = row.ask_counter_on!;
    if (on < todayIst()) throw bad('date_in_past', 'That date has passed. Decline it and ask again.');
    return {
      set: { ask_state: 'accepted', first_due_on: on, due_on: on },
      events: [
        { field: 'ask_state', before: 'countered', after: 'accepted' },
        { field: 'first_due_on', before: row.first_due_on, after: on },
      ],
    };
  });
}

export type AskItem = Task & { answeredAt: string | null };

// /me: asks waiting for your answer, and asks you made with where each stands. Finished asks stay
// in "You asked" for a week, so the answer is seen.
export async function listAsks(db: Db, teamId: string, meId: string, today = todayIst()): Promise<{ ofMe: AskItem[]; byMe: AskItem[] }> {
  const tasks = await loadTasks(db, `team_id = $1 AND ask_state IS NOT NULL AND (owner_id = $2 OR created_by = $2)`, [teamId, meId], today, false);
  const answered = new Map<string, string>();
  if (tasks.length) {
    const { rows } = await db.query<{ entity_id: string; at: string }>(
      `SELECT entity_id, max(at) AS at FROM events WHERE entity_type = 'task' AND field = 'ask_state' AND after <> '"asked"'::jsonb
         AND entity_id = ANY($1) GROUP BY entity_id`,
      [tasks.map((t) => t.id)],
    );
    for (const r of rows) answered.set(r.entity_id, r.at);
  }
  const items: AskItem[] = tasks.map((t) => ({ ...t, answeredAt: answered.get(t.id) ?? null }));
  const recent = (t: AskItem) => !!t.answeredAt && istDate(t.answeredAt) >= addDays(today, -7);
  const rank = (t: AskItem) => ({ countered: 0, asked: 1, accepted: 2, cant: 2, declined: 2 })[t.ask!.state];
  return {
    ofMe: items.filter((t) => t.ownerId === meId && t.ask!.state === 'asked').sort((a, b) => a.dueOn.localeCompare(b.dueOn) || a.createdAt.localeCompare(b.createdAt)),
    byMe: items
      .filter((t) => t.createdBy === meId && (t.ask!.state === 'asked' || t.ask!.state === 'countered' || recent(t)))
      .sort((a, b) => rank(a) - rank(b) || (b.answeredAt ?? b.createdAt).localeCompare(a.answeredAt ?? a.createdAt)),
  };
}

// ---------- as of a past week (v2) ----------
// The desk as it stood at the end of a week, read from the append-only events. Nothing is written.
// The current row is rewound: every field goes back to the "before" of its earliest event after the
// cutoff. A task made after the cutoff is not there yet. Pending asks stay off the desk, as now.

export const ASOF_WEEKS = 8;

// The Mondays of the last eight finished weeks, newest first. The current week is "now", not a past state.
export function asOfWeeks(todayDate = todayIst()): string[] {
  const now = mondayOf(todayDate);
  return Array.from({ length: ASOF_WEEKS }, (_, i) => addDays(now, -7 * (i + 1)));
}

// "End of the week of Monday 2026-09-28" is 2026-10-05 00:00 in India. The last second counts as in.
export const weekEndCutoff = (weekStart: string) => new Date(`${addDays(weekStart, 7)}T00:00:00+05:30`).toISOString();

export async function asOfTasks(db: Tx, teamId: string, weekStart: string): Promise<Task[]> {
  const cutoff = weekEndCutoff(weekStart);
  const sunday = addDays(weekStart, 6);
  const { rows: cur } = await db.query<TaskRow & { existed: boolean }>(
    `SELECT *, (created_at <= $2::timestamptz) AS existed FROM tasks WHERE team_id = $1`, [teamId, cutoff],
  );
  if (cur.length === 0) return [];
  const { rows: evs } = await db.query<EventRow & { late: boolean }>(
    `SELECT *, (at > $2::timestamptz) AS late FROM events WHERE entity_type = 'task' AND entity_id = ANY($1) ORDER BY at, id`,
    [cur.map((r) => r.id), cutoff],
  );
  const byTask = new Map<string, (EventRow & { late: boolean })[]>();
  for (const e of evs) byTask.set(e.entity_id, [...(byTask.get(e.entity_id) ?? []), e]);

  const out: Task[] = [];
  for (const r of cur) {
    const log = byTask.get(r.id) ?? [];
    const made = log.find((e) => e.field === '_created');
    if (made ? made.late : !r.existed) continue;
    const row: TaskRow = { ...r };
    const rec = row as unknown as Record<string, unknown>;
    // Undo what happened after the cutoff, newest first, so the earliest one wins.
    for (const e of [...log].reverse()) {
      if (!e.late || e.field.startsWith('_')) continue;
      if (e.field in rec) rec[e.field] = e.before ?? null;
    }
    // Bookkeeping columns that have no events of their own follow the field they belong to.
    if (!row.blocked_ask) { row.blocked_on_id = null; row.blocked_at = null; }
    else if (!row.blocked_at) row.blocked_at = cutoff;
    if (!row.priority) { row.priority_set_by = null; row.priority_set_at = null; }
    else { row.priority_set_by ??= row.created_by ?? row.owner_id; row.priority_set_at ??= cutoff; }
    if (row.status_category !== 'done') row.closed_at = null;
    if (row.ask_state && row.ask_state !== 'accepted') continue; // not agreed yet at that point
    out.push(derive(row, log.filter((e) => !e.late && e.field === 'due_on'), sunday));
  }
  return out;
}

// ---------- load (v2) ----------
// Open work per person for a week and the one after. This week includes what is late, because late
// work is still on the plate. A week is Monday to Sunday.

export type Load = { personId: string; thisWeek: Task[]; nextWeek: Task[]; late: number };

export function weeklyLoad(tasks: Task[], personIds: string[], weekStart: string): Load[] {
  const weekEnd = addDays(weekStart, 6);
  const nextEnd = addDays(weekStart, 13);
  return personIds.map((personId) => {
    const open = tasks.filter((t) => t.ownerId === personId && t.statusCategory === 'open').sort((a, b) => a.dueOn.localeCompare(b.dueOn) || a.title.localeCompare(b.title));
    return {
      personId,
      thisWeek: open.filter((t) => t.dueOn <= weekEnd),
      nextWeek: open.filter((t) => t.dueOn > weekEnd && t.dueOn <= nextEnd),
      late: open.filter((t) => t.dueOn < weekStart).length,
    };
  });
}

// ---------- views ----------

const byUrgency = (a: Task, b: Task) =>
  Number(b.overdue) - Number(a.overdue) ||
  a.dueOn.localeCompare(b.dueOn) ||
  prio(a) - prio(b) ||
  a.title.localeCompare(b.title);
const prio = (t: Task) => (t.priority ? { high: 0, normal: 1, low: 2 }[t.priority.value] : 3);

export type Filters = { personId?: string; projectId?: string };
const applyFilters = (ts: Task[], f: Filters) =>
  ts.filter((t) => (!f.personId || t.ownerId === f.personId) && (!f.projectId || t.projectId === f.projectId));

// FR-29
export async function myTasks(db: Db, meId: string, teamId: string, today = todayIst()) {
  const all = await teamTasks(db, teamId, today);
  const { rows } = await db.query<{ task_id: string }>(
    `SELECT DISTINCT task_id FROM notices WHERE person_id = $1 AND kind = 'assigned' AND read_at IS NULL`,
    [meId],
  );
  const unseen = new Set(rows.map((r) => r.task_id));
  const open = all.filter((t) => t.statusCategory === 'open');
  return {
    blockedOnMe: open.filter((t) => t.blocked?.onId === meId).sort(byUrgency),
    assigned: open.filter((t) => t.ownerId === meId && unseen.has(t.id)).sort(byUrgency),
    tasks: open.filter((t) => t.ownerId === meId && !unseen.has(t.id)).sort(byUrgency),
  };
}

export async function markAssignedSeen(db: Db, meId: string, taskId: string): Promise<void> {
  await db.query(
    `UPDATE notices SET read_at = now() WHERE person_id = $1 AND task_id = $2 AND kind = 'assigned' AND read_at IS NULL`,
    [meId, taskId],
  );
}

// FR-30
export async function weekView(db: Db, teamId: string, weekStart: string, f: Filters, today = todayIst()) {
  const weekEnd = addDays(weekStart, 6);
  const [all, people] = await Promise.all([teamTasks(db, teamId, today), listPeople(db, teamId)]);
  const tasks = applyFilters(all, f).filter((t) => t.statusCategory !== 'dropped');
  const inWeek = (d: string) => d >= weekStart && d <= weekEnd;
  return {
    weekStart,
    people: people
      .filter((p) => p.active && (!f.personId || p.id === f.personId))
      .map((p) => {
        const mine = tasks.filter((t) => t.ownerId === p.id);
        const shown = mine
          .filter((t) => inWeek(t.dueOn) || t.overdue || (t.closedAt && inWeek(istDate(t.closedAt))))
          .sort((a, b) => Number(a.statusCategory !== 'open') - Number(b.statusCategory !== 'open') || byUrgency(a, b));
        const open = shown.filter((t) => t.statusCategory === 'open');
        return {
          personId: p.id,
          counts: {
            open: open.length,
            overdue: open.filter((t) => t.overdue).length,
            silentSlips: shown.filter((t) => t.slippedSilently).length,
            blocked: open.filter((t) => t.blocked).length,
            closedThisWeek: mine.filter((t) => t.closedAt && inWeek(istDate(t.closedAt))).length,
          },
          tasks: shown,
        };
      }),
  };
}

const HEALTHS: Health[] = ['off_track', 'not_started', 'on_track', 'ahead'];

// FR-31
export async function byStatus(db: Db, teamId: string, weekStart: string, f: Filters, today = todayIst()) {
  const weekEnd = addDays(weekStart, 6);
  const tasks = applyFilters(await teamTasks(db, teamId, today), f);
  const open = tasks.filter((t) => t.statusCategory === 'open');
  const closed = tasks.filter((t) => t.outcome && t.closedAt && istDate(t.closedAt) >= weekStart && istDate(t.closedAt) <= weekEnd);
  return {
    open: Object.fromEntries([
      ...HEALTHS.map((h) => [h, open.filter((t) => t.health === h).sort(byUrgency)]),
      ['from_sheet', open.filter((t) => t.health === null).sort(byUrgency)],
    ]) as Record<Health | 'from_sheet', Task[]>,
    closed: {
      ahead: closed.filter((t) => t.outcome === 'ahead'),
      on_time: closed.filter((t) => t.outcome === 'on_time'),
      late: closed.filter((t) => t.outcome === 'late'),
    },
  };
}

export type LedgerRow = {
  personId: string; weekStart: string; closedAhead: number; closedOnTime: number; closedLate: number;
  openPastDue: number; silentSlips: number; renegotiatedOpen: number; renegotiatedLate: number;
};

// FR-33: weeks keyed by the Monday of first_due_on; outcome judged against first_due_on (SPEC.md C1).
export async function ledger(db: Db, teamId: string, from: string, to: string, personId?: string, today = todayIst()): Promise<LedgerRow[]> {
  const tasks = (await teamTasks(db, teamId, today)).filter(
    (t) => t.statusCategory !== 'dropped' && (!personId || t.ownerId === personId),
  );
  const rows = new Map<string, LedgerRow>();
  for (const t of tasks) {
    const week = mondayOf(t.firstDueOn);
    if (week < from || week > to) continue;
    const key = `${week}|${t.ownerId}`;
    const r = rows.get(key) ?? {
      personId: t.ownerId, weekStart: week, closedAhead: 0, closedOnTime: 0, closedLate: 0,
      openPastDue: 0, silentSlips: 0, renegotiatedOpen: 0, renegotiatedLate: 0,
    };
    if (t.outcome === 'ahead') r.closedAhead++;
    if (t.outcome === 'on_time') r.closedOnTime++;
    if (t.outcome === 'late') r.closedLate++;
    if (t.overdue) r.openPastDue++;
    if (t.slippedSilently) r.silentSlips++;
    for (const x of t.renegotiations) x.kind === 'open' ? r.renegotiatedOpen++ : r.renegotiatedLate++;
    rows.set(key, r);
  }
  return [...rows.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart) || a.personId.localeCompare(b.personId));
}

// ---------- notices and reminders (FR-36 to FR-39) ----------

export type Notice = { id: string; taskId: string; taskTitle: string; kind: string; forDate: string; createdAt: string; readAt: string | null };

export async function listNotices(db: Db, meId: string, unreadOnly = false): Promise<Notice[]> {
  const { rows } = await db.query<Notice>(
    `SELECT n.id, n.task_id AS "taskId", t.title AS "taskTitle", n.kind, n.for_date AS "forDate",
            n.created_at AS "createdAt", n.read_at AS "readAt"
     FROM notices n JOIN tasks t ON t.id = n.task_id
     WHERE n.person_id = $1 AND ($2 = false OR n.read_at IS NULL)
     ORDER BY n.read_at IS NOT NULL, n.created_at DESC LIMIT 100`,
    [meId, unreadOnly],
  );
  return rows;
}

export async function markNoticeRead(db: Db, meId: string, id: string): Promise<void> {
  const { affectedRows } = await db.query(`UPDATE notices SET read_at = now() WHERE id = $1 AND person_id = $2 AND read_at IS NULL`, [id, meId]);
  if (!affectedRows) {
    const { rows } = await db.query(`SELECT 1 FROM notices WHERE id = $1 AND person_id = $2`, [id, meId]);
    if (!rows.length) throw notFound('No such notice.');
  }
}

// Runs daily at 09:00 Asia/Kolkata. Idempotent per day through the notices unique key.
export async function runReminders(db: Db, today = todayIst()): Promise<number> {
  const tomorrow = addDays(today, 1);
  const { rows } = await db.query<{ id: string; owner_id: string; due_on: string }>(
    `SELECT t.id, t.owner_id, t.due_on FROM tasks t JOIN people p ON p.id = t.owner_id
     WHERE t.status_category = 'open' AND p.active AND t.due_on <= $1 AND (t.ask_state IS NULL OR t.ask_state = 'accepted')`,
    [tomorrow],
  );
  let made = 0;
  await db.transaction(async (tx) => {
    for (const r of rows) {
      const kind = r.due_on === tomorrow ? 'due_tomorrow' : r.due_on === today ? 'due_today' : 'overdue';
      const res = await tx.query(
        `INSERT INTO notices (id, person_id, task_id, kind, for_date, created_at) VALUES ($1,$2,$3,$4,$5,now())
         ON CONFLICT (person_id, task_id, kind, for_date) DO NOTHING`,
        [newId('ntc'), r.owner_id, r.id, kind, today],
      );
      made += res.affectedRows ?? 0;
    }
  });
  return made;
}

// ---------- roster admin (FR-55) ----------

async function requireAdmin(db: Tx, teamId: string, meId: string) {
  if (!(await rolesIn(db, teamId, meId)).has('admin')) throw forbidden('Only the team admin can change the roster.');
}

export async function addPerson(
  db: Db, meId: string, teamId: string,
  input: { displayName: string; role: string; department: string; email: string; appRoles: AppRole[] },
): Promise<Person> {
  const id = newId('per');
  await db.transaction(async (tx) => {
    await requireAdmin(tx, teamId, meId);
    if (await findPersonByEmail(tx, input.email)) throw bad('invalid_body', 'That email is already on the roster.', 'email');
    await tx.query(`INSERT INTO people (id, display_name, role, department, email) VALUES ($1,$2,$3,$4,$5)`, [
      id, input.displayName.trim(), input.role.trim(), input.department.trim(), input.email.trim().toLowerCase(),
    ]);
    for (const r of new Set<AppRole>(['member', ...input.appRoles])) {
      await tx.query(`INSERT INTO team_members VALUES ($1,$2,$3)`, [teamId, id, r]);
    }
  });
  return (await getPerson(db, teamId, id))!;
}

export async function patchPerson(
  db: Db, meId: string, teamId: string, personId: string, input: { active?: boolean; appRoles?: AppRole[]; role?: string; department?: string },
): Promise<Person> {
  await db.transaction(async (tx) => {
    await requireAdmin(tx, teamId, meId);
    const p = await getPerson(tx, teamId, personId);
    if (!p || p.appRoles.length === 0) throw notFound('No such person on this team.');
    if (personId === meId && (input.active === false || (input.appRoles && !input.appRoles.includes('admin'))))
      throw bad('invalid_body', 'You cannot remove your own admin access.');
    if (input.active !== undefined) await tx.query(`UPDATE people SET active = $2 WHERE id = $1`, [personId, input.active]);
    if (input.role !== undefined) await tx.query(`UPDATE people SET role = $2 WHERE id = $1`, [personId, input.role.trim()]);
    if (input.department !== undefined) await tx.query(`UPDATE people SET department = $2 WHERE id = $1`, [personId, input.department.trim()]);
    if (input.appRoles) {
      await tx.query(`DELETE FROM team_members WHERE team_id = $1 AND person_id = $2`, [teamId, personId]);
      for (const r of new Set<AppRole>(['member', ...input.appRoles])) {
        await tx.query(`INSERT INTO team_members VALUES ($1,$2,$3)`, [teamId, personId, r]);
      }
    }
  });
  return (await getPerson(db, teamId, personId))!;
}

// ---------- project log ----------

// The update log across one project's tasks, newest first.
export async function projectLog(db: Tx, projectId: string, limit = 30): Promise<(LogLine & { taskTitle: string })[]> {
  const { rows } = await db.query<LogLine & { taskTitle: string }>(
    `SELECT e.*, p.display_name AS "actorName", t.title AS "taskTitle" FROM events e
     JOIN tasks t ON t.id = e.entity_id AND e.entity_type = 'task'
     LEFT JOIN people p ON p.id = e.actor_id
     WHERE t.project_id = $1 ORDER BY e.at DESC, e.id DESC LIMIT $2`,
    [projectId, limit],
  );
  return rows;
}

export async function projectTasks(db: Tx, projectId: string, today = todayIst()): Promise<Task[]> {
  return loadTasks(db, 'project_id = $1', [projectId], today);
}

// The tasks behind the ledger: every task whose first date falls in [from, to] (Mondays), not dropped.
// The ledger counts above and the drill-down lists are built from the same tasks.
export async function ledgerTasks(db: Db, teamId: string, from: string, to: string, personId?: string, today = todayIst()): Promise<Task[]> {
  return (await teamTasks(db, teamId, today)).filter((t) => {
    if (t.statusCategory === 'dropped' || (personId && t.ownerId !== personId)) return false;
    const week = mondayOf(t.firstDueOn);
    return week >= from && week <= to;
  });
}
