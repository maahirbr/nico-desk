import crypto from 'node:crypto';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// The MCP server (27 Oct): the OAuth flow Claude signs in with, the JSON-RPC protocol, and that every tool
// sees and changes only what the person could in the app, marked "via Claude".

vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }), headers: async () => new Headers() }));

import type { Me } from '../lib/auth';
import { openDb, type Db } from '../lib/db';
import { handle, LATEST, TOOLS, type Ctx } from '../lib/mcp';
import { checkAuthRequest, exchange, issueCode, readAccess, registerClient, resourceOf } from '../lib/mcpAuth';
import { TEAM_ID } from '../lib/seed';
import * as s from '../lib/service';
import { seenTasks } from '../lib/visibility';

const ORIGIN = 'https://desk.test';
const LEAD = 'per_ada';
const DEE = 'per_dee';
const HIDDEN = 'prj_tiers'; // DEE has no tie to it (tests/visibility.test.ts)
let db: Db;
let hiddenTask: string;
let seenTask: string;

beforeAll(() => { process.env.NICO_TODAY = '2026-10-09'; });
beforeEach(async () => {
  db = await openDb();
  await db.query(`UPDATE people SET restricted = true WHERE id = $1`, [DEE]);
  const tasks = await s.teamTasks(db, TEAM_ID);
  hiddenTask = tasks.find((t) => t.projectId === HIDDEN && t.ownerId !== DEE && t.blocked?.onId !== DEE)!.id;
  seenTask = (await seenTasks(db, await meAs(DEE))).find((t) => t.ownerId === DEE && t.statusCategory === 'open')!.id;
});

async function meAs(id: string): Promise<Me> {
  const person = (await s.listPeople(db, TEAM_ID)).find((p) => p.id === id)!;
  return { person, realPerson: person, viewingAs: false, team: { id: TEAM_ID, name: 'Team', teamType: 'department' } };
}

const ctx = (id: string) => async (): Promise<Ctx> => ({ db, me: await meAs(id), origin: ORIGIN });
const meta = { 'io.modelcontextprotocol/protocolVersion': LATEST };
let n = 0;
const rpc = (method: string, params: Record<string, unknown> = {}) => ({ jsonrpc: '2.0', id: ++n, method, params: { ...params, _meta: meta } });

async function call(id: string, name: string, args: Record<string, unknown> = {}) {
  const r = await handle(rpc('tools/call', { name, arguments: args }), LATEST, ctx(id));
  const res = (r.body as { result: { isError: boolean; structuredContent?: Record<string, unknown>; content: { text: string }[] } }).result;
  return { error: res.isError ? res.content[0].text : null, out: res.structuredContent as Record<string, any> };
}

// ---------- OAuth ----------

const verifier = crypto.randomBytes(32).toString('base64url');
const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
const REDIRECT = 'https://claude.ai/api/mcp/auth_callback';

function client(uris = [REDIRECT], name = 'Claude') {
  const r = registerClient({ redirect_uris: uris, client_name: name, token_endpoint_auth_method: 'none' });
  if ('error' in r) throw new Error(r.error);
  return r.clientId;
}

function authorize(clientId: string, extra: Record<string, string> = {}) {
  return checkAuthRequest(new URLSearchParams({
    client_id: clientId, redirect_uri: REDIRECT, response_type: 'code', state: 'st',
    code_challenge: challenge, code_challenge_method: 'S256', resource: resourceOf(ORIGIN), ...extra,
  }), ORIGIN);
}

function codeFor(clientId: string) {
  const a = authorize(clientId);
  if (!('req' in a)) throw new Error(a.error);
  const back = new URL(issueCode(a.req, DEE, ORIGIN));
  expect(back.origin + back.pathname).toBe(REDIRECT);
  expect(back.searchParams.get('state')).toBe('st');
  expect(back.searchParams.get('iss')).toBe(ORIGIN);
  return back.searchParams.get('code')!;
}

const form = (o: Record<string, string>) => new URLSearchParams(o);

