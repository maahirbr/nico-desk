import { z } from 'zod';
import { groupLog } from '@/components/logText';
import type { Me } from './auth';
import { addComment, listComments, type Part } from './comments';
import type { Db } from './db';
import type { Task } from './derive';
import { ApiError, bad, forbidden } from './errors';
import { flagKeyOf, statusOf, type StatusKey } from './flags';
import { rateLimit, zDate } from './http';
import { WORD } from './jevStatus';
import { via } from './origin';
import { isLeadOrAdmin } from './roles';
import { search } from './search';
import {
  blockTask, closeTask, createTask, editTask, listPeople, myTasks, projectLog, renegotiate, reopenTask, setHealth, setPriority, taskLog,
  unblockTask, type Person,
} from './service';
import { seesTask } from './sight';
import { addDays, today as todayIst } from './time';
import { projectFor, seenProjects, seenTasks, sightFor, taskFor } from './visibility';

// The MCP server's protocol and tools (app/api/mcp/route.ts is the HTTP side). Every tool reads through the same
// visibility helpers as the pages (lib/visibility.ts) and writes through the same rules (lib/service.ts), as the
// signed-in person. Writes run inside via.run('claude'), so the history says "via Claude" (lib/origin.ts).
// Left out on purpose (founder's list, 27 Oct): deletes, bulk edits, people and permission changes.

export const LATEST = '2026-07-28';
export const LEGACY = ['2025-11-25', '2025-06-18', '2025-03-26'];
export const SUPPORTED = [LATEST, ...LEGACY];
const SERVER = { name: 'nico-desk', version: '1.0.0' };
const META_VERSION = 'io.modelcontextprotocol/protocolVersion';
const INSTRUCTIONS =
  'nico-desk holds a team\'s tasks and projects. You act as the signed-in person and see only what they see in the app. ' +
  'Status is one of Not started, In progress, Blocked, Done, Dropped. Late and at risk are worked out from dates, never set. ' +
  'Moving a due date, dropping a task, reopening one and blocking one each need a short reason. Every change you make is marked "via Claude" in the history.';

export type Ctx = { db: Db; me: Me; origin: string };

// ---------- shaping tasks for the model ----------

type Lookups = { names: Record<string, string>; projects: Record<string, string> };

async function lookups(c: Ctx): Promise<Lookups> {
  const [people, projects] = await Promise.all([listPeople(c.db, c.me.team.id), seenProjects(c.db, c.me)]);
  return {
    names: Object.fromEntries(people.map((p) => [p.id, p.displayName])),
    projects: Object.fromEntries(projects.map((p) => [p.id, p.name])),
  };
}

const FLAG = { late: 'Late', at_risk: 'At risk', ahead: 'Done ahead', on_time: 'Done on time' } as const;

function brief(t: Task, l: Lookups, c: Ctx, today: string) {
  const flag = flagKeyOf(t, today);
  return {
    id: t.id,
    title: t.title,
    status: WORD[statusOf(t)],
    flag: flag ? FLAG[flag] : null,
    owner: l.names[t.ownerId] ?? t.ownerId,
    project: t.projectId ? l.projects[t.projectId] ?? null : null,
    projectId: t.projectId && l.projects[t.projectId] ? t.projectId : null,
    dueOn: t.dueOn,
    priority: t.priority?.value ?? null,
    ...(t.blocked ? { blockedOn: t.blocked.onId ? l.names[t.blocked.onId] ?? null : null, blockReason: t.blocked.ask } : {}),
    url: `${c.origin}/tasks/${t.id}`,
  };
}

const byDue = (a: Task, b: Task) => a.dueOn.localeCompare(b.dueOn) || a.title.localeCompare(b.title);
const plainParts = (parts: Part[]) => parts.map((p) => (p.t === 'text' ? p.text : p.t === 'person' ? `@${p.name}` : p.t === 'task' ? p.title : p.t === 'project' ? `#${p.name}` : '(hidden)')).join('');

