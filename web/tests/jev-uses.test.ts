import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { openDb, type Db } from '../lib/db';
import { jevCacheClear } from '../lib/jev';
import {
  checkDrafts, combineChecks, doneByNote, combineOrder, dateFacts, draftQuestions, duplicateCandidates, fillIfEmpty, FLOOR, guessProject, healthKeyOf,
  isYes, projectHealth, projectQuestion, readHealth, readinessOf, readProject, readScore, recentNotes, suggestedOrder, taskFacts, YESNO,
  type Draft, type OpenTask, type ProjectOpt,
} from '../lib/jevUses';
import { getProject, planOp, pendingProposals } from '../lib/plan';
import { TEAM_ID } from '../lib/seed';
import { getTask, teamTasks } from '../lib/service';
import type { Task } from '../lib/derive';

// The newer Jev uses, with the network mocked. No test here calls the real API.
const AS_OF = '2026-10-09';
const ON = { NICO_JEV: '1', TYPESAFE_API_KEY: 'test-key-not-real' };
const OFF = {};

const ok = (answers: unknown) => new Response(JSON.stringify({ answers, usage: { input_tokens: 5, output_tokens: 2 } }), { status: 200 });
const score = (s: number, confidence = 0.8) => ({ type: 'score', score: s, confidence, legend: {}, probabilities: {} });
const yes = (p: number) => ({ noul: p });
const bodyOf = (m: ReturnType<typeof vi.fn>, call = 0) => (m.mock.calls[call] as [string, { body: string }])[1].body;