describe('mcp sign-in', () => {
  it('registers only Claude and loopback return addresses', () => {
    expect('error' in registerClient({ redirect_uris: ['https://evil.example/cb'] })).toBe(true);
    expect('error' in registerClient({ redirect_uris: ['https://claude.ai.evil.example/cb'] })).toBe(true);
    expect('error' in registerClient({ redirect_uris: ['http://claude.ai/cb'] })).toBe(true);
    expect('error' in registerClient({ redirect_uris: [REDIRECT], token_endpoint_auth_method: 'client_secret_basic' })).toBe(true);
    expect('clientId' in registerClient({ redirect_uris: ['http://127.0.0.1:33418/callback'] })).toBe(true);
  });

  it('refuses a forged client and a return address it did not register', () => {
    expect(authorize('forged.abc')).toMatchObject({ error: expect.any(String) });
    expect('redirect' in authorize(client(), { redirect_uri: 'https://claude.ai/other' })).toBe(false);
  });

  it('sends request errors back to the client once the return address is trusted', () => {
    const id = client();
    expect(authorize(id, { code_challenge_method: 'plain' })).toMatchObject({ error: 'invalid_request' });
    expect(authorize(id, { resource: 'https://other.test/api/mcp' })).toMatchObject({ error: 'invalid_target' });
    expect(authorize(id, { response_type: 'token' })).toMatchObject({ error: 'unsupported_response_type' });
  });

  it('accepts a loopback return address on another port', () => {
    const id = client(['http://127.0.0.1:1000/callback']);
    const a = checkAuthRequest(new URLSearchParams({
      client_id: id, redirect_uri: 'http://127.0.0.1:5555/callback', response_type: 'code', code_challenge: challenge, code_challenge_method: 'S256',
    }), ORIGIN);
    expect('req' in a).toBe(true);
  });

  it('trades a code and its PKCE verifier for tokens, and a refresh token for new ones', () => {
    const id = client();
    const code = codeFor(id);
    const base = { grant_type: 'authorization_code', client_id: id, code, redirect_uri: REDIRECT };
    expect(exchange(form({ ...base, code_verifier: crypto.randomBytes(32).toString('base64url') }), ORIGIN)).toMatchObject({ error: 'invalid_grant' });
    expect(exchange(form({ ...base, code_verifier: verifier, redirect_uri: 'https://claude.ai/x' }), ORIGIN)).toMatchObject({ error: 'invalid_grant' });
    expect(exchange(form({ ...base, code_verifier: verifier, client_id: client([REDIRECT], 'Other') }), ORIGIN)).toMatchObject({ error: 'invalid_grant' });
    const t = exchange(form({ ...base, code_verifier: verifier }), ORIGIN);
    if ('error' in t) throw new Error(t.error);
    expect(readAccess(`Bearer ${t.access_token}`, ORIGIN)).toMatchObject({ personId: DEE });
    const again = exchange(form({ grant_type: 'refresh_token', client_id: id, refresh_token: t.refresh_token }), ORIGIN);
    expect('access_token' in again).toBe(true);
  });

  it('never lets one kind of sealed value stand in for another, or a token for another server', () => {
    const id = client();
    const code = codeFor(id);
    expect(readAccess(`Bearer ${code}`, ORIGIN)).toBeNull();
    expect(readAccess(`Bearer ${id}`, ORIGIN)).toBeNull();
    const t = exchange(form({ grant_type: 'authorization_code', client_id: id, code, redirect_uri: REDIRECT, code_verifier: verifier }), ORIGIN);
    if ('error' in t) throw new Error(t.error);
    expect(readAccess(`Bearer ${t.access_token}`, 'https://other.test')).toBeNull();
    expect(readAccess(`Bearer ${t.refresh_token}`, ORIGIN)).toBeNull();
    expect(exchange(form({ grant_type: 'refresh_token', client_id: id, refresh_token: t.access_token }), ORIGIN)).toMatchObject({ error: 'invalid_grant' });
    expect(readAccess(`Bearer ${t.access_token.slice(0, -2)}xx`, ORIGIN)).toBeNull();
  });
});