// ---------- finding people and projects by what the model has: an id, an email or a name ----------

const fold = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

function pickOne<T>(list: T[], q: string, keys: (x: T) => (string | null | undefined)[], label: (x: T) => string, what: string): T {
  const k = fold(q);
  const exact = list.filter((x) => keys(x).some((v) => v && fold(v) === k));
  if (exact.length === 1) return exact[0];
  const near = exact.length ? exact : list.filter((x) => keys(x).some((v) => v && fold(v).includes(k)));
  if (near.length === 1) return near[0];
  if (!near.length) throw bad('not_found', `No ${what} matches "${q}".`);
  throw bad('ambiguous', `"${q}" matches more than one ${what}: ${near.slice(0, 8).map(label).join(', ')}. Use the id.`);
}

async function personFor(c: Ctx, q: string): Promise<Person> {
  if (fold(q) === 'me') return c.me.person;
  const people = (await listPeople(c.db, c.me.team.id)).filter((p) => p.active);
  return pickOne(people, q, (p) => [p.id, p.email, p.displayName, p.fullName], (p) => `${p.displayName} (${p.id})`, 'active person');
}

async function projectIdFor(c: Ctx, q: string): Promise<string> {
  const projects = (await seenProjects(c.db, c.me)).filter((p) => !p.archivedAt);
  return pickOne(projects, q, (p) => [p.id, p.name], (p) => `${p.name} (${p.id})`, 'open project you can see').id;
}

// ---------- the tools ----------

const STATUS = z.enum(['Not started', 'In progress', 'Blocked', 'Done', 'Dropped']);
const KEY_OF: Record<z.infer<typeof STATUS>, StatusKey> = { 'Not started': 'todo', 'In progress': 'doing', Blocked: 'blocked', Done: 'done', Dropped: 'dropped' };
const PRIORITY = z.enum(['high', 'normal', 'low']);
const taskId = z.string().min(1).max(80).describe('The task id, for example from list_my_tasks or search_tasks.');

type Tool = {
  name: string; title: string; description: string; input: z.ZodObject; write: boolean;
  run: (c: Ctx, args: never) => Promise<Record<string, unknown>>;
};
const tool = <S extends z.ZodObject>(t: { name: string; title: string; description: string; input: S; write: boolean; run: (c: Ctx, a: z.infer<S>) => Promise<Record<string, unknown>> }) => t as unknown as Tool;

