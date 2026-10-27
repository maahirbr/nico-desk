import type { Db, Tx } from './db';
import { derive, type EventRow, type Health, type Task, type TaskRow } from './derive';
import { ApiError, bad, forbidden, notFound } from './errors';
import { onTimeTrend, weekSplit, type TrendWeek, type WeekSplit } from './glance';
import { originNow } from './origin';
import { checkLinkUrl, LINK_LABEL_MAX, LINKS_PER_TASK, type TaskLink } from './links';
import { norm as nameKey } from './quickadd';
import { isLeadOrAdmin } from './roles';
import { seesProject, seesTask, seesTaskRow, sightOf, workingWith, type Sight } from './sight';
import { addDays, istDate, mondayOf, today as todayIst } from './time';
import { buildUpdates, groupUpdates, UPDATE_DAYS, type UpdateGroup, type UpdateItem } from './updates';

// Every write goes through here, so the rules in SPEC.md section 2 hold for the API and the pages alike.

export type Person = {
  id: string;
  displayName: string; // the nickname when the person set one, else the roster name
  fullName?: string; // the roster name, shown beside a nickname
  nickname?: string | null;
  role: string;
  department: string;
  email: string;
  active: boolean;
  appRoles: AppRole[];
  restricted: boolean; // sees only their own projects and the ones they may view (lib/sight.ts)
  repliesFeedback: boolean; // may reply to feedback notes (set on the Roster)
};
export type AppRole = 'member' | 'lead' | 'admin';

let seq = 0;
export function newId(prefix: string): string {
  seq = (seq + 1) % 1296;
  return `${prefix}_${Date.now().toString(36)}${seq.toString(36).padStart(2, '0')}${Math.random().toString(36).slice(2, 6)}`;
}

const REASON_MIN = 1; // any written reason will do (12 Oct, the PM who owns the desk)
const REASON_MAX = 280;

function needReason(reason: unknown, field = 'reason'): string {
  const r = typeof reason === 'string' ? reason.trim() : '';
  if (r.length < REASON_MIN || r.length > REASON_MAX)
    throw bad('reason_required', `Write a reason (up to ${REASON_MAX} characters).`, field);
  return r;
}

// ---------- people and roles ----------

type PersonRow = { id: string; display_name: string; nickname?: string | null; role: string; department: string; email: string; active: boolean; app_roles: AppRole[] | null; restricted?: boolean; replies_feedback?: boolean };

