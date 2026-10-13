import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// The thread map (13 Oct): the "Connects to" links as a graph around one item. Pure graph assembly first (a fake
// neighbour function, no database), then the same links on the fixtures, then what a restricted reader never gets,
// then the route and the layout. The map and the panel must agree, because the map is built from the panel's lines.

const state = vi.hoisted(() => ({ jar: {} as Record<string, string>, testDb: null as unknown }));

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (n: string) => (n in state.jar ? { name: n, value: state.jar[n] } : undefined) }),
  headers: async () => new Headers(),
}));
vi.mock('../lib/db', async (orig) => ({ ...(await orig<typeof import('../lib/db')>()), db: async () => state.testDb }));

import { GET as mapRoute } from '../app/api/v1/threads/map/route';
import { mapFocusFrom, SHORTCUTS } from '../components/keys';
import { COOKIE, VIEW_COOKIE, signSession, signView, type Me } from '../lib/auth';
import { addComment } from '../lib/comments';
import { openDb, type Db } from '../lib/db';
import { ApiError } from '../lib/errors';
import { TEAM_ID } from '../lib/seed';
import * as s from '../lib/service';
import { threadsFor, type ThreadKind } from '../lib/threads';
import { chainOf, edgeKey, GRID, LABEL_MAX, layoutMap, truncate } from '../lib/threadLayout';
import {
  assembleGraph, hrefOf, linksOf, mapQuery, nodeId, parseFocus, threadMapFor, MAX_HOPS, NODE_CAP,
  type EdgeKind, type MapLink, type ThreadMap,
} from '../lib/threadMap';

const AS_OF = '2026-10-09';
const ADA = 'per_ada'; // a lead, sees everything; owns the landing page project and tsk_034, tsk_036
const FAY = 'per_fay'; // admin; owns tsk_043 (landing page)
const DEE = 'per_dee'; // a member on the shoot, made restricted below; owns tsk_027 and tsk_041
const LANDING = 'prj_landing'; // hidden from DEE
let db: Db;

beforeAll(() => { process.env.NICO_TODAY = AS_OF; process.env.NICO_SESSION_SECRET = 'thread-map-test-secret'; });
beforeEach(async () => {
  db = await openDb();
  state.testDb = db;
  state.jar = {};
  await db.query(`UPDATE people SET restricted = true WHERE id = $1`, [DEE]);
});

async function meAs(id: string, viewingAs = false): Promise<Me> {
  const people = await s.listPeople(db, TEAM_ID);
  const person = people.find((p) => p.id === id)!;
  const real = viewingAs ? people.find((p) => p.appRoles.includes('admin'))! : person;
  return { person, realPerson: real, viewingAs, team: { id: TEAM_ID, name: 'Team', teamType: 'department' } };
}
const mapOf = async (as: string, kind: ThreadKind, id: string, opts: { hops?: number; cap?: number } = {}, viewingAs = false) =>
  threadMapFor(db, await meAs(as, viewingAs), kind, id, opts);
async function status(p: Promise<unknown>): Promise<number | 'ok'> {
  try { await p; } catch (e) { if (e instanceof ApiError) return e.status; throw e; }
  return 'ok';
}
const titleOf = async (id: string) => (await s.getTask(db, id)).title;
async function block(taskId: string, ownerId: string, onId: string) {
  const t = await s.getTask(db, taskId);
  await s.blockTask(db, ownerId, taskId, { version: t.version, onId, ask: 'Need the copy first' });
}
async function say(as: string, kind: 'task' | 'project', subjectId: string, body: string) {
  return addComment(db, await meAs(as), kind, subjectId, body);
}