export const TOOLS: Tool[] = [
  tool({
    name: 'list_my_tasks',
    title: 'My tasks',
    description: 'The signed-in person\'s open tasks: ones waiting on them, ones newly assigned to them, and the rest they own. Soonest first.',
    input: z.object({}),
    write: false,
    async run(c) {
      const today = todayIst();
      const [mine, sight, l] = await Promise.all([myTasks(c.db, c.me.person.id, c.me.team.id, today), sightFor(c.db, c.me), lookups(c)]);
      const shape = (ts: Task[]) => ts.filter((t) => seesTask(sight, t)).map((t) => brief(t, l, c, today));
      return { waitingOnYou: shape(mine.blockedOnMe), newlyAssigned: shape(mine.assigned), yours: shape(mine.tasks) };
    },
  }),
  tool({
    name: 'search_tasks',
    title: 'Search tasks',
    description: 'Find tasks the person can see. All filters are optional and combine. The query matches words in titles, ' +
      'descriptions and notes, with a typo allowed, and understands the app\'s filters too (is:late, @name, #project, due:week). ' +
      'With no status given, only open tasks (Not started, In progress, Blocked) are returned.',
    input: z.object({
      query: z.string().max(200).optional(),
      status: z.array(STATUS).max(5).optional().describe('Keep only these status words.'),
      owner: z.string().max(120).optional().describe('A person id, email or name, or "me".'),
      project: z.string().max(120).optional().describe('A project id or name.'),
      flag: z.enum(['late', 'at_risk']).optional(),
      dueFrom: zDate.optional(),
      dueTo: zDate.optional(),
      limit: z.number().int().min(1).max(100).default(25),
    }),
    write: false,
    async run(c, a) {
      const today = todayIst();
      const sight = await sightFor(c.db, c.me);
      let ts = await seenTasks(c.db, c.me, today, sight);
      if (a.query?.trim()) {
        const hits = new Set((await search(c.db, c.me.team.id, sight, a.query, today, c.me.person.id)).filter((h) => h.kind === 'task').map((h) => h.id));
        ts = ts.filter((t) => hits.has(t.id));
      }
      const want = new Set((a.status?.length ? a.status : ['Not started', 'In progress', 'Blocked'] as const).map((s) => KEY_OF[s]));
      ts = ts.filter((t) => want.has(statusOf(t)));
      if (a.owner) { const p = await personFor(c, a.owner); ts = ts.filter((t) => t.ownerId === p.id); }
      if (a.project) { const id = await projectIdFor(c, a.project); ts = ts.filter((t) => t.projectId === id); }
      if (a.flag) ts = ts.filter((t) => flagKeyOf(t, today) === a.flag);
      if (a.dueFrom) ts = ts.filter((t) => t.dueOn >= a.dueFrom!);
      if (a.dueTo) ts = ts.filter((t) => t.dueOn <= a.dueTo!);
      const l = await lookups(c);
      return { total: ts.length, tasks: ts.sort(byDue).slice(0, a.limit).map((t) => brief(t, l, c, today)) };
    },
  }),
  tool({
    name: 'get_task',
    title: 'Task details',
    description: 'One task in full: its description, dates, status, who it waits on, its comments and its change history (newest first).',
    input: z.object({ taskId }),
    write: false,
    async run(c, a) {
      const today = todayIst();
      const t = await taskFor(c.db, c.me, a.taskId, today);
      const [l, log, comments] = await Promise.all([lookups(c), taskLog(c.db, t.id, undefined, 60), listComments(c.db, c.me, 'task', t.id)]);
      return {
        task: {
          ...brief(t, l, c, today), description: t.description, note: t.note, workstream: t.workstream, firstDueOn: t.firstDueOn,
          dateMoves: t.dateMoves, createdBy: t.createdBy ? l.names[t.createdBy] ?? null : null, readOnly: t.readOnly, version: t.version,
        },
        comments: comments.filter((m) => !m.deleted).map((m) => ({ by: m.authorName, at: m.createdAt, text: plainParts(m.parts), ...(m.via ? { via: 'Claude' } : {}) })),
        history: groupLog(log, l.names, l.projects).map((e) => ({ at: e.at, by: e.actorName, text: e.text })),
      };
    },
  }),
  tool({
    name: 'create_task',
    title: 'Create a task',
    description: 'Create a task. The assignee defaults to the signed-in person. Someone not yet on the project joins it as a Member, ' +
      'which only the project\'s owner or lead, a team lead or an admin may do. Priority other than normal needs a lead.',
    input: z.object({
      title: z.string().trim().min(3).max(200),
      dueOn: zDate.describe('YYYY-MM-DD, today or later.'),
      project: z.string().max(120).optional().describe('A project id or name.'),
      assignee: z.string().max(120).optional().describe('A person id, email or name, or "me".'),
      priority: PRIORITY.optional(),
      description: z.string().max(600).optional(),
    }),
    write: true,
    async run(c, a) {
      if (a.priority && a.priority !== 'normal' && !isLeadOrAdmin(c.me.person.appRoles)) throw forbidden('Only a lead can set a priority. Leave it out.');
      const [owner, projectId] = await Promise.all([a.assignee ? personFor(c, a.assignee) : c.me.person, a.project ? projectIdFor(c, a.project) : null]);
      let t = await createTask(c.db, c.me.person.id, { teamId: c.me.team.id, title: a.title, description: a.description ?? null, ownerId: owner.id, dueOn: a.dueOn, projectId });
      if (a.priority && a.priority !== 'normal') t = await setPriority(c.db, c.me.person.id, t.id, { version: t.version, value: a.priority });
      return { created: brief(t, await lookups(c), c, todayIst()) };
    },
  }),
  tool({
    name: 'update_task',
    title: 'Update a task',
    description: 'Change a task\'s status, assignee, due date or priority. Give only what changes. A reason is needed to move the due date, ' +
      'to drop, reopen or block a task, and to set a started task back to Not started. When blocking, the reason says what it waits for, ' +
      'and blockedOn may name the person. Reopening a closed task needs a lead. Priority needs a lead.',
    input: z.object({
      taskId,
      status: STATUS.optional(),
      assignee: z.string().max(120).optional().describe('A person id, email or name, or "me".'),
      dueOn: zDate.optional(),
      priority: PRIORITY.optional(),
      reason: z.string().max(280).optional(),
      blockedOn: z.string().max(120).optional().describe('With status Blocked: the person it waits on.'),
      version: z.number().int().positive().optional().describe('The version from get_task. When given, the change is refused if someone changed the task since.'),
    }),
    write: true,
    async run(c, a) {
      const me = c.me.person.id;
      let t = await taskFor(c.db, c.me, a.taskId);
      if (a.version && a.version !== t.version) throw new ApiError(409, 'version_conflict', 'Someone changed this task since you read it. Read it again.');
      const done: string[] = [];
      const why = a.reason?.trim() || undefined;
      const need = (what: string) => { if (!why) throw bad('reason_required', `${what} needs a reason. Ask the person and pass it as reason.`); return why; };
      const target = a.status ? KEY_OF[a.status] : null;
      // A closed task opens first, so the other changes can apply to it.
      if (t.statusCategory !== 'open' && ((target && target !== statusOf(t)) || a.dueOn || a.assignee)) {
        t = await reopenTask(c.db, me, t.id, { version: t.version, reason: need('Reopening a closed task') });
        done.push('reopened');
      }
      if (a.assignee) {
        const p = await personFor(c, a.assignee);
        if (p.id !== t.ownerId) { t = await editTask(c.db, me, t.id, { version: t.version, ownerId: p.id }); done.push(`assigned to ${p.displayName}`); }
      }
      if (a.dueOn && a.dueOn !== t.dueOn) {
        t = await renegotiate(c.db, me, t.id, { version: t.version, newDueOn: a.dueOn, reason: need('Moving the due date') });
        done.push(`due ${a.dueOn}`);
      }
      if (a.priority && a.priority !== (t.priority?.value ?? 'normal')) {
        t = await setPriority(c.db, me, t.id, { version: t.version, value: a.priority });
        done.push(`priority ${a.priority}`);
      }
      if (target && target !== statusOf(t)) {
        const v = () => t.version;
        if (target === 'done' || target === 'dropped') {
          t = await closeTask(c.db, me, t.id, { version: v(), as: target, reason: target === 'dropped' ? need('Dropping a task') : why });
        } else if (target === 'blocked') {
          const on = a.blockedOn ? (await personFor(c, a.blockedOn)).id : null;
          t = await blockTask(c.db, me, t.id, { version: v(), onId: on, ask: need('Blocking a task') });
        } else {
          if (t.blocked) t = await unblockTask(c.db, me, t.id, { version: v(), note: why, resume: target === 'doing' });
          if (target !== statusOf(t)) t = await setHealth(c.db, me, t.id, { version: v(), health: target === 'doing' ? 'on_track' : 'not_started', reason: why });
        }
        done.push(a.status!);
      }
      if (!done.length) throw bad('no_change', 'Nothing to change: the task already reads that way.');
      return { changed: done, task: brief(t, await lookups(c), c, todayIst()) };
    },
  }),
  tool({
    name: 'add_comment',
    title: 'Comment on a task',
    description: 'Add a comment to a task the person can see. Comments are 1 to 2000 characters. Nothing is emailed.',
    input: z.object({ taskId, text: z.string().min(1).max(2000) }),
    write: true,
    async run(c, a) {
      const t = await taskFor(c.db, c.me, a.taskId);
      const { comment } = await addComment(c.db, c.me, 'task', t.id, a.text);
      return { comment: { id: comment.id, task: t.title, at: comment.createdAt, text: plainParts(comment.parts) } };
    },
  }),
  tool({
    name: 'get_project_summary',
    title: 'Project summary',
    description: 'Where a project stands: its owner, lead and status, task counts by status, what is late, at risk or blocked, what is due in the next 7 days, and recent changes.',
    input: z.object({ project: z.string().min(1).max(120).describe('A project id or name.') }),
    write: false,
    async run(c, a) {
      const today = todayIst();
      const id = await projectIdFor(c, a.project).catch(async (e) => {
        // An archived project can still be summarised when named by id.
        if (e instanceof ApiError && /^prj_/.test(a.project)) return (await projectFor(c.db, c.me, a.project)).id;
        throw e;
      });
      const p = await projectFor(c.db, c.me, id);
      const sight = await sightFor(c.db, c.me);
      const [ts, l, log] = await Promise.all([seenTasks(c.db, c.me, today, sight).then((all) => all.filter((t) => t.projectId === id)), lookups(c), projectLog(c.db, id, 40)]);
      const open = ts.filter((t) => t.statusCategory === 'open').sort(byDue);
      const counts = Object.fromEntries(Object.values(WORD).map((w) => [w, 0]));
      for (const t of ts) counts[WORD[statusOf(t)]]++;
      const shape = (xs: Task[]) => xs.slice(0, 15).map((t) => brief(t, l, c, today));
      const seenIds = new Set(ts.map((t) => t.id));
      const recent = groupLog(log.filter((e) => e.entity_type === 'project' || seenIds.has(e.entity_id)), l.names, l.projects).slice(0, 12)
        .map((e) => ({ at: e.at, by: e.actorName, task: e.entity_type === 'task' ? e.taskTitle : null, text: e.text }));
      return {
        project: {
          id: p.id, name: p.name, department: p.department, owner: l.names[p.ownerId] ?? null, lead: l.names[p.leadId] ?? null,
          status: { on_track: 'On track', at_risk: 'At risk', off_track: 'Off track' }[p.status], statusNote: p.statusNote,
          archived: !!p.archivedAt, url: `${c.origin}/projects/${p.id}`,
        },
        counts,
        late: shape(open.filter((t) => flagKeyOf(t, today) === 'late')),
        atRisk: shape(open.filter((t) => flagKeyOf(t, today) === 'at_risk')),
        blocked: shape(open.filter((t) => t.blocked)),
        dueNext7Days: shape(open.filter((t) => t.dueOn >= today && t.dueOn <= addDays(today, 7))),
        recent,
      };
    },
  }),
];