function toPerson(r: PersonRow): Person {
  return {
    id: r.id, displayName: r.nickname ?? r.display_name, fullName: r.display_name, nickname: r.nickname ?? null, role: r.role, department: r.department, email: r.email, active: r.active,
    appRoles: r.app_roles ?? [], restricted: r.restricted ?? false, repliesFeedback: r.replies_feedback ?? false,
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
    `SELECT id, active FROM people WHERE lower(email) = lower($1)
       OR lower($1) IN (SELECT lower(a) FROM unnest(alt_emails) AS a)`,
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
  const roles = new Set(rows.map((r) => r.app_role));
  if (roles.has('admin')) roles.add('lead'); // an admin can do anything a lead can, such as reopening a task
  return roles;
}

async function activeMember(db: Tx, teamId: string, personId: string, field: string): Promise<void> {
  const roles = await rolesIn(db, teamId, personId);
  if (roles.size === 0) throw bad('owner_not_on_roster', 'That person is not an active member of this team.', field);
}

export async function listProjects(db: Tx, teamId: string): Promise<{ id: string; name: string; archived: boolean }[]> {
  const { rows } = await db.query<{ id: string; name: string; archived: boolean }>(
    `SELECT id, name, archived_at IS NOT NULL AS archived FROM projects WHERE team_id = $1 ORDER BY name`,
    [teamId],
  );
  return rows;
}

// ---------- reading tasks ----------

async function loadTasks(db: Tx, where: string, params: unknown[], today: string): Promise<Task[]> {
  const { rows } = await db.query<TaskRow>(`SELECT * FROM tasks WHERE ${where}`, params);
  if (rows.length === 0) return [];
  const { rows: events } = await db.query<EventRow>(
    `SELECT * FROM events WHERE entity_type = 'task' AND entity_id = ANY($1) AND field IN ('due_on', 'status_category') ORDER BY at, id`,
    [rows.map((r) => r.id)],
  );
  const byTask = new Map<string, EventRow[]>();
  for (const e of events) byTask.set(e.entity_id, [...(byTask.get(e.entity_id) ?? []), e]);
  const links = await linksFor(db, rows.map((r) => r.id));
  return rows.map((r) => ({ ...derive(r, byTask.get(r.id) ?? [], today), links: links.get(r.id) ?? [] }));
}

// ---------- links on a task ----------

type LinkRow = { id: string; task_id: string; url: string; label: string | null; created_by: string | null; created_at: string };
const toLink = (r: LinkRow): TaskLink => ({ id: r.id, taskId: r.task_id, url: r.url, label: r.label, createdBy: r.created_by, createdAt: r.created_at });

// Oldest first, so a task's chips keep their order.
export async function linksFor(db: Tx, taskIds: string[]): Promise<Map<string, TaskLink[]>> {
  const out = new Map<string, TaskLink[]>();
  if (taskIds.length === 0) return out;
  const { rows } = await db.query<LinkRow>(`SELECT * FROM task_links WHERE task_id = ANY($1) ORDER BY created_at, id`, [taskIds]);
  for (const r of rows) out.set(r.task_id, [...(out.get(r.task_id) ?? []), toLink(r)]);
  return out;
}

export async function getTask(db: Tx, id: string, today = todayIst()): Promise<Task> {
  const [t] = await loadTasks(db, 'id = $1', [id], today);
  if (!t) throw notFound('No such task.');
  return t;
}

export async function teamTasks(db: Tx, teamId: string, today = todayIst()): Promise<Task[]> {
  return loadTasks(db, 'team_id = $1', [teamId], today);
}

export type LogLine = EventRow & { actorName: string | null };

export async function taskLog(db: Tx, taskId: string, before?: string, limit = 50): Promise<LogLine[]> {
  const { rows } = await db.query<LogLine>(
    `SELECT e.*, COALESCE(p.nickname, p.display_name) AS "actorName" FROM events e LEFT JOIN people p ON p.id = e.actor_id
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
     VALUES ($1, 'task', $2, $3, $4::jsonb, $5::jsonb, $6, $7, $9, $8)`,
    [newId('evt'), e.entityId, e.field, j(e.before), j(e.after), e.reason ?? null, e.actorId, e.at, originNow()],
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
    const ctx: Ctx = { row, roles, meId, isOwner: row.owner_id === meId, isLead: isLeadOrAdmin(roles) };
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

// ownerRole: set when the owner is being added to the project as the task is assigned ("+ Add someone to this project").
export type CreateInput = { teamId: string; title: string; description?: string | null; ownerId: string; dueOn: string; projectId?: string | null; workstream?: string | null; note?: string | null; ownerRole?: string };

// A task's owner is always one of the project's people. Someone new joins with the role given, or as Member
// when a task reaches them another way (minutes, imports). Joining twice changes nothing.
// Only the project owner, its lead, a team lead or an admin may bring someone new in, the same rule as updateProject.
async function joinProject(tx: Tx, projectId: string, personId: string, role: string | undefined, meId: string, isLead: boolean): Promise<void> {
  const { rows } = await tx.query<{ owner_id: string; lead_id: string | null; member: boolean }>(
    `SELECT owner_id, lead_id, EXISTS (SELECT 1 FROM project_members WHERE project_id = $1 AND person_id = $2) AS member FROM projects WHERE id = $1`,
    [projectId, personId]);
  const p = rows[0];
  if (!p || p.member) return;
  if (p.owner_id !== personId && p.lead_id !== personId && p.owner_id !== meId && p.lead_id !== meId && !isLead) {
    throw forbidden('Only the project owner, its lead or a team lead can add someone to this project. Pick one of its people.');
  }
  const r = role === undefined ? 'Member' : role.trim();
  if (r.length < 2 || r.length > 60) throw bad('invalid_body', 'Give their role on this project (2 to 60 characters).', 'ownerRole');
  await tx.query(`INSERT INTO project_members VALUES ($1,$2,$3) ON CONFLICT (project_id, person_id) DO NOTHING`, [projectId, personId, r]);
}

export async function createTask(db: Db, meId: string, input: CreateInput): Promise<Task> {
  const today = todayIst();
  if (input.dueOn < today) throw bad('date_in_past', 'The due date must be today or later.', 'dueOn');
  const id = newId('tsk');
  await db.transaction(async (tx) => {
    const roles = await rolesIn(tx, input.teamId, meId);
    if (roles.size === 0) throw forbidden('You are not on this team.');
    await activeMember(tx, input.teamId, input.ownerId, 'ownerId');
    if (input.projectId) {
      const { rows } = await tx.query<{ archived_at: string | null }>(`SELECT archived_at FROM projects WHERE id = $1 AND team_id = $2 FOR SHARE`, [input.projectId, input.teamId]);
      if (!rows.length) throw bad('invalid_body', 'No such project on this team.', 'projectId');
      if (rows[0].archived_at) throw bad('project_archived', 'This project is archived. Restore it to add tasks.', 'projectId');
      await joinProject(tx, input.projectId, input.ownerId, input.ownerRole, meId, isLeadOrAdmin(roles));
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

export type EditInput = { version: number; title?: string; description?: string | null; note?: string | null; projectId?: string | null; workstream?: string | null; ownerId?: string; ownerRole?: string };

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
        // The person who had the task hears it moved, in the app only. Not when they moved it themselves.
        if (c.row.owner_id !== meId) await notice(tx, c.row.owner_id, id, 'reassigned_away', todayIst());
      }
      if (input.projectId) {
        const { rows } = await tx.query<{ archived_at: string | null }>(`SELECT archived_at FROM projects WHERE id = $1 AND team_id = $2 FOR SHARE`, [input.projectId, c.row.team_id]);
        if (!rows.length) throw bad('invalid_body', 'No such project on this team.', 'projectId');
        if (rows[0].archived_at && input.projectId !== c.row.project_id) throw bad('project_archived', 'That project is archived. Restore it to move a task into it.', 'projectId');
      }
      const projectId = input.projectId !== undefined ? input.projectId : c.row.project_id;
      const ownerId = input.ownerId ?? c.row.owner_id;
      if (projectId && (projectId !== c.row.project_id || ownerId !== c.row.owner_id)) await joinProject(tx, projectId, ownerId, input.ownerRole, meId, c.isLead);
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

// Archiving a project with open work (26 Oct): every open task in it is dropped with one reason, and each drop is
// logged the same way closeTask logs it. The caller holds the project lock and has already checked who may archive.
export async function dropOpenTasks(tx: Tx, meId: string, projectId: string, reason: unknown): Promise<number> {
  const why = needReason(reason, 'dropOpen');
  const { rows } = await tx.query<TaskRow>(`SELECT * FROM tasks WHERE project_id = $1 AND status_category = 'open' ORDER BY id FOR UPDATE`, [projectId]);
  if (rows.some((r) => r.origin === 'sheet')) throw new ApiError(403, 'read_only_mirror', 'Some open tasks here come from a Sheet. Close them there first.');
  const set: Partial<TaskRow> = { status: 'dropped', status_category: 'dropped', blocked_on_id: null, blocked_ask: null, blocked_at: null };
  const at = new Date().toISOString();
  for (const row of rows) {
    await tx.query(`UPDATE tasks SET status = 'dropped', status_category = 'dropped', blocked_on_id = NULL, blocked_ask = NULL, blocked_at = NULL, version = version + 1 WHERE id = $1`, [row.id]);
    for (const f of ORDER.filter((k) => k in set && set[k] !== row[k] && !SILENT.has(k))) {
      await insertEvent(tx, { entityId: row.id, field: f, before: row[f], after: set[f], reason: f === 'status_category' ? why : null, actorId: meId, at });
    }
  }
  return rows.length;
}

export async function reopenTask(db: Db, meId: string, id: string, input: { version: number; reason: string }): Promise<Task> {
  const reason = needReason(input.reason);
  await db.transaction(async (tx) => {
    const { rows } = await tx.query<TaskRow>(`SELECT * FROM tasks WHERE id = $1 FOR UPDATE`, [id]);
    const row = rows[0];
    if (!row) throw notFound('No such task.');
    const roles = await rolesIn(tx, row.team_id, meId);
    if (row.origin === 'sheet') throw new ApiError(403, 'read_only_mirror', 'This task comes from a Sheet. Edit it there.');
    if (!isLeadOrAdmin(roles)) throw forbidden('Only a lead can reopen a task.');
    if (row.version !== input.version) throw new ApiError(409, 'version_conflict', 'Someone changed this task. Reload and try again.');
    if (row.status_category === 'open') throw bad('invalid_body', 'The task is already open.');
    if (row.project_id) {
      const { rows: pr } = await tx.query<{ archived_at: string | null }>(`SELECT archived_at FROM projects WHERE id = $1`, [row.project_id]);
      if (pr[0]?.archived_at) throw bad('project_archived', 'This task’s project is archived. Restore the project to reopen the task.');
    }
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
  // Any written block reason will do; a person it waits on is optional.
  if (!ask || ask.length > 280) throw bad('reason_required', 'Give a block reason (up to 280 characters).', 'ask');
  return mutate(
    db, meId, id, input.version,
    // The owner, or a lead or admin who hears of the block first (repo owner, 12 Oct).
    (c) => c.isOwner || c.isLead,
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

// resume: also set In progress in the same change, so "Unblock" is one step. Only the owner or a
// lead may set the working state; the person it waited on can still clear the block alone.
export async function unblockTask(db: Db, meId: string, id: string, input: { version: number; note?: string; resume?: boolean }): Promise<Task> {
  return mutate(
    db, meId, id, input.version,
    (c) => c.isOwner || c.isLead || c.row.blocked_on_id === meId,
    (c) => {
      if (!c.row.blocked_ask) throw bad('invalid_body', 'The task is not blocked.');
      if (input.resume && !c.isOwner && !c.isLead) throw forbidden('Only the owner or a lead can set this task in progress.');
      // The owner or a lead can clear a block without a word. The person it waits on says what they did,
      // since that is what the owner hears ("The teammate cleared the block: sent the numbers").
      const note = input.note?.trim().slice(0, 280);
      if (!note && !c.isOwner && !c.isLead) throw bad('reason_required', 'Say in a few words what you did.', 'note');
      const set: Partial<TaskRow> = { blocked_on_id: null, blocked_ask: null, blocked_at: null, ...(input.resume && c.row.status_category === 'open' ? { health: 'on_track' as const } : {}) };
      return { set, ...(note ? { reasons: { blocked_ask: note } } : {}) };
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
    if (row.owner_id !== meId && !isLeadOrAdmin(roles)) throw forbidden();
    await insertEvent(tx, { entityId: id, field: '_update', before: null, after: t, actorId: meId, at: new Date().toISOString() });
  });
}

// Links share the edit rule of the task itself: its owner, a lead or admin, or the person who made it. A Sheet mirror takes none.
// A link changes no task field, so it takes no version. Each add or remove writes one event, which the update log reads as one sentence.
async function linkContext(tx: Tx, meId: string, taskId: string): Promise<TaskRow> {
  const { rows } = await tx.query<TaskRow>(`SELECT * FROM tasks WHERE id = $1 FOR UPDATE`, [taskId]);
  const row = rows[0];
  if (!row) throw notFound('No such task.');
  if (row.origin === 'sheet') throw new ApiError(403, 'read_only_mirror', 'This task comes from a Sheet. Edit it there.');
  const roles = await rolesIn(tx, row.team_id, meId);
  if (roles.size === 0) throw forbidden('You are not on this task’s team.');
  if (!(row.owner_id === meId || isLeadOrAdmin(roles) || row.created_by === meId)) throw forbidden();
  return row;
}

export async function addTaskLink(db: Db, meId: string, taskId: string, input: { url: string; label?: string | null }): Promise<TaskLink> {
  const checked = checkLinkUrl(input.url);
  if ('error' in checked) throw bad('invalid_link', checked.error, 'url');
  const label = input.label?.trim() || null;
  if (label && label.length > LINK_LABEL_MAX) throw bad('invalid_link', `A label is up to ${LINK_LABEL_MAX} characters.`, 'label');
  return db.transaction(async (tx) => {
    await linkContext(tx, meId, taskId);
    const { rows: have } = await tx.query<{ url: string }>(`SELECT url FROM task_links WHERE task_id = $1`, [taskId]);
    if (have.length >= LINKS_PER_TASK) throw bad('too_many_links', `A task takes up to ${LINKS_PER_TASK} links. Remove one first.`, 'url');
    if (have.some((h) => h.url === checked.url)) throw bad('duplicate_link', 'This task already has that link.', 'url');
    const at = new Date().toISOString();
    const id = newId('lnk');
    await tx.query(`INSERT INTO task_links (id, task_id, url, label, created_by, created_at) VALUES ($1,$2,$3,$4,$5,$6)`, [id, taskId, checked.url, label, meId, at]);
    await insertEvent(tx, { entityId: taskId, field: '_link_added', before: null, after: { id, url: checked.url, label }, actorId: meId, at });
    return { id, taskId, url: checked.url, label, createdBy: meId, createdAt: at };
  });
}

export async function removeTaskLink(db: Db, meId: string, taskId: string, linkId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await linkContext(tx, meId, taskId);
    const { rows } = await tx.query<LinkRow>(`DELETE FROM task_links WHERE id = $1 AND task_id = $2 RETURNING *`, [linkId, taskId]);
    if (!rows[0]) throw notFound('No such link on this task.');
    await insertEvent(tx, { entityId: taskId, field: '_link_removed', before: { id: linkId, url: rows[0].url, label: rows[0].label }, after: null, actorId: meId, at: new Date().toISOString() });
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
  closedLateFlagged: number; closedLateMissed: number; // closedLate split by Task.lateKind
  openPastDue: number; silentSlips: number; renegotiatedOpen: number; renegotiatedLate: number;
};

// FR-33: weeks keyed by the Monday of first_due_on; outcome judged against first_due_on (SPEC.md C1).
export async function ledger(db: Db, teamId: string, from: string, to: string, personId?: string, today = todayIst()): Promise<LedgerRow[]> {
  return ledgerOf(await teamTasks(db, teamId, today), from, to, personId);
}

// The same rows from tasks already loaded (a page passes the tasks its viewer may see, lib/visibility.ts).
export function ledgerOf(all: Task[], from: string, to: string, personId?: string): LedgerRow[] {
  const tasks = all.filter(
    (t) => t.statusCategory !== 'dropped' && (!personId || t.ownerId === personId),
  );
  const rows = new Map<string, LedgerRow>();
  for (const t of tasks) {
    const week = mondayOf(t.firstDueOn);
    if (week < from || week > to) continue;
    const key = `${week}|${t.ownerId}`;
    const r = rows.get(key) ?? {
      personId: t.ownerId, weekStart: week, closedAhead: 0, closedOnTime: 0, closedLate: 0, closedLateFlagged: 0, closedLateMissed: 0,
      openPastDue: 0, silentSlips: 0, renegotiatedOpen: 0, renegotiatedLate: 0,
    };
    if (t.outcome === 'ahead') r.closedAhead++;
    if (t.outcome === 'on_time') r.closedOnTime++;
    if (t.outcome === 'late') r.closedLate++;
    if (t.lateKind === 'flagged_early') r.closedLateFlagged++;
    if (t.lateKind === 'missed') r.closedLateMissed++;
    if (t.overdue) r.openPastDue++;
    if (t.slippedSilently) r.silentSlips++;
    for (const x of t.renegotiations) x.kind === 'open' ? r.renegotiatedOpen++ : r.renegotiatedLate++;
    rows.set(key, r);
  }
  return [...rows.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart) || a.personId.localeCompare(b.personId));
}

// ---------- notices and reminders (FR-36 to FR-39) ----------

export type Notice = { id: string; taskId: string; taskTitle: string; kind: string; forDate: string; createdAt: string; readAt: string | null; canOpen: boolean };

export async function listNotices(db: Db, meId: string, unreadOnly = false): Promise<Notice[]> {
  type Row = Notice & { team_id: string; project_id: string | null; owner_id: string; created_by: string | null; blocked_on_id: string | null };
  const { rows } = await db.query<Row>(
    `SELECT n.id, n.task_id AS "taskId", t.title AS "taskTitle", n.kind, n.for_date AS "forDate",
            n.created_at AS "createdAt", n.read_at AS "readAt", t.team_id, t.project_id, t.owner_id, t.created_by, t.blocked_on_id
     FROM notices n JOIN tasks t ON t.id = n.task_id
     WHERE n.person_id = $1 AND ($2 = false OR n.read_at IS NULL)
     ORDER BY n.read_at IS NOT NULL, n.created_at DESC LIMIT 100`,
    [meId, unreadOnly],
  );
  // A notice on a task this person cannot see is dropped, with one exception (15 Oct, the PM's call): "moved off your
  // plate" still tells them a task that was theirs went to someone else, by its title only, with nothing to open.
  const sights = new Map<string, Sight>();
  for (const r of rows) if (!sights.has(r.team_id)) sights.set(r.team_id, await sightOf(db, r.team_id, meId));
  return rows.flatMap((r) => {
    const canOpen = seesTaskRow(sights.get(r.team_id)!, r);
    if (!canOpen && r.kind !== 'reassigned_away') return [];
    return [{ id: r.id, taskId: r.taskId, taskTitle: r.taskTitle, kind: r.kind, forDate: r.forDate, createdAt: r.createdAt, readAt: r.readAt, canOpen }];
  });
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
     WHERE t.status_category = 'open' AND p.active AND t.due_on <= $1`,
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

// A whole team at once, as members, from rows pasted out of a sheet. One transaction: every new row goes in or none
// does. An email already on the roster is skipped and named back, so pasting the same list twice is safe.
export async function addPeople(
  db: Db, meId: string, teamId: string,
  rows: { displayName: string; role: string; department: string; email: string }[],
): Promise<{ added: number; skipped: string[] }> {
  let added = 0;
  const skipped: string[] = [];
  await db.transaction(async (tx) => {
    await requireAdmin(tx, teamId, meId);
    const seen = new Set<string>();
    for (const r of rows) {
      const email = r.email.trim().toLowerCase();
      if (seen.has(email) || (await findPersonByEmail(tx, email))) { skipped.push(email); continue; }
      seen.add(email);
      const id = newId('per');
      await tx.query(`INSERT INTO people (id, display_name, role, department, email) VALUES ($1,$2,$3,$4,$5)`, [
        id, r.displayName.trim(), r.role.trim(), r.department.trim(), email,
      ]);
      await tx.query(`INSERT INTO team_members VALUES ($1,$2,'member')`, [teamId, id]);
      added++;
    }
  });
  return { added, skipped };
}

export async function patchPerson(
  db: Db, meId: string, teamId: string, personId: string, input: { active?: boolean; appRoles?: AppRole[]; role?: string; department?: string; restricted?: boolean; repliesFeedback?: boolean },
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
    if (input.restricted !== undefined) await tx.query(`UPDATE people SET restricted = $2 WHERE id = $1`, [personId, input.restricted]);
    if (input.repliesFeedback !== undefined) await tx.query(`UPDATE people SET replies_feedback = $2 WHERE id = $1`, [personId, input.repliesFeedback]);
    if (input.appRoles) {
      await tx.query(`DELETE FROM team_members WHERE team_id = $1 AND person_id = $2`, [teamId, personId]);
      for (const r of new Set<AppRole>(['member', ...input.appRoles])) {
        await tx.query(`INSERT INTO team_members VALUES ($1,$2,$3)`, [teamId, personId, r]);
      }
    }
  });
  return (await getPerson(db, teamId, personId))!;
}

// ---------- profile: names, phone and photo ----------

export const PHONE_RE = /^[0-9 +-]{7,20}$/;
export const PHOTO_MAX_BYTES = 200 * 1024;
export type PhotoMime = 'image/webp' | 'image/jpeg' | 'image/png';

// An empty phone clears it. Anything else must be 7 to 20 digits, spaces, + or -.
export function checkPhone(phone: unknown): string | null {
  const v = typeof phone === 'string' ? phone.trim() : '';
  if (v === '') return null;
  if (!PHONE_RE.test(v)) throw bad('invalid_body', 'Use 7 to 20 digits, spaces, + or -.', 'phone');
  return v;
}

// The first bytes say what the file is, whatever the client claims. Returns null for anything else.
export function sniffImage(b: Uint8Array): PhotoMime | null {
  const at = (i: number, s: string) => s.split('').every((c, k) => b[i + k] === c.charCodeAt(0));
  if (b.length >= 12 && at(0, 'RIFF') && at(8, 'WEBP')) return 'image/webp';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 8 && b[0] === 0x89 && at(1, 'PNG') && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'image/png';
  return null;
}

// Only a person's own profile: the actor id is the person. The route layer has already refused View as.
export async function setPhone(db: Db, meId: string, phone: unknown): Promise<string | null> {
  const v = checkPhone(phone);
  await db.query(`UPDATE people SET phone = $2 WHERE id = $1`, [meId, v]);
  return v;
}

// Your own names. The roster name keeps the 2 to 80 characters the Roster asks for. An empty nickname clears it.
export async function setNames(db: Db, meId: string, input: { name?: string; nickname?: string }): Promise<void> {
  const name = input.name?.trim();
  if (name !== undefined && (name.length < 2 || name.length > 80)) throw bad('invalid_body', 'Use 2 to 80 characters for your name.', 'name');
  const nick = input.nickname === undefined ? undefined : input.nickname.trim() || null;
  if (nick && nick.length > 40) throw bad('invalid_body', 'Use up to 40 characters for your nickname.', 'nickname');
  // A name or nickname that is someone else's name, nickname or first word would take their reminders, pasted chats
  // and minutes. Names compare by the matcher's own key (case, accents, punctuation and spaces folded), in both
  // directions. A value you already hold is not checked again. The lock makes two saves at once check in turn.
  await db.transaction(async (tx) => {
    await tx.query(`SELECT pg_advisory_xact_lock(hashtext('people_names'))`);
    const { rows } = await tx.query<{ id: string; display_name: string; nickname: string | null }>(`SELECT id, display_name, nickname FROM people`);
    const mine = rows.find((r) => r.id === meId);
    const keys = (v: string) => { const k = nameKey(v); return { whole: k.replace(/ /g, ''), first: k.split(' ')[0] }; };
    const theirs = rows.filter((r) => r.id !== meId).flatMap((r) => [r.display_name, r.nickname]).filter((v): v is string => !!v).map(keys);
    for (const [v, field, held] of [[name, 'name', mine?.display_name], [nick, 'nickname', mine?.nickname]] as const) {
      if (!v || (held && nameKey(held) === nameKey(v))) continue;
      const k = keys(v);
      if (!k.whole) throw bad('invalid_body', `Use letters or numbers in your ${field}.`, field);
      if (theirs.some((t) => t.whole === k.whole || t.first === k.whole || t.whole === k.first || t.first === k.first)) {
        throw bad('name_taken', `Someone else already uses that ${field}. Pick another.`, field);
      }
    }
    if (name !== undefined) await tx.query(`UPDATE people SET display_name = $2 WHERE id = $1`, [meId, name]);
    if (nick !== undefined) await tx.query(`UPDATE people SET nickname = $2 WHERE id = $1`, [meId, nick]);
  });
}

export type MyProfile = { name: string; nickname: string | null; phone: string | null; hasPhoto: boolean };

export async function myProfile(db: Db, meId: string): Promise<MyProfile> {
  const { rows } = await db.query<{ display_name: string; nickname: string | null; phone: string | null; has_photo: boolean }>(
    `SELECT p.display_name, p.nickname, p.phone, EXISTS (SELECT 1 FROM person_photos f WHERE f.person_id = p.id) AS has_photo
     FROM people p WHERE p.id = $1`, [meId]);
  const r = rows[0];
  return { name: r.display_name, nickname: r.nickname, phone: r.phone, hasPhoto: r.has_photo };
}

export async function savePhoto(db: Db, meId: string, bytes: Uint8Array, claimedMime: string): Promise<void> {
  if (bytes.length === 0) throw bad('invalid_body', 'Choose a photo.', 'photo');
  if (bytes.length > PHOTO_MAX_BYTES) throw new ApiError(413, 'photo_too_big', 'The photo must be under 200 KB.', 'photo');
  const mime = sniffImage(bytes);
  if (!mime || mime !== claimedMime) throw new ApiError(415, 'photo_type', 'Use a WebP, JPEG or PNG photo.', 'photo');
  await db.query(
    `INSERT INTO person_photos (person_id, bytes, mime, updated_at) VALUES ($1,$2,$3, now())
     ON CONFLICT (person_id) DO UPDATE SET bytes = EXCLUDED.bytes, mime = EXCLUDED.mime, updated_at = now()`,
    [meId, bytes, mime],
  );
}

export async function deletePhoto(db: Db, meId: string): Promise<void> {
  await db.query(`DELETE FROM person_photos WHERE person_id = $1`, [meId]);
}

// A photo goes only to someone signed in on the same team as its owner. The version is the upload time, for the ETag.
export async function getPhoto(db: Db, teamId: string, personId: string): Promise<{ bytes: Uint8Array; mime: string; version: number } | null> {
  const { rows } = await db.query<{ bytes: Uint8Array; mime: string; v: string | number }>(
    `SELECT f.bytes, f.mime, (extract(epoch FROM f.updated_at) * 1000)::bigint AS v FROM person_photos f
     WHERE f.person_id = $2 AND $2 IN (SELECT person_id FROM team_members WHERE team_id = $1)`,
    [teamId, personId],
  );
  const r = rows[0];
  return r ? { bytes: new Uint8Array(r.bytes), mime: r.mime, version: Number(r.v) } : null;
}

// What each teammate's avatar shows: the upload version if there is one, else Google's photo address, else initials.
export type PhotoInfo = { v?: number; url?: string };
export async function teamPhotos(db: Tx, teamId: string): Promise<Record<string, PhotoInfo>> {
  const { rows } = await db.query<{ id: string; photo_url: string | null; v: string | number | null }>(
    `SELECT p.id, p.photo_url, (extract(epoch FROM f.updated_at) * 1000)::bigint AS v FROM people p
     LEFT JOIN person_photos f ON f.person_id = p.id
     WHERE p.id IN (SELECT person_id FROM team_members WHERE team_id = $1) AND (p.photo_url IS NOT NULL OR f.person_id IS NOT NULL)`,
    [teamId],
  );
  const out: Record<string, PhotoInfo> = {};
  for (const r of rows) out[r.id] = r.v != null ? { v: Number(r.v) } : { url: r.photo_url! };
  return out;
}

// ---------- project log ----------

// The update log across one project's tasks, newest first. It also holds the project's own archive, restore, owner and lead events.
export async function projectLog(db: Tx, projectId: string, limit = 30): Promise<(LogLine & { taskTitle: string })[]> {
  const { rows } = await db.query<LogLine & { taskTitle: string }>(
    `SELECT e.*, COALESCE(p.nickname, p.display_name) AS "actorName", COALESCE(t.title, pr.name) AS "taskTitle" FROM events e
     LEFT JOIN tasks t ON t.id = e.entity_id AND e.entity_type = 'task'
     LEFT JOIN projects pr ON pr.id = e.entity_id AND e.entity_type = 'project'
     LEFT JOIN people p ON p.id = e.actor_id
     WHERE t.project_id = $1 OR (e.entity_type = 'project' AND e.entity_id = $1 AND e.field IN ('_archived','_restored','owner_id','lead_id'))
     ORDER BY e.at DESC, e.id DESC LIMIT $2`,
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
  return ledgerTasksOf(await teamTasks(db, teamId, today), from, to, personId);
}

export function ledgerTasksOf(all: Task[], from: string, to: string, personId?: string): Task[] {
  return all.filter((t) => {
    if (t.statusCategory === 'dropped' || (personId && t.ownerId !== personId)) return false;
    const week = mondayOf(t.firstDueOn);
    return week >= from && week <= to;
  });
}

// ---------- updates for you ----------

// What a person has marked seen: a cut-off for everything, and one per task (opening it, or a project's "Mark seen").
export type SeenMarks = { all: string | null; byTask: Record<string, string> };
export async function seenMarks(db: Db, personId: string): Promise<SeenMarks> {
  const { rows } = await db.query<{ scope: string; seen_at: string | Date }>(`SELECT scope, seen_at FROM update_seen WHERE person_id = $1`, [personId]);
  const out: SeenMarks = { all: null, byTask: {} };
  for (const r of rows) { const at = new Date(r.seen_at).toISOString(); if (r.scope === '*') out.all = at; else out.byTask[r.scope] = at; }
  return out;
}

// Mark updates seen. No task ids: everything up to `upTo` (the newest update the person saw, so one that lands a
// moment later stays new). Task ids: those tasks, up to now. A task only from the person's own team.
export async function markUpdatesSeen(db: Db, personId: string, teamId: string, input: { taskIds?: string[]; upTo?: string }): Promise<void> {
  const now = new Date();
  if (!input.taskIds?.length) {
    const upTo = input.upTo && !Number.isNaN(Date.parse(input.upTo)) && new Date(input.upTo) <= now ? new Date(input.upTo) : now;
    await db.query(`INSERT INTO update_seen (person_id, scope, seen_at) VALUES ($1, '*', $2)
      ON CONFLICT (person_id, scope) DO UPDATE SET seen_at = GREATEST(update_seen.seen_at, EXCLUDED.seen_at)`, [personId, upTo.toISOString()]);
    return;
  }
  const { rows } = await db.query<{ id: string }>(`SELECT id FROM tasks WHERE team_id = $1 AND id = ANY($2::text[])`, [teamId, input.taskIds.slice(0, 200)]);
  for (const r of rows) await db.query(`INSERT INTO update_seen (person_id, scope, seen_at) VALUES ($1, $2, $3)
    ON CONFLICT (person_id, scope) DO UPDATE SET seen_at = GREATEST(update_seen.seen_at, EXCLUDED.seen_at)`, [personId, r.id, now.toISOString()]);
}

// Major changes to tasks made by someone else that this person should hear about (see lib/updates.ts).
// Read from the events of the last week; `seenAt` is the person's "mark all seen" moment, `seenByTask` the per-task marks.
export async function updatesFor(
  db: Db, meId: string, teamId: string, names: Record<string, string>, seenAt?: string | null, now = new Date(), seenByTask: Record<string, string> = {},
): Promise<UpdateItem[]> {
  return (await updatesView(db, meId, teamId, names, {}, seenAt, now, seenByTask)).items;
}

// The same items, and the grouped view: by project, one line per task.
export async function updatesView(
  db: Db, meId: string, teamId: string, names: Record<string, string>, projectNames: Record<string, string>, seenAt?: string | null, now = new Date(),
  seenByTask: Record<string, string> = {},
): Promise<{ items: UpdateItem[]; groups: UpdateGroup[] }> {
  const since = new Date(now.getTime() - UPDATE_DAYS * 86_400_000).toISOString();
  const [sight, all, events, projects] = await Promise.all([
    sightOf(db, teamId, meId),
    teamTasks(db, teamId),
    db.query<EventRow>(
      `SELECT e.* FROM events e JOIN tasks t ON t.id = e.entity_id
       WHERE e.entity_type = 'task' AND t.team_id = $1 AND e.at >= $2
         AND e.field IN ('_created','owner_id','due_on','blocked_ask','blocked_on_id','status_category','title')`,
      [teamId, since],
    ),
    db.query<{ id: string; owner_id: string; lead_id: string | null }>(`SELECT id, owner_id, lead_id FROM projects WHERE team_id = $1`, [teamId]),
  ]);
  const tasks = all.filter((t) => seesTask(sight, t));
  const seen = new Set(tasks.map((t) => t.id));
  const items = buildUpdates({
    events: events.rows.filter((e) => seen.has(e.entity_id)), tasks, leadOf: Object.fromEntries(projects.rows.map((p) => [p.id, [p.owner_id, ...(p.lead_id ? [p.lead_id] : [])]])), names, viewerId: meId, now, seenAt,
  }).filter((i) => !seenByTask[i.taskId] || i.at > seenByTask[i.taskId]);
  return { items, groups: groupUpdates(items, tasks, projectNames, names, meId, todayIst()) };
}

// ---------- a person's page ----------

export type PersonProject = { id: string; name: string; role: string };
export type OnTimeRecord = { from: string; to: string; ahead: number; onTime: number; late: number; openPastDue: number; renegotiated: number };
export type PersonView = {
  person: Person;
  projects: PersonProject[];
  open: Task[]; // their open tasks
  waitingOnThem: Task[]; // other people's open tasks blocked on this person
  waitingOnOthers: Task[]; // their open tasks blocked on someone else
  recent: (LogLine & { taskTitle: string })[]; // events on their tasks, or made by them, newest first
  record: OnTimeRecord | null; // null unless the viewer is a lead, an admin, or this person (the ledger's own rule)
  glance: { week: WeekSplit; trend: TrendWeek[] } | null; // the Home charts for this person, shown under the same rule as record
  phone: string | null; // shown to signed-in teammates only: this view is built for the viewer's own team
  teamName: string;
  hasPhoto: boolean; // an uploaded photo exists (the profile form offers Remove only then)
};

// What one teammate is doing, drawn only from what a teammate can already read: team tasks and their logs, and
// project membership. The on-time record follows the ledger's rule (lib/visibility.ts ledgerFor): leads and admins see
// everyone's, a member their own and that of the people they work with. It is numbers only, so it counts every task.
export async function personView(db: Db, teamId: string, meId: string, personId: string, today = todayIst(), weeks = 4): Promise<PersonView> {
  const person = await getPerson(db, teamId, personId);
  if (!person || person.appRoles.length === 0) throw notFound('That person is not on this team.');
  const viewerRoles = await rolesIn(db, teamId, meId);
  const mayRecord = meId === personId || isLeadOrAdmin(viewerRoles) || (await workingWith(db, teamId, meId)).has(personId);
  const sight = await sightOf(db, teamId, meId);
  const everything = await teamTasks(db, teamId, today);
  const tasks = everything.filter((t) => seesTask(sight, t));
  const byDue = (a: Task, b: Task) => a.dueOn.localeCompare(b.dueOn) || a.title.localeCompare(b.title);
  const open = tasks.filter((t) => t.statusCategory === 'open');
  const [proj, rec, ph] = await Promise.all([
    db.query<{ id: string; name: string; role: string }>(
      `SELECT pr.id, pr.name, COALESCE(m.project_role, 'Lead') AS role FROM projects pr
       LEFT JOIN project_members m ON m.project_id = pr.id AND m.person_id = $2
       WHERE pr.team_id = $1 AND (pr.owner_id = $2 OR m.person_id = $2) ORDER BY pr.name`,
      [teamId, personId],
    ),
    db.query<LogLine & { taskTitle: string; project_id: string | null; owner_id: string; created_by: string | null; blocked_on_id: string | null }>(
      `SELECT e.*, COALESCE(a.nickname, a.display_name) AS "actorName", t.title AS "taskTitle",
              t.project_id, t.owner_id, t.created_by, t.blocked_on_id FROM events e
       JOIN tasks t ON t.id = e.entity_id AND e.entity_type = 'task'
       LEFT JOIN people a ON a.id = e.actor_id
       WHERE t.team_id = $1 AND (t.owner_id = $2 OR e.actor_id = $2) ORDER BY e.at DESC, e.id DESC LIMIT 60`,
      [teamId, personId],
    ),
    db.query<{ phone: string | null; team_name: string; has_photo: boolean }>(
      `SELECT p.phone, t.name AS team_name, EXISTS (SELECT 1 FROM person_photos f WHERE f.person_id = p.id) AS has_photo
       FROM people p, teams t WHERE p.id = $2 AND t.id = $1`,
      [teamId, personId],
    ),
  ]);
  let record: OnTimeRecord | null = null;
  if (mayRecord) {
    const to = mondayOf(today);
    const from = addDays(to, -7 * (weeks - 1));
    const sum: OnTimeRecord = { from, to, ahead: 0, onTime: 0, late: 0, openPastDue: 0, renegotiated: 0 };
    for (const r of ledgerOf(everything, from, to, personId)) {
      sum.ahead += r.closedAhead; sum.onTime += r.closedOnTime; sum.late += r.closedLate;
      sum.openPastDue += r.openPastDue; sum.renegotiated += r.renegotiatedOpen + r.renegotiatedLate;
    }
    record = sum;
  }
  return {
    person,
    projects: proj.rows.filter((p) => seesProject(sight, p.id)),
    open: open.filter((t) => t.ownerId === personId).sort(byDue),
    waitingOnThem: open.filter((t) => t.blocked?.onId === personId && t.ownerId !== personId).sort(byDue),
    waitingOnOthers: open.filter((t) => t.ownerId === personId && t.blocked?.onId && t.blocked.onId !== personId).sort(byDue),
    recent: rec.rows.filter((r) => seesTaskRow(sight, r)).map(({ project_id, owner_id, created_by, blocked_on_id, ...line }) => line),
    record,
    glance: mayRecord ? { week: weekSplit(everything, personId, today), trend: onTimeTrend(everything, personId, today) } : null,
    phone: ph.rows[0]?.phone ?? null,
    teamName: ph.rows[0]?.team_name ?? '',
    hasPhoto: ph.rows[0]?.has_photo ?? false,
  };
}