let fetchMock: ReturnType<typeof vi.fn>;
let db: Db;
beforeAll(() => { process.env.NICO_TODAY = AS_OF; });
beforeEach(async () => {
  jevCacheClear();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  db = await openDb();
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

const openTasks = async () => (await teamTasks(db, TEAM_ID, AS_OF)).filter((t) => t.statusCategory === 'open');
const count = async (t: string) => (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${t}`)).rows[0].n;
const snapshot = async () => Promise.all(['tasks', 'events', 'projects', 'plan_proposals', 'comments', 'notices'].map(count));

describe('the floor', () => {
  it('uses a Score or Choice only at 0.6 confidence or more', () => {
    expect(readScore(score(1.4, FLOOR), 3)).toBe(1.4);
    expect(readScore(score(1.4, FLOOR - 0.01), 3)).toBeNull();
    expect(readScore(score(1.4, 0.2), 3)).toBeNull();
  });

  it('reads a malformed or missing score as no answer, and keeps the value in range', () => {
    expect(readScore(undefined, 3)).toBeNull();
    expect(readScore({ score: 'high', confidence: 0.9 }, 3)).toBeNull();
    expect(readScore({ score: 1 }, 3)).toBeNull();
    expect(readScore(score(7), 3)).toBe(2);
    expect(readScore(score(-2), 3)).toBe(0);
  });

  it('says yes to a yes/no only at 0.65 or more', () => {
    expect(isYes(yes(YESNO))).toBe(true);
    expect(isYes(yes(YESNO - 0.01))).toBe(false);
    expect(isYes(yes(0.99))).toBe(true);
    expect(isYes(undefined)).toBe(false);
    expect(isYes({})).toBe(false);
  });

  it('names no project below the floor, for None of these, or for an option that does not exist', () => {
    const list: ProjectOpt[] = [
      { id: 'prj_a', department: 'Digital', intro: null, workstreams: [] },
      { id: 'prj_b', department: 'Brand', intro: null, workstreams: ['Shoot'] },
    ];
    expect(readProject({ choice: 'P2', probabilities: { P2: FLOOR } }, list)).toBe('prj_b');
    expect(readProject({ choice: 'P2', probabilities: { P2: FLOOR - 0.01 } }, list)).toBeNull();
    expect(readProject({ choice: 'None of these', probabilities: { 'None of these': 0.99 } }, list)).toBeNull();
    expect(readProject({ choice: 'P9', probabilities: { P9: 0.99 } }, list)).toBeNull();
    expect(readProject(undefined, list)).toBeNull();
  });

  it('gives no health label, no wording note and no duplicate note below the floor', () => {
    expect(readHealth(score(2, 0.59), 5)).toEqual({ state: 'unsure', notes: 5 });
    const drafts: Draft[] = [{ id: 'p1', task: 'Fix the hero image', ownerId: 'per_bo', dueOn: '2026-10-20' }];
    const cands = { d0: [{ id: 'tsk_1', title: 'Fix hero image' }] };
    const [c] = combineChecks(drafts, cands, { w0: score(0, 0.5), d0_0: yes(0.64) });
    expect(c.wording).toBeNull();
    expect(c.duplicate).toBeNull();
    const [s] = combineChecks(drafts, cands, { w0: score(0, 0.9), d0_0: yes(0.9) });
    expect(s.wording).toBe('not_a_task');
    expect(s.duplicate).toEqual({ taskId: 'tsk_1', title: 'Fix hero image' });
  });

  it('suggests no order when no task is scored above the floor', async () => {
    const tasks = (await openTasks()).slice(0, 3);
    fetchMock.mockResolvedValue(ok({ t0: score(2, 0.4), t1: score(2, 0.5), t2: score(0, 0.1) }));
    expect(await suggestedOrder(db, TEAM_ID, tasks, AS_OF, ON)).toEqual({ ok: false, reason: 'unavailable' });
  });
});

describe('an error means no answer', () => {
  it('order, health, drafts and project guess all fall back when the call fails', async () => {
    const tasks = (await openTasks()).slice(0, 4);
    fetchMock.mockRejectedValue(new Error('offline'));
    expect(await suggestedOrder(db, TEAM_ID, tasks, AS_OF, ON)).toEqual({ ok: false, reason: 'unavailable' });
    expect(await checkDrafts(db, TEAM_ID, [{ id: 'p1', task: 'Fix the hero image', ownerId: null, dueOn: null }], [], ON)).toEqual({ ok: false, reason: 'unavailable' });
    const list: ProjectOpt[] = [{ id: 'a', department: 'x', intro: null, workstreams: [] }, { id: 'b', department: 'y', intro: null, workstreams: [] }];
    expect(await guessProject(db, TEAM_ID, 'Book the studio for the shoot', list, ON)).toBeNull();
  });

  it('treats an HTTP error, bad JSON and a missing answer as no answer', async () => {
    const tasks = (await openTasks()).slice(0, 3);
    fetchMock.mockResolvedValueOnce(new Response('', { status: 500 }));
    expect((await suggestedOrder(db, TEAM_ID, tasks, AS_OF, ON)).ok).toBe(false);
    fetchMock.mockResolvedValueOnce(new Response('not json', { status: 200 }));
    expect((await suggestedOrder(db, TEAM_ID, tasks, AS_OF, ON)).ok).toBe(false);
    fetchMock.mockResolvedValueOnce(ok({}));
    expect((await suggestedOrder(db, TEAM_ID, tasks, AS_OF, ON)).ok).toBe(false);
  });

  it('never throws, even when the database read fails', async () => {
    const broken = { query: () => { throw new Error('db down'); } } as unknown as Db;
    const project = await getProject(db, 'prj_landing');
    expect(await projectHealth(broken, TEAM_ID, project, [], AS_OF, ON)).toMatchObject({ state: 'unavailable' });
    expect(await suggestedOrder(broken, TEAM_ID, await openTasks(), AS_OF, ON)).toEqual({ ok: false, reason: 'unavailable' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('flags off means no call', () => {
  it('makes no request from any of the uses', async () => {
    const tasks = await openTasks();
    const project = await getProject(db, 'prj_landing');
    const list: ProjectOpt[] = [{ id: 'a', department: 'x', intro: null, workstreams: [] }, { id: 'b', department: 'y', intro: null, workstreams: [] }];
    expect(await suggestedOrder(db, TEAM_ID, tasks, AS_OF, OFF)).toEqual({ ok: false, reason: 'off' });
    expect(await projectHealth(db, TEAM_ID, project, tasks, AS_OF, OFF)).toEqual({ state: 'off', notes: 0 });
    expect(await checkDrafts(db, TEAM_ID, [{ id: 'p1', task: 'Fix the hero image', ownerId: null, dueOn: null }], [], OFF)).toEqual({ ok: false, reason: 'off' });
    expect(await guessProject(db, TEAM_ID, 'Book the studio for the shoot', list, OFF)).toBeNull();
    expect(await suggestedOrder(db, TEAM_ID, tasks, AS_OF, { NICO_JEV: '1' })).toEqual({ ok: false, reason: 'off' }); // no key
    expect(await suggestedOrder(db, TEAM_ID, tasks, AS_OF, { ...ON, DATABASE_URL: 'postgres://x' })).toEqual({ ok: false, reason: 'off' }); // hosted, not live
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('asks nothing for a lone task, an empty queue or a one-project list', async () => {
    const one = (await openTasks()).slice(0, 1);
    expect(await suggestedOrder(db, TEAM_ID, one, AS_OF, ON)).toEqual({ ok: false, reason: 'unavailable' });
    expect(await checkDrafts(db, TEAM_ID, [], [], ON)).toEqual({ ok: false, reason: 'unavailable' });
    expect(await guessProject(db, TEAM_ID, 'Book the studio', [{ id: 'a', department: 'x', intro: null, workstreams: [] }], ON)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('what is sent is masked', () => {
  it('sends no roster name, email, phone or project name from task text, notes or drafts', async () => {
    const dict = (await import('../lib/redact')).maskDictFor;
    const d = await dict(db, TEAM_ID);
    const bad = d.people.flatMap((p) => [...p.names, ...p.emails]).concat(d.projects, ['90000', 'example.test']);
    expect(bad.length).toBeGreaterThan(5);
    const base = (await openTasks()).slice(0, 3);
    const tasks: Task[] = base.map((t, i) => ({
      ...t, title: `Chase Meera Iyer and Kabir Sethi about Autumn landing page ${i}`, note: 'Mail meera@example.test or +91 90000 00001, see https://docs.example.test/a',
      blocked: { onId: 'per_ada', ask: 'Waiting on Ananya Rao for Campaign shoot plan', at: '2026-10-01T00:00:00Z' },
    }));
    fetchMock.mockResolvedValue(ok({ t0: score(2), t1: score(1), t2: score(0) }));
    const r = await suggestedOrder(db, TEAM_ID, tasks, AS_OF, ON);
    expect(r.ok).toBe(true);
    let sent = bodyOf(fetchMock).toLowerCase();
    for (const w of bad) expect(sent, w).not.toContain(w.toLowerCase());

    fetchMock.mockClear(); jevCacheClear();
    fetchMock.mockResolvedValue(ok({ w0: score(2), d0_0: yes(0.9) }));
    await checkDrafts(db, TEAM_ID, [{ id: 'p1', task: 'Send Kabir Sethi the Autumn landing page copy, mail meera@example.test', ownerId: null, dueOn: null }],
      [{ id: 't1', title: 'Send Kabir Sethi the Autumn landing page copy' }], ON);
    sent = bodyOf(fetchMock).toLowerCase();
    for (const w of bad) expect(sent, w).not.toContain(w.toLowerCase());
  });

  it('masks names written in project updates and comments before a health read', async () => {
    for (const [i, text] of ['Meera Iyer is waiting on Kabir Sethi', 'Ananya Rao says the Campaign shoot plan slips', 'Mail meera@example.test about it'].entries()) {
      await db.query(`INSERT INTO comments (id, subject_kind, subject_id, author_id, body, created_at) VALUES ($1,'project','prj_landing','per_ada',$2,$3)`,
        [`cm_t${i}`, text, `2026-10-0${6 + i}T05:00:00Z`]);
    }
    const project = await getProject(db, 'prj_landing');
    fetchMock.mockResolvedValue(ok({ health: score(1.2) }));
    const out = await projectHealth(db, TEAM_ID, project, await openTasks(), AS_OF, ON);
    expect(out).toMatchObject({ state: 'suggestion', key: 'at_risk', word: 'At risk' });
    const sent = bodyOf(fetchMock).toLowerCase();
    for (const w of ['meera', 'kabir', 'ananya', 'iyer', 'example.test', 'campaign shoot plan']) expect(sent, w).not.toContain(w);
  });
});

describe('the suggested order', () => {
  const mk = (over: Partial<Task>): Task => ({
    id: 'x', title: 'x', description: null, ownerId: 'per_ada', projectId: null, dueOn: '2026-10-20', firstDueOn: '2026-10-20', note: null,
    statusCategory: 'open', blocked: null, priority: null, overdue: false, version: 1, ...over,
  } as unknown as Task);

  it('keeps the default order when nothing is scored and the dates tie', () => {
    const tasks = ['a', 'b', 'c', 'd'].map((id) => mk({ id }));
    expect(combineOrder(tasks, new Map(), AS_OF).ids).toEqual(['a', 'b', 'c', 'd']);
  });

  it('puts late before due soon before later, from the dates in code', () => {
    const late = mk({ id: 'late', dueOn: '2026-10-05', overdue: true });
    const soon = mk({ id: 'soon', dueOn: '2026-10-10' });
    const later = mk({ id: 'later', dueOn: '2026-11-20' });
    expect(combineOrder([later, soon, late], new Map(), AS_OF).ids).toEqual(['late', 'soon', 'later']);
    expect(dateFacts(late, AS_OF).why).toEqual(['Late by 4 days']);
  });

  it('lets the words change the order but not outrank a late task by a small margin', () => {
    const a = mk({ id: 'a', dueOn: '2026-10-25' });
    const b = mk({ id: 'b', dueOn: '2026-10-25' });
    expect(combineOrder([a, b], new Map([['b', 2]]), AS_OF).ids).toEqual(['b', 'a']);
    const late = mk({ id: 'late', dueOn: '2026-10-08', overdue: true });
    expect(combineOrder([a, late], new Map([['a', 2]]), AS_OF).ids[0]).toBe('late');
  });

  it('returns every task once, on a real answer', async () => {
    const tasks = (await openTasks()).filter((t) => t.ownerId === 'per_ada').slice(0, 5);
    expect(tasks.length).toBeGreaterThan(1);
    fetchMock.mockResolvedValue(ok(Object.fromEntries(tasks.map((_, i) => [`t${i}`, score(i % 3)]))));
    const r = await suggestedOrder(db, TEAM_ID, tasks, AS_OF, ON);
    expect(r.ok && [...r.ids].sort()).toEqual(tasks.map((t) => t.id).sort());
  });

  it('is only a sort option on Home: the default is By date and nothing asks Jev until it is picked', () => {
    const home = readFileSync(join(__dirname, '../components/HomeView.tsx'), 'utf8');
    expect(home).toContain("useState<'date' | 'suggested'>('date')");
    expect(home.match(/\/me\/tasks\/order/g)?.length).toBe(1); // one call site
    expect(home).toMatch(/async function pickOrder[\s\S]*?\/me\/tasks\/order/); // only inside the picker
    expect(home).toContain('Showing the default order'); // and it says so when it falls back
    expect(home).toContain('{!suggested && groups.map'); // the date groups stay unless a suggestion is on
    const route = readFileSync(join(__dirname, '../app/api/v1/me/tasks/order/route.ts'), 'utf8');
    expect(route).toContain('ok: false'); // an unavailable answer is a plain no
  });
});

describe('project health', () => {
  it('maps a score to one of three words', () => {
    expect([0, 0.4, 0.6, 1.4, 1.6, 2].map(healthKeyOf)).toEqual(['on_track', 'on_track', 'at_risk', 'at_risk', 'slipping', 'slipping']);
  });

  it('counts from the dates in code', async () => {
    const tasks = (await teamTasks(db, TEAM_ID, AS_OF)).filter((t) => t.projectId === 'prj_shoot');
    const f = taskFacts(tasks, AS_OF, '2026-10-30');
    expect(f.open).toBe(tasks.filter((t) => t.statusCategory === 'open').length);
    expect(f.late).toBe(tasks.filter((t) => t.statusCategory === 'open' && t.overdue).length);
    expect(f.days_to_launch).toBe(21);
  });

  it('asks nothing when there are too few recent notes', async () => {
    const project = await getProject(db, 'prj_tiers');
    await db.query(`DELETE FROM comments`);
    const out = await projectHealth(db, TEAM_ID, project, [], AS_OF, ON);
    expect(out.state).toBe('few');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('is a suggestion only: it stores nothing and never changes the project status', async () => {
    for (let i = 0; i < 4; i++) {
      await db.query(`INSERT INTO comments (id, subject_kind, subject_id, author_id, body, created_at) VALUES ($1,'project','prj_shoot','per_cy',$2,$3)`,
        [`cm_h${i}`, `Update ${i}: the shoot date moved again`, `2026-10-0${3 + i}T05:00:00Z`]);
    }
    const project = await getProject(db, 'prj_shoot');
    const before = await snapshot();
    const status = (await db.query(`SELECT status, status_note, status_at FROM projects ORDER BY id`)).rows;
    fetchMock.mockResolvedValue(ok({ health: score(1.9, 0.9) }));
    const out = await projectHealth(db, TEAM_ID, project, await openTasks(), AS_OF, ON);
    expect(out).toMatchObject({ state: 'suggestion', key: 'slipping' });
    expect(await snapshot()).toEqual(before);
    expect((await db.query(`SELECT status, status_note, status_at FROM projects ORDER BY id`)).rows).toEqual(status);
    expect((await getProject(db, 'prj_shoot')).status).toBe(project.status);
    // The word Jev gives is never one of the stored project statuses.
    expect(['on_track', 'at_risk', 'off_track']).not.toContain('slipping');
  });

  it('reads the update notes of a task project and the activity of a plan project', async () => {
    await db.query(`INSERT INTO events (id, entity_type, entity_id, field, after, actor_id, origin, at)
      SELECT 'ev_t1', 'task', id, '_update', '"Quote came in higher"'::jsonb, 'per_ada', 'app', '2026-10-07T05:00:00Z' FROM tasks WHERE project_id = 'prj_landing' LIMIT 1`);
    const landing = await getProject(db, 'prj_landing');
    expect((await recentNotes(db, landing, AS_OF)).some((n) => n.includes('Quote came in higher'))).toBe(true);
    const plan = await getProject(db, 'prj_studio');
    await db.query(`INSERT INTO plan_activity (id, project_id, summary, at) VALUES ('pa_t1', 'prj_studio', 'Line 2 moved to Blocked', '2026-10-08T05:00:00Z')`);
    expect((await recentNotes(db, plan, AS_OF)).some((n) => n.includes('Line 2 moved to Blocked'))).toBe(true);
    // Older than two weeks is left out.
    await db.query(`INSERT INTO comments (id, subject_kind, subject_id, author_id, body, created_at) VALUES ('cm_old','project','prj_landing','per_ada','Ancient news','2026-08-01T05:00:00Z')`);
    expect((await recentNotes(db, landing, AS_OF)).some((n) => n.includes('Ancient news'))).toBe(false);
  });
});

describe('check drafts', () => {
  it('judges owner and date in code, whatever Jev says', () => {
    expect(readinessOf({ ownerId: 'per_bo', dueOn: '2026-10-20' })).toBe('ready');
    expect(readinessOf({ ownerId: null, dueOn: '2026-10-20' })).toBe('needs_owner');
    expect(readinessOf({ ownerId: 'per_bo', dueOn: null })).toBe('needs_date');
    expect(readinessOf({ ownerId: null, dueOn: null })).toBe('needs_both');
    const drafts: Draft[] = [{ id: 'p1', task: 'Look into fonts', ownerId: null, dueOn: null }];
    const [c] = combineChecks(drafts, {}, { w0: score(2, 0.99) }); // Jev calls it a clear task; the rule still stands
    expect(c.readiness).toBe('needs_both');
  });

  it('finds duplicate candidates by code first, and asks only about those', () => {
    const open: OpenTask[] = [
      { id: 't1', title: 'Fix the hero image on the landing page' },
      { id: 't2', title: 'Order hamper boxes' },
      { id: 't3', title: 'Approve invoice' },
    ];
    expect(duplicateCandidates('Fix hero image', open).map((o) => o.id)).toEqual(['t1']);
    expect(duplicateCandidates('Plan the autumn shoot', open)).toEqual([]);
    const { questions, cands } = draftQuestions([{ id: 'p1', task: 'Fix hero image', ownerId: null, dueOn: null }, { id: 'p2', task: 'Plan the autumn shoot', ownerId: null, dueOn: null }], open);
    expect(Object.keys(questions).sort()).toEqual(['d0_0', 'w0', 'w1']); // one yes/no, for the one candidate
    expect(cands.d0.length).toBe(1);
  });

  it('changes no draft, writes nothing, and does not take the drafts from the caller', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const me = 'per_ada';
    await planOp(db, me, 'prj_landing', { op: 'importMinutes', title: 'Web sync', date: AS_OF, text: '(Kabir Sethi) Fix the hero image (Oct 20)\n(Someone) Look into fonts' }, AS_OF);
    const ps = await pendingProposals(db, 'prj_landing');
    expect(ps.length).toBe(2);
    const drafts = ps.map((x) => ({ id: x.id, task: x.task, ownerId: x.ownerId, dueOn: x.dueOn }));
    const frozen = JSON.parse(JSON.stringify(drafts));
    const before = await snapshot();
    fetchMock.mockResolvedValue(ok({ w0: score(2, 0.9), w1: score(1, 0.9) }));
    const r = await checkDrafts(db, TEAM_ID, drafts, [], ON);
    expect(r.ok && r.checks.map((c) => [c.id, c.readiness, c.wording])).toEqual([[ps[0].id, 'ready', 'clear'], [ps[1].id, 'needs_both', 'vague']]);
    expect(drafts).toEqual(frozen);
    expect(await snapshot()).toEqual(before);
    expect(await pendingProposals(db, 'prj_landing')).toEqual(ps);
    const route = readFileSync(join(__dirname, '../app/api/v1/projects/[id]/check-drafts/route.ts'), 'utf8');
    expect(route).toContain('pendingProposals(db, p.id)');
    expect(route).not.toContain('readBody'); // no caller-supplied drafts
  });
});

describe('project guess', () => {
  const list: ProjectOpt[] = [
    { id: 'prj_a', department: 'Digital', intro: 'The autumn landing page', workstreams: ['Copy', 'Build'] },
    { id: 'prj_b', department: 'Brand', intro: null, workstreams: [] },
  ];

  it('offers a fixed list with a None option and labels that carry no project name', () => {
    const q = projectQuestion(list);
    expect(q.type).toBe('choice');
    expect(Object.keys((q as { criteria: Record<string, unknown> }).criteria)).toEqual(['P1', 'P2', 'None of these']);
  });

  it('picks only from the list it was given', async () => {
    fetchMock.mockResolvedValue(ok({ project: { choice: 'P2', probabilities: { P2: 0.9 }, confidence: 0.9 } }));
    expect(await guessProject(db, TEAM_ID, 'Plan the shoot day', list, ON)).toBe('prj_b');
    fetchMock.mockClear(); jevCacheClear();
    fetchMock.mockResolvedValue(ok({ project: { choice: 'P7', probabilities: { P7: 0.99 } } }));
    expect(await guessProject(db, TEAM_ID, 'Plan the shoot day', list, ON)).toBeNull();
  });
});

describe('a person-set field is never overwritten', () => {
  it('fills a field only while it is empty', () => {
    expect(fillIfEmpty('', 'prj_a')).toBe('prj_a');
    expect(fillIfEmpty(null, 'prj_a')).toBe('prj_a');
    expect(fillIfEmpty('prj_mine', 'prj_a')).toBeNull();
  });

  it('writes no task through any use, and a task keeps its owner, date and project', async () => {
    const tasks = (await openTasks()).slice(0, 6);
    const before = JSON.stringify(await Promise.all(tasks.map((t) => getTask(db, t.id, AS_OF))));
    const snap = await snapshot();
    fetchMock.mockResolvedValue(ok(Object.fromEntries(tasks.map((_, i) => [`t${i}`, score(2)]))));
    await suggestedOrder(db, TEAM_ID, tasks, AS_OF, ON);
    expect(JSON.stringify(await Promise.all(tasks.map((t) => getTask(db, t.id, AS_OF))))).toBe(before);
    expect(await snapshot()).toEqual(snap);
  });

  it('keeps Jev out of client code and writes nothing in the new library file', () => {
    const lib = readFileSync(join(__dirname, '../lib/jevUses.ts'), 'utf8');
    expect(lib).not.toMatch(/\b(INSERT|UPDATE|DELETE)\b\s/);
    const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? (f === 'node_modules' || f === '.next' ? [] : walk(p)) : /\.tsx?$/.test(f) ? [p] : [];
    });
    const root = join(__dirname, '..');
    const clients = [...walk(join(root, 'components')), ...walk(join(root, 'app'))].filter((p) => /^['"]use client['"]/.test(readFileSync(p, 'utf8')));
    expect(clients.length).toBeGreaterThan(20);
    for (const p of clients) expect(readFileSync(p, 'utf8'), p).not.toMatch(/from ['"](@\/lib|\.\.\/lib|\.)\/(jev|jevUses|jevStatus|jevSearch|redact)['"]/);
  });
});

describe('still needed (a reminder)', () => {
  const note = (cid: string, task: string, by: string, body: string) => db.query(
    `INSERT INTO comments (id, subject_kind, subject_id, author_id, body, created_at) VALUES ($1, 'task', $2, $3, $4, now())`, [cid, task, by, body]);

  it('flags a task whose owner says it is done, at the yes/no floor, and reads only the owner', async () => {
    const [t, u] = await openTasks();
    const other = ['per_ada', 'per_bo', 'per_fay'].find((p) => p !== u.ownerId)!;
    await note('cmt_s1', t.id, t.ownerId, 'Done, this went out on Monday.');
    await note('cmt_s2', u.id, other, 'Done, I think.');
    const before = await snapshot();
    fetchMock.mockResolvedValueOnce(ok({ s0: yes(0.9) }));
    expect(await doneByNote(db, TEAM_ID, [t, u], AS_OF, ON)).toEqual([t.id]);
    expect(bodyOf(fetchMock)).toContain('this went out on Monday');
    expect(bodyOf(fetchMock)).not.toContain('I think');
    jevCacheClear();
    fetchMock.mockResolvedValueOnce(ok({ s0: yes(YESNO - 0.01) }));
    expect(await doneByNote(db, TEAM_ID, [t], AS_OF, ON)).toEqual([]);
    expect(await snapshot()).toEqual(before); // nothing written
  });

  it('asks nothing when off, and keeps every task when the call fails', async () => {
    const [t] = await openTasks();
    await note('cmt_s3', t.id, t.ownerId, 'No longer needed, the brief changed.');
    expect(await doneByNote(db, TEAM_ID, [t], AS_OF, OFF)).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockRejectedValue(new Error('offline'));
    expect(await doneByNote(db, TEAM_ID, [t], AS_OF, ON)).toEqual([]);
  });

  it('marks the item in the draft, which leaves it out of the email', async () => {
    const { reminderDrafts } = await import('../lib/reminders');
    const d = (await reminderDrafts(db, TEAM_ID, { mode: 'overdue', days: 2 }, 'x', AS_OF, OFF)).drafts.find((x) => x.items.some((i) => i.kind === 'task' && !i.flag))!;
    const item = d.items.find((i) => i.kind === 'task' && !i.flag)!;
    await note('cmt_s4', item.key.slice('task:'.length), d.personId, 'Cancelled, we are not doing this one.');
    await db.query(`UPDATE comments SET created_at = '2026-10-05T10:00:00Z' WHERE id = 'cmt_s4'`); // older than the 2-day rule
    fetchMock.mockImplementation(async (_u: string, init: { body: string }) => {
      const qs = Object.keys(JSON.parse(init.body).questions ?? {});
      return ok(Object.fromEntries(qs.map((k) => [k, yes(JSON.parse(init.body).questions[k].instructions.owner_note?.includes('not doing') ? 0.95 : 0.1)])));
    });
    const on = (await reminderDrafts(db, TEAM_ID, { mode: 'overdue', days: 2 }, 'x', AS_OF, ON)).drafts.find((x) => x.personId === d.personId)!;
    expect(on.items.find((i) => i.key === item.key)!.flag).toBe('Their latest note reads as done or not needed');
    expect(on.body).not.toContain(item.title);
  });
});