// ---------- JSON-RPC ----------

type Rpc = { jsonrpc?: unknown; id?: unknown; method?: unknown; params?: Record<string, unknown> };
export type Reply = { status: number; body: unknown };

const rpcError = (id: unknown, status: number, code: number, message: string, data?: unknown): Reply =>
  ({ status, body: { jsonrpc: '2.0', id: id ?? null, error: { code, message, ...(data === undefined ? {} : { data }) } } });

export const listTools = () => TOOLS.map((t) => ({
  name: t.name, title: t.title, description: t.description,
  inputSchema: z.toJSONSchema(t.input, { io: 'input' }),
  annotations: { readOnlyHint: !t.write, destructiveHint: false, idempotentHint: !t.write, openWorldHint: false },
}));

// A tool's own failure (a rule said no, a bad argument) comes back as a result the model can read and act on;
// only a broken request is a protocol error.
async function callTool(c: Ctx, params: Record<string, unknown>) {
  const t = TOOLS.find((x) => x.name === params.name);
  if (!t) return null;
  const text = (s: string, isError: boolean, structured?: Record<string, unknown>) =>
    ({ content: [{ type: 'text', text: s }], ...(structured ? { structuredContent: structured } : {}), isError });
  try {
    const args = t.input.parse(params.arguments ?? {});
    if (t.write) rateLimit(`w:${c.me.realPerson.id}`, 60);
    const out = await via.run('claude', () => t.run(c, args as never));
    return text(JSON.stringify(out, null, 1), false, out);
  } catch (e) {
    if (e instanceof z.ZodError) return text(`Invalid arguments: ${e.issues.map((i) => `${i.path.join('.') || 'input'}: ${i.message}`).join('; ')}`, true);
    if (e instanceof ApiError) return text(e.status === 404 ? 'Not found, or not visible to you.' : e.message, true);
    console.error('[mcp] tool failed', t.name, e instanceof Error ? e.message.slice(0, 200) : 'unknown');
    return text('Something went wrong on the server.', true);
  }
}