// A small fake world for the pure walk. Edges are undirected for the walk, directed for the picture.
//   a (focus) -part_of-> p1 <-part_of- b <-mentions- d <-mentions- e      a -waits_on-> x <-waits_on- c
type Raw = [string, string, EdgeKind];
const RAW: Raw[] = [
  ['task:a', 'project:p1', 'part_of'], ['task:b', 'project:p1', 'part_of'], ['task:d', 'task:b', 'mentions'],
  ['task:e', 'task:d', 'mentions'], ['task:a', 'person:x', 'waits_on'], ['task:c', 'person:x', 'waits_on'],
];
function world(raw: Raw[], missing: string[] = []) {
  const ids = new Set(raw.flatMap(([f, t]) => [f, t]).filter((id) => !missing.includes(id)));
  const calls: string[] = [];
  return {
    calls,
    expand: async (id: string): Promise<MapLink[]> => { calls.push(id); return raw.filter(([f, t]) => f === id || t === id).map(([from, to, kind]) => ({ from, to, kind })); },
    describe: (id: string) => (ids.has(id) ? { kind: id.split(':')[0] as ThreadKind, label: `Item ${id.split(':')[1]}`, flags: [] } : null),
  };
}
const idsOf = (m: ThreadMap) => m.nodes.map((n) => n.id).sort();
const hopOf = (m: ThreadMap) => Object.fromEntries(m.nodes.map((n) => [n.id, n.hop]));

describe('assembleGraph: hops', () => {
  it('walks one step, two steps and three steps from the focus', async () => {
    const w = world(RAW);
    const one = await assembleGraph({ focus: 'task:a', hops: 1, ...w });
    expect(idsOf(one)).toEqual(['person:x', 'project:p1', 'task:a']);
    const two = await assembleGraph({ focus: 'task:a', hops: 2, ...world(RAW) });
    expect(hopOf(two)).toEqual({ 'task:a': 0, 'project:p1': 1, 'person:x': 1, 'task:b': 2, 'task:c': 2 });
    const three = await assembleGraph({ focus: 'task:a', hops: 3, ...world(RAW) });
    expect(hopOf(three)).toMatchObject({ 'task:d': 3 });
    expect(three.nodes).toHaveLength(6); // e is four steps away
    expect(three.more).toBe(0);
  });

  it('does not expand the items at the edge of the limit', async () => {
    const w = world(RAW);
    await assembleGraph({ focus: 'task:a', hops: 2, ...w });
    expect(w.calls.sort()).toEqual(['person:x', 'project:p1', 'task:a']);
  });

  it('keeps hops between 1 and the maximum', async () => {
    expect((await assembleGraph({ focus: 'task:a', hops: 0, ...world(RAW) })).hops).toBe(1);
    expect((await assembleGraph({ focus: 'task:a', hops: 9, ...world(RAW) })).hops).toBe(MAX_HOPS);
    expect(MAX_HOPS).toBe(3);
  });

  it('reads a missing focus as not found', async () => {
    await expect(assembleGraph({ focus: 'task:zzz', hops: 2, ...world(RAW) })).rejects.toMatchObject({ status: 404 });
  });

  it('leaves out an item it may not describe, and the link to it', async () => {
    const m = await assembleGraph({ focus: 'task:a', hops: 3, ...world(RAW, ['project:p1']) });
    expect(idsOf(m)).not.toContain('project:p1');
    expect(m.edges.some((e) => e.from === 'project:p1' || e.to === 'project:p1')).toBe(false);
    expect(idsOf(m)).not.toContain('task:b'); // only reachable through the left-out project
  });
});

describe('assembleGraph: the cap and "more not shown"', () => {
  const STAR: Raw[] = [...Array(10).keys()].map((i): Raw => ['task:hub', `task:leaf${i}`, 'mentions']).concat([['task:leaf0', 'task:leaf9', 'mentions']]);

  it('stops at the cap and counts every item left out, once', async () => {
    const m = await assembleGraph({ focus: 'task:hub', hops: 2, cap: 4, ...world(STAR) });
    expect(m.nodes).toHaveLength(4);
    expect(m.more).toBe(7);
    const kept = new Set(m.nodes.map((n) => n.id));
    for (const e of m.edges) { expect(kept.has(e.from)).toBe(true); expect(kept.has(e.to)).toBe(true); }
  });

  it('shows everything under the cap with a count of zero', async () => {
    const m = await assembleGraph({ focus: 'task:hub', hops: 2, cap: 60, ...world(STAR) });
    expect(m.nodes).toHaveLength(11);
    expect(m.more).toBe(0);
  });

  it('uses about sixty as the default cap', async () => {
    const big: Raw[] = [...Array(80).keys()].map((i): Raw => ['task:hub', `task:n${i}`, 'mentions']);
    const m = await assembleGraph({ focus: 'task:hub', hops: 1, ...world(big) });
    expect(NODE_CAP).toBe(60);
    expect(m.nodes).toHaveLength(NODE_CAP);
    expect(m.more).toBe(21);
  });
});