// ---------- protocol ----------

describe('mcp protocol', () => {
  it('answers the stateless revision and lists the seven v1 tools', async () => {
    const d = await handle(rpc('server/discover'), LATEST, ctx(DEE));
    expect(d.body).toMatchObject({ result: { resultType: 'complete', supportedVersions: expect.arrayContaining([LATEST]) } });
    const r = await handle(rpc('tools/list'), LATEST, ctx(DEE));
    const tools = (r.body as { result: { tools: { name: string; inputSchema: { type: string } }[] } }).result.tools;
    expect(tools.map((t) => t.name)).toEqual(['list_my_tasks', 'search_tasks', 'get_task', 'create_task', 'update_task', 'add_comment', 'get_project_summary']);
    expect(tools.every((t) => t.inputSchema.type === 'object')).toBe(true);
  });

  it('answers the older initialize handshake', async () => {
    const r = await handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } }, null, ctx(DEE));
    expect(r.body).toMatchObject({ result: { protocolVersion: '2025-06-18', serverInfo: { name: 'nico-desk' } } });
    const old = await handle({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, '2025-06-18', ctx(DEE));
    expect((old.body as { result: { resultType?: string } }).result.resultType).toBeUndefined();
  });

  it('refuses bad versions, mismatches, batches and unknown methods', async () => {
    expect((await handle(rpc('tools/list'), '2025-06-18', ctx(DEE))).status).toBe(400);
    const bad = await handle({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: { _meta: { 'io.modelcontextprotocol/protocolVersion': '2099-01-01' } } }, '2099-01-01', ctx(DEE));
    expect(bad).toMatchObject({ status: 400, body: { error: { code: -32022 } } });
    expect((await handle([rpc('ping')], LATEST, ctx(DEE))).status).toBe(400);
    expect(await handle(rpc('nope/nope'), LATEST, ctx(DEE))).toMatchObject({ status: 404, body: { error: { code: -32601 } } });
    expect(await handle({ jsonrpc: '2.0', method: 'notifications/initialized' }, LATEST, ctx(DEE))).toMatchObject({ status: 202 });
    expect(await handle(rpc('tools/call', { name: 'delete_everything' }), LATEST, ctx(DEE))).toMatchObject({ body: { error: { code: -32602 } } });
  });

  it('returns a bad argument as a tool error the model can read', async () => {
    const r = await call(DEE, 'create_task', { title: 'x' });
    expect(r.error).toMatch(/Invalid arguments/);
  });
});

// ---------- tools ----------