// One JSON-RPC message in, one reply out. The stateless 2026-07-28 revision (protocol version on every request,
// server/discover) and the older initialize handshake are both answered, so any current Claude client can connect.
export async function handle(msg: unknown, headerVersion: string | null, ctx: () => Promise<Ctx>): Promise<Reply> {
  if (!msg || typeof msg !== 'object' || Array.isArray(msg)) return rpcError(null, 400, -32600, 'One JSON-RPC request per POST.');
  const m = msg as Rpc;
  if (m.jsonrpc !== '2.0' || typeof m.method !== 'string') return rpcError(m.id, 400, -32600, 'Not a JSON-RPC 2.0 request.');
  if (m.id === undefined) return { status: 202, body: null }; // a notification: nothing to answer
  const params = (m.params && typeof m.params === 'object' ? m.params : {}) as Record<string, unknown>;
  const ok = (result: Record<string, unknown>, fresh: boolean): Reply =>
    ({ status: 200, body: { jsonrpc: '2.0', id: m.id, result: fresh ? { resultType: 'complete', ...result } : result } });

  if (m.method === 'initialize') {
    const asked = typeof params.protocolVersion === 'string' ? params.protocolVersion : '';
    return ok({ protocolVersion: LEGACY.includes(asked) ? asked : LEGACY[0], capabilities: { tools: { listChanged: false } }, serverInfo: SERVER, instructions: INSTRUCTIONS }, false);
  }
  const meta = (params._meta ?? {}) as Record<string, unknown>;
  const metaVersion = typeof meta[META_VERSION] === 'string' ? meta[META_VERSION] as string : null;
  if (metaVersion && headerVersion && metaVersion !== headerVersion) {
    return rpcError(m.id, 400, -32600, 'HeaderMismatch: the MCP-Protocol-Version header and the request disagree.');
  }
  const version = metaVersion ?? headerVersion ?? '2025-03-26';
  if (!SUPPORTED.includes(version)) return rpcError(m.id, 400, -32022, 'Unsupported protocol version.', { supported: SUPPORTED, requested: version });
  const fresh = version === LATEST;

  switch (m.method) {
    case 'ping':
      return ok({}, fresh);
    case 'server/discover':
      return ok({
        supportedVersions: SUPPORTED, capabilities: { tools: {} }, _meta: { 'io.modelcontextprotocol/serverInfo': SERVER },
        instructions: INSTRUCTIONS, ttlMs: 3_600_000, cacheScope: 'user',
      }, fresh);
    case 'tools/list':
      return ok({ tools: listTools(), ...(fresh ? { ttlMs: 3_600_000, cacheScope: 'user' } : {}) }, fresh);
    case 'tools/call': {
      const out = await callTool(await ctx(), params);
      return out ? ok(out, fresh) : rpcError(m.id, 200, -32602, `Unknown tool: ${String(params.name)}`);
    }
    default:
      return rpcError(m.id, fresh ? 404 : 200, -32601, `Method not found: ${m.method}`);
  }
}