describe('assembleGraph: no duplicate edges', () => {
  it('draws one edge when two items list the same link, or one list repeats it', async () => {
    const dup: Raw[] = [...RAW, ['task:a', 'project:p1', 'part_of'], ['task:a', 'project:p1', 'part_of']];
    const m = await assembleGraph({ focus: 'task:a', hops: 3, ...world(dup) });
    const keys = m.edges.map(edgeKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.filter((k) => k === 'task:a|project:p1|part_of')).toHaveLength(1);
  });

  it('keeps two kinds of link between the same two items', async () => {
    const m = await assembleGraph({ focus: 'task:a', hops: 1, ...world([['task:a', 'task:b', 'mentions'], ['task:b', 'task:a', 'mentions'], ['task:a', 'task:b', 'waits_on']]) });
    expect(m.edges).toHaveLength(3);
  });

  it('puts the edges in one fixed order', async () => {
    const a = await assembleGraph({ focus: 'task:a', hops: 3, ...world(RAW) });
    const b = await assembleGraph({ focus: 'task:a', hops: 3, ...world([...RAW].reverse()) });
    expect(b.edges).toEqual(a.edges);
  });
});

describe('the focus address', () => {
  it('accepts task, project and person ids and nothing else', () => {
    for (const ok of ['task:tsk_034', 'project:prj_landing', 'person:per_ada', 'task:a.b-c_1']) expect(mapQuery.safeParse({ focus: ok }).success, ok).toBe(true);
    for (const bad of ['', 'task:', 'tsk_034', 'user:per_ada', 'task:../etc', 'task:a b', 'task:a:b', 'task:a/b', `task:${'x'.repeat(65)}`, 'TASK:x'])
      expect(mapQuery.safeParse({ focus: bad }).success, bad).toBe(false);
    expect(mapQuery.safeParse({}).success).toBe(false);
  });

  it('defaults to two steps and refuses one outside 1 to 3', () => {
    expect(mapQuery.parse({ focus: 'task:a' }).hops).toBe(2);
    expect(mapQuery.parse({ focus: 'task:a', hops: '3' }).hops).toBe(3);
    for (const h of ['0', '4', '-1', '1.5', 'x']) expect(mapQuery.safeParse({ focus: 'task:a', hops: h }).success, h).toBe(false);
  });

  it('splits an address into a kind and an id', () => {
    expect(parseFocus('person:per_ada')).toEqual({ kind: 'person', id: 'per_ada' });
    expect(parseFocus('nope')).toBeNull();
    expect(parseFocus(null)).toBeNull();
    expect(hrefOf(nodeId('task', 't1'))).toBe('/tasks/t1');
    expect(hrefOf('project:p1')).toBe('/projects/p1');
    expect(hrefOf('person:x')).toBe('/people/x');
  });
});