describe('mcp tools', () => {
  it('lists and searches only tasks the person can see', async () => {
    const mine = await call(DEE, 'list_my_tasks');
    const ids = [...mine.out.waitingOnYou, ...mine.out.newlyAssigned, ...mine.out.yours].map((t: { id: string }) => t.id);
    expect(ids).toContain(seenTask);
    const all = await call(DEE, 'search_tasks', { status: ['Not started', 'In progress', 'Blocked', 'Done', 'Dropped'], limit: 100 });
    expect(all.out.tasks.map((t: { id: string }) => t.id)).not.toContain(hiddenTask);
    expect(all.out.total).toBe((await seenTasks(db, await meAs(DEE))).length);
    const lead = await call(LEAD, 'search_tasks', { owner: 'me' });
    expect(lead.out.tasks.every((t: { owner: string; status: string }) => ['Not started', 'In progress', 'Blocked'].includes(t.status))).toBe(true);
  });

  it('hides a task and a project the person cannot see', async () => {
    expect((await call(DEE, 'get_task', { taskId: hiddenTask })).error).toMatch(/Not found/);
    expect((await call(DEE, 'add_comment', { taskId: hiddenTask, text: 'hi' })).error).toMatch(/Not found/);
    expect((await call(DEE, 'get_project_summary', { project: HIDDEN })).error).toBeTruthy();
    expect((await call(DEE, 'create_task', { title: 'Sneak in', dueOn: '2026-10-20', project: HIDDEN })).error).toBeTruthy();
  });

  it('reads a task with its comments and history', async () => {
    const r = await call(DEE, 'get_task', { taskId: seenTask });
    expect(r.error).toBeNull();
    expect(r.out.task).toMatchObject({ id: seenTask, url: `${ORIGIN}/tasks/${seenTask}` });
    expect(Array.isArray(r.out.history)).toBe(true);
  });

  it('marks comments and changes made through Claude', async () => {
    const c = await call(DEE, 'add_comment', { taskId: seenTask, text: 'Checked with the vendor.' });
    expect(c.error).toBeNull();
    const { rows } = await db.query<{ via: string | null }>(`SELECT via FROM comments WHERE id = $1`, [c.out.comment.id]);
    expect(rows[0].via).toBe('claude');
    const u = await call(DEE, 'update_task', { taskId: seenTask, dueOn: '2026-10-30', reason: 'Vendor is late' });
    expect(u.error).toBeNull();
    const ev = await db.query<{ origin: string }>(`SELECT origin FROM events WHERE entity_id = $1 ORDER BY at DESC LIMIT 1`, [seenTask]);
    expect(ev.rows[0].origin).toBe('claude');
    const read = await call(DEE, 'get_task', { taskId: seenTask });
    expect(read.out.history.some((h: { text: string }) => h.text.endsWith('(via Claude)'))).toBe(true);
    expect(read.out.comments.at(-1)).toMatchObject({ via: 'Claude' });
  });

  it('asks for a reason the rules need, and refuses a priority from a member', async () => {
    expect((await call(DEE, 'update_task', { taskId: seenTask, dueOn: '2026-10-30' })).error).toMatch(/reason/);
    expect((await call(DEE, 'update_task', { taskId: seenTask, status: 'Dropped' })).error).toMatch(/reason/);
    expect((await call(DEE, 'update_task', { taskId: seenTask, priority: 'high' })).error).toBeTruthy();
    expect((await call(DEE, 'create_task', { title: 'Call the mill', dueOn: '2026-10-20', priority: 'high' })).error).toMatch(/lead/);
  });

  it('creates a task and moves it through its statuses', async () => {
    const c = await call(DEE, 'create_task', { title: 'Call the mill about yarn', dueOn: '2026-10-20' });
    expect(c.error).toBeNull();
    expect(c.out.created).toMatchObject({ owner: expect.any(String), status: 'Not started' });
    const id = c.out.created.id;
    expect((await call(DEE, 'update_task', { taskId: id, status: 'In progress' })).out.task.status).toBe('In progress');
    expect((await call(DEE, 'update_task', { taskId: id, status: 'Blocked', reason: 'Waiting on the price list' })).out.task.status).toBe('Blocked');
    expect((await call(DEE, 'update_task', { taskId: id, status: 'In progress' })).out.task.status).toBe('In progress');
    expect((await call(DEE, 'update_task', { taskId: id, status: 'Done' })).out.task.status).toBe('Done');
    expect((await call(DEE, 'update_task', { taskId: id, status: 'Done' })).error).toMatch(/Nothing to change/);
  });

  it('summarises a project the person can see', async () => {
    const r = await call(LEAD, 'get_project_summary', { project: HIDDEN });
    expect(r.error).toBeNull();
    expect(r.out.project).toMatchObject({ id: HIDDEN });
    const total = Object.values(r.out.counts as Record<string, number>).reduce((a, b) => a + b, 0);
    expect(total).toBe((await seenTasks(db, await meAs(LEAD))).filter((t) => t.projectId === HIDDEN).length);
  });

  it('gives every tool a description and an object schema', () => {
    expect(TOOLS).toHaveLength(7);
    for (const t of TOOLS) expect(t.description.length).toBeGreaterThan(20);
  });
});