describe('linksOf: Connects to lines become edges', () => {
  const line = (rel: string, kind: string, id: string | null) => ({ rel, kind, id, title: 't', who: null, sub: null, href: null }) as never;
  it('turns each relation into one edge, and skips lines that open no item', () => {
    const out = linksOf('task:a', [
      line('Part of', 'project', 'p1'), line('Waits on', 'person', 'x'), line('Waiting on it', 'task', 'w'), line('Mentioned in', 'task', 'm'),
      line('From', 'minutes', null), line('Links', 'link', 'l1'), line('Checkpoints', 'checkpoint', null),
    ]);
    expect(out).toEqual([
      { from: 'task:a', to: 'project:p1', kind: 'part_of' },
      { from: 'task:a', to: 'person:x', kind: 'waits_on' },
      { from: 'task:w', to: 'task:a', kind: 'waits_on' },
      { from: 'task:m', to: 'task:a', kind: 'mentions' },
    ]);
  });

  it('reads project and person lines the right way round', () => {
    expect(linksOf('project:p', [line('Owner', 'person', 'o'), line('Lead', 'person', 'l'), line('People', 'person', 'q')])).toEqual([
      { from: 'person:o', to: 'project:p', kind: 'owns' }, { from: 'person:l', to: 'project:p', kind: 'owns' }, { from: 'person:q', to: 'project:p', kind: 'part_of' },
    ]);
    expect(linksOf('person:x', [line('Owns', 'project', 'p'), line('Waiting on them', 'task', 't')])).toEqual([
      { from: 'person:x', to: 'project:p', kind: 'owns' }, { from: 'task:t', to: 'person:x', kind: 'waits_on' },
    ]);
  });
});

describe('the map agrees with Connects to', () => {
  async function arrange() {
    await block('tsk_043', FAY, ADA); // tsk_043 waits on Ada, so it waits on tsk_034 and tsk_036 through their owner
    await say(ADA, 'task', 'tsk_036', 'Read [[task:tsk_034]] and [[project:prj_shoot]]');
    await say(FAY, 'task', 'tsk_043', 'Over to @[[person:per_ada]]');
  }
  const items: [string, ThreadKind, string][] = [
    [ADA, 'task', 'tsk_034'], [ADA, 'task', 'tsk_043'], [ADA, 'task', 'tsk_036'], [ADA, 'project', 'prj_shoot'], [ADA, 'project', 'prj_studio'],
    [ADA, 'project', LANDING], [ADA, 'person', ADA], [ADA, 'person', 'per_cy'], [DEE, 'task', 'tsk_027'], [DEE, 'person', DEE],
  ];

  it('has, one step out, exactly the items the panel lists, with the same relation', async () => {
    await arrange();
    for (const [as, kind, id] of items) {
      const lines = (await threadsFor(db, await meAs(as), kind, id)).filter((l) => (l.kind === 'task' || l.kind === 'project' || l.kind === 'person') && l.id);
      const m = await mapOf(as, kind, id, { hops: 1, cap: 500 });
      const focus = nodeId(kind, id);
      const neighbours = m.nodes.filter((n) => n.id !== focus).map((n) => n.id).sort();
      expect(neighbours, `${kind}:${id}`).toEqual([...new Set(lines.map((l) => nodeId(l.kind as ThreadKind, l.id!)))].sort());
      // every line is an edge between the focus and that item
      for (const l of lines) {
        const other = nodeId(l.kind as ThreadKind, l.id!);
        expect(m.edges.some((e) => (e.from === focus && e.to === other) || (e.to === focus && e.from === other)), `${kind}:${id} ${l.rel} ${l.title}`).toBe(true);
      }
      expect(m.edges.every((e) => e.from === focus || e.to === focus)).toBe(true);
    }
  });

  it('names each node the way the panel does', async () => {
    await arrange();
    const m = await mapOf(ADA, 'task', 'tsk_034', { hops: 1 });
    const lines = await threadsFor(db, await meAs(ADA), 'task', 'tsk_034');
    for (const l of lines.filter((x) => x.id && (x.kind === 'task' || x.kind === 'project' || x.kind === 'person')))
      expect(m.nodes.find((n) => n.id === nodeId(l.kind as ThreadKind, l.id!))!.label).toBe(l.title);
  });

  it('draws the same edge words as the panel relations', async () => {
    await arrange();
    const m = await mapOf(ADA, 'task', 'tsk_034', { hops: 1 });
    const kinds = (to: string) => m.edges.filter((e) => e.from === to || e.to === to).map((e) => e.kind);
    expect(kinds(`project:${LANDING}`)).toEqual(['part_of']);
    expect(kinds('task:tsk_043')).toEqual(['waits_on']);
    expect(kinds('task:tsk_036')).toEqual(['mentions']);
  });

  it('flags a late task and gives each node a status', async () => {
    const m = await mapOf(ADA, 'person', ADA, { hops: 2, cap: 100 });
    const late = m.nodes.filter((n) => n.kind === 'task' && n.flags?.includes('late'));
    for (const n of m.nodes.filter((x) => x.kind !== 'person')) expect(n.status, n.id).toBeTruthy();
    for (const n of late) expect((await s.getTask(db, n.id.slice(5))).dueOn < AS_OF).toBe(true);
  });

  it('never repeats an edge or a node, whatever the focus', async () => {
    await arrange();
    for (const [as, kind, id] of items) {
      const m = await mapOf(as, kind, id, { hops: 3 });
      expect(new Set(m.edges.map(edgeKey)).size).toBe(m.edges.length);
      expect(new Set(m.nodes.map((n) => n.id)).size).toBe(m.nodes.length);
      expect(m.nodes[0].id).toBe(nodeId(kind, id));
      expect(m.nodes[0].hop).toBe(0);
      const ids = new Set(m.nodes.map((n) => n.id));
      for (const e of m.edges) { expect(ids.has(e.from)).toBe(true); expect(ids.has(e.to)).toBe(true); }
    }
  });

  it('defaults to two steps and holds the cap', async () => {
    expect((await mapOf(ADA, 'person', ADA)).hops).toBe(2);
    const tight = await mapOf(ADA, 'person', ADA, { hops: 3, cap: 5 });
    expect(tight.nodes.length).toBeLessThanOrEqual(5);
    expect(tight.more).toBeGreaterThan(0);
  });

  it('reads an unknown item as not found', async () => {
    expect(await status(mapOf(ADA, 'task', 'tsk_nope'))).toBe(404);
    expect(await status(mapOf(ADA, 'person', 'per_nobody'))).toBe(404);
    expect(await status(mapOf(ADA, 'project', 'prj_nope'))).toBe(404);
  });
});

describe('the map and sight: a hidden project or task is never a node', () => {
  const HIDDEN = ['Autumn landing page', 'Loyalty tier pilot', LANDING, 'prj_tiers', 'tsk_036'];

  async function arrange() {
    await block('tsk_043', FAY, 'per_cy'); // a hidden task waits on someone else
    await say(ADA, 'task', 'tsk_036', 'Check [[task:tsk_027]] with [[project:prj_shoot]] and [[person:per_dee]]'); // a hidden thread
    await say(ADA, 'task', 'tsk_041', 'Same crop as [[task:tsk_027]]'); // a visible thread
  }
  const focuses: [ThreadKind, string][] = [
    ['task', 'tsk_027'], ['task', 'tsk_041'], ['project', 'prj_shoot'], ['person', DEE], ['person', 'per_cy'], ['person', ADA], ['person', FAY],
  ];

  it('gives a restricted reader no hidden item, label or id, even unlabeled, at any depth', async () => {
    await arrange();
    const hiddenTitle = await titleOf('tsk_036');
    for (const viewing of [false, true]) {
      for (const [kind, id] of focuses) {
        const m = await mapOf(DEE, kind, id, { hops: 3, cap: 500 }, viewing);
        const text = JSON.stringify(m);
        for (const w of [...HIDDEN, hiddenTitle]) expect(text, `${kind}:${id} viewing=${viewing} leaks ${w}`).not.toContain(w);
        expect(m.nodes.some((n) => n.id === `project:${LANDING}` || n.id === 'task:tsk_036')).toBe(false);
        expect(m.nodes.every((n) => n.label.trim() !== '')).toBe(true); // no node without a name
      }
    }
  });

  it('does not count a hidden item in "more"', async () => {
    await arrange();
    const m = await mapOf(DEE, 'person', ADA, { hops: 3, cap: 500 });
    expect(m.more).toBe(0);
    const all = await mapOf(ADA, 'person', ADA, { hops: 3, cap: 500 });
    expect(all.nodes.length).toBeGreaterThan(m.nodes.length); // the lead sees more
  });

  it('reads a hidden focus as not found, through View as too', async () => {
    for (const viewing of [false, true]) {
      expect(await status(mapOf(DEE, 'task', 'tsk_036', {}, viewing))).toBe(404);
      expect(await status(mapOf(DEE, 'project', LANDING, {}, viewing))).toBe(404);
      expect(await status(mapOf(DEE, 'project', 'prj_tiers', {}, viewing))).toBe(404);
    }
  });

  it('shows the lead the items the restricted reader does not see', async () => {
    await arrange();
    const m = await mapOf(ADA, 'person', ADA, { hops: 2, cap: 500 });
    expect(m.nodes.map((n) => n.id)).toContain(`project:${LANDING}`);
    const t = await mapOf(ADA, 'task', 'tsk_036', { hops: 1, cap: 500 });
    expect(t.nodes.map((n) => n.id)).toEqual(expect.arrayContaining(['task:tsk_036', `project:${LANDING}`]));
  });

  it('shows a project once it is opened to the reader', async () => {
    await db.query(`INSERT INTO project_viewers (project_id, person_id, added_by) VALUES ($1, $2, $3)`, [LANDING, DEE, ADA]);
    const m = await mapOf(DEE, 'task', 'tsk_036', { hops: 1 });
    expect(m.nodes.map((n) => n.id)).toContain(`project:${LANDING}`);
  });
});

describe('GET /api/v1/threads/map', () => {
  const call = (qs: string, headers: Record<string, string> = {}) =>
    mapRoute(new Request(`http://localhost/api/v1/threads/map${qs}`, { method: 'GET', headers: { host: 'localhost', ...headers } }), { params: Promise.resolve({} as Record<string, never>) });
  const signIn = (id: string, view?: string) => { state.jar = { [COOKIE]: signSession(id), ...(view ? { [VIEW_COOKIE]: view } : {}) }; };

  it('refuses a signed-out request', async () => {
    expect((await call('?focus=task:tsk_034')).status).toBe(401);
  });

  it('refuses a bad or missing focus before it touches the data', async () => {
    signIn(ADA);
    for (const qs of ['', '?focus=', '?focus=tsk_034', '?focus=user:per_ada', '?focus=task:', '?focus=task:..%2Fetc', '?focus=task:a%20b', `?focus=task:${'x'.repeat(65)}`, '?focus=task:tsk_034&focus=%00']) {
      const res = await call(qs);
      expect(res.status, qs).toBe(400);
      expect((await res.json()).error.code).toBe('invalid_body');
    }
  });

  it('refuses steps outside 1 to 3', async () => {
    signIn(ADA);
    for (const h of ['0', '4', '99', '-1', 'two']) expect((await call(`?focus=task:tsk_034&hops=${h}`)).status, h).toBe(400);
  });

  it('answers 404 for an unknown item', async () => {
    signIn(ADA);
    for (const f of ['task:tsk_nope', 'project:prj_nope', 'person:per_nobody']) expect((await call(`?focus=${f}`)).status, f).toBe(404);
  });

  it('answers 404 for a hidden item, with nothing about it in the body', async () => {
    signIn(DEE);
    for (const f of ['task:tsk_036', `project:${LANDING}`]) {
      const res = await call(`?focus=${f}`);
      expect(res.status, f).toBe(404);
      expect(JSON.stringify(await res.json())).not.toContain('Autumn landing page');
    }
  });

  it('returns nodes, edges and the count of what is not shown', async () => {
    signIn(ADA);
    const res = await call('?focus=task:tsk_034&hops=2');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.focus).toBe('task:tsk_034');
    expect(body.hops).toBe(2);
    expect(body.more).toBe(0);
    expect(body.nodes[0]).toMatchObject({ id: 'task:tsk_034', kind: 'task', hop: 0 });
    expect(body.nodes.map((n: { id: string }) => n.id)).toContain(`project:${LANDING}`);
    expect(body.edges).toContainEqual({ from: 'task:tsk_034', to: `project:${LANDING}`, kind: 'part_of' });
  });

  it('cuts what a restricted reader gets, and what a viewed person gets under View as', async () => {
    signIn(DEE);
    const own = JSON.stringify(await (await call('?focus=person:per_ada&hops=3')).json());
    for (const w of ['Autumn landing page', LANDING, 'tsk_036']) expect(own).not.toContain(w);
    signIn(FAY, signView(FAY, DEE));
    const viewed = JSON.stringify(await (await call('?focus=person:per_ada&hops=3')).json());
    for (const w of ['Autumn landing page', LANDING, 'tsk_036']) expect(viewed).not.toContain(w);
  });

  it('allows a read under View as, which only blocks writes', async () => {
    signIn(FAY, signView(FAY, DEE));
    expect((await call('?focus=task:tsk_027')).status).toBe(200);
  });
});

describe('the layout is deterministic', () => {
  async function fake(raw = RAW, hops = 3) { return assembleGraph({ focus: 'task:a', hops, ...world(raw) }); }

  it('gives the same numbers for the same map', async () => {
    const m = await fake();
    expect(JSON.stringify(layoutMap(m))).toBe(JSON.stringify(layoutMap(structuredClone(m))));
  });

  it('does not depend on the order the nodes and edges arrive in', async () => {
    const m = await fake();
    const shuffled: ThreadMap = { ...m, nodes: [...m.nodes].reverse(), edges: [...m.edges].reverse() };
    const at = (l: ReturnType<typeof layoutMap>) => l.nodes.map((n) => `${n.id}@${n.x},${n.y}`).sort();
    expect(at(layoutMap(shuffled))).toEqual(at(layoutMap(m)));
    expect(layoutMap(shuffled).edges.map((e) => `${e.key}=${e.d}`).sort()).toEqual(layoutMap(m).edges.map((e) => `${e.key}=${e.d}`).sort());
  });

  it('puts one step in one column, left to right, and never two items on one spot', async () => {
    const m = await fake();
    const l = layoutMap(m);
    for (const n of l.nodes) expect(n.x).toBe(GRID.padX + n.hop * GRID.colW);
    expect(new Set(l.nodes.map((n) => `${n.x},${n.y}`)).size).toBe(l.nodes.length);
    expect(l.nodes[0].id).toBe('task:a'); // the keyboard starts at the focus
    for (let i = 1; i < l.nodes.length; i++) expect(l.nodes[i].hop).toBeGreaterThanOrEqual(l.nodes[i - 1].hop);
  });

  it('keeps every item and every curve inside the picture', async () => {
    const l = layoutMap(await fake());
    for (const n of l.nodes) { expect(n.x).toBeGreaterThanOrEqual(0); expect(n.y).toBeGreaterThanOrEqual(0); expect(n.x).toBeLessThan(l.width); expect(n.y).toBeLessThanOrEqual(l.height); }
    expect(l.edges).toHaveLength(5); // the sixth link, e to d, is four steps out
    for (const e of l.edges) expect(e.d).toMatch(/^M-?\d+ -?\d+C(-?\d+ -?\d+ ?){3}$/);
  });

  it('orders a column by its neighbours, ties by kind and name', async () => {
    const m = await fake();
    const l = layoutMap(m);
    const col1 = l.nodes.filter((n) => n.hop === 1);
    expect(col1.map((n) => n.id)).toEqual(['project:p1', 'person:x']); // projects come before people
    const col2 = l.nodes.filter((n) => n.hop === 2).map((n) => n.id);
    expect(col2).toEqual(['task:b', 'task:c']); // b sits by p1, c by x
  });

  it('draws a map of one item, and a crowded column, without failing', async () => {
    const lone = layoutMap(await assembleGraph({ focus: 'task:a', hops: 2, ...world([['task:a', 'task:a', 'mentions']]) }));
    expect(lone.nodes).toHaveLength(1);
    const star = await assembleGraph({ focus: 'task:hub', hops: 1, ...world([...Array(30).keys()].map((i): Raw => ['task:hub', `task:n${i}`, 'mentions'])) });
    const l = layoutMap(star);
    expect(l.height).toBeGreaterThan(30 * 20);
    expect(l.nodes).toHaveLength(31);
  });

  it('cuts long labels with an ellipsis and keeps short ones', () => {
    expect(truncate('Short')).toBe('Short');
    const long = truncate('A very long task title that would not fit on one line');
    expect(long.length).toBeLessThanOrEqual(LABEL_MAX);
    expect(long.endsWith('…')).toBe(true);
    expect(truncate('x'.repeat(LABEL_MAX))).toBe('x'.repeat(LABEL_MAX));
  });
});

describe('the lit chain', () => {
  async function chain(id: string) { const m = await assembleGraph({ focus: 'task:a', hops: 3, ...world(RAW) }); return { m, c: chainOf(m, id) }; }

  it('lights the item, its way back to the focus and its direct links', async () => {
    const { c } = await chain('task:d');
    expect([...c.nodes].sort()).toEqual(['project:p1', 'task:a', 'task:b', 'task:d']);
    expect([...c.edges].sort()).toEqual(['task:a|project:p1|part_of', 'task:b|project:p1|part_of', 'task:d|task:b|mentions']);
  });

  it('leaves the other branches dim', async () => {
    const { c } = await chain('task:d');
    expect(c.nodes.has('person:x')).toBe(false);
    expect(c.nodes.has('task:c')).toBe(false);
    expect(c.edges.has('task:c|person:x|waits_on')).toBe(false);
  });

  it('lights the direct links of a node at the edge too, but they do not carry on', async () => {
    const { c } = await chain('project:p1');
    expect([...c.nodes].sort()).toEqual(['project:p1', 'task:a', 'task:b']);
  });

  it('lights only the focus and its links for the focus', async () => {
    const { c } = await chain('task:a');
    expect([...c.nodes].sort()).toEqual(['person:x', 'project:p1', 'task:a']);
  });

  it('lights just an item it does not know', async () => {
    const { c } = await chain('task:nope');
    expect([...c.nodes]).toEqual(['task:nope']);
    expect(c.edges.size).toBe(0);
  });
});

describe('key T', () => {
  it('maps the item whose page you are on', () => {
    expect(mapFocusFrom('/tasks/tsk_034', '')).toBe('/map?focus=task:tsk_034');
    expect(mapFocusFrom('/projects/prj_shoot', '')).toBe('/map?focus=project:prj_shoot');
    expect(mapFocusFrom('/people/per_ada', '?x=1')).toBe('/map?focus=person:per_ada');
    expect(mapFocusFrom('/tasks/tsk_034/', '')).toBe('/map?focus=task:tsk_034');
  });

  it('maps the task in the open drawer', () => {
    expect(mapFocusFrom('/me', '?task=tsk_027')).toBe('/map?focus=task:tsk_027');
    expect(mapFocusFrom('/projects', '?task=tsk_027&week=2')).toBe('/map?focus=task:tsk_027');
  });

  it('does nothing anywhere else', () => {
    for (const [p, q] of [['/me', ''], ['/team', ''], ['/tasks', ''], ['/tasks/new', ''], ['/map', '?focus=task:x&task=tsk_1'], ['/tasks/a/b', ''], ['/me', '?task=a%20b'], ['/me', '?task=']] as const)
      expect(mapFocusFrom(p, q), `${p}${q}`).toBeNull();
  });

  it('is in the shortcut list', () => {
    expect(SHORTCUTS.some(([k, what]) => k === 't' && /thread map/i.test(what))).toBe(true);
  });
});
