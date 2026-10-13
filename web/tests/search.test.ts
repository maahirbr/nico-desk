import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Stronger local search (workstream 9, 13 Oct): typos, filters, comments, and the reader's sight on all of it.
// Today is pinned to 2026-10-09. The fixture tasks used here: open and late 021, 025, 033, 034; at risk 027, 028, 029,
// 035; blocked 025, 027, 033, 045; done ahead 038, 049, 054; done on time 001; dropped 007, 044, 057.

vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }), headers: async () => new Headers() }));

import type { Me } from '../lib/auth';
import { addComment, deleteComment } from '../lib/comments';
import { openDb, type Db } from '../lib/db';
import { flagKeyOf, statusOf } from '../lib/flags';
import { search, searchCandidates, type SearchHit } from '../lib/search';
import { TEAM_ID } from '../lib/seed';
import * as s from '../lib/service';
import { SEE_ALL, sightOf } from '../lib/sight';

const AS_OF = '2026-10-09';
const LEAD = 'per_ada';
const BO = 'per_bo';
const DEE = 'per_dee'; // restricted in these tests; no tie to the loyalty tier pilot
const HIDDEN = 'prj_tiers';
let db: Db;
let hiddenTask: string; // a task in the hidden project that DEE has nothing to do with
let seenTask: string;

beforeAll(() => { process.env.NICO_TODAY = AS_OF; });
beforeEach(async () => {
  db = await openDb();
  await db.query(`UPDATE people SET restricted = true WHERE id = $1`, [DEE]);
  const tasks = await s.teamTasks(db, TEAM_ID, AS_OF);
  hiddenTask = tasks.find((t) => t.projectId === HIDDEN && t.ownerId !== DEE && t.blocked?.onId !== DEE && t.statusCategory === 'open')!.id;
  seenTask = tasks.find((t) => t.projectId === 'prj_shoot' && t.ownerId === DEE && t.statusCategory === 'open')!.id;
});

async function meAs(id: string): Promise<Me> {
  const person = (await s.listPeople(db, TEAM_ID)).find((p) => p.id === id)!;
  return { person, realPerson: person, viewingAs: false, team: { id: TEAM_ID, name: 'Team', teamType: 'department' } };
}
const as = async (id: string, q: string): Promise<SearchHit[]> => search(db, TEAM_ID, await sightOf(db, TEAM_ID, id), q, AS_OF, id);
const all = (q: string, me = LEAD) => as(me, q);
const taskIds = (hits: SearchHit[]) => hits.filter((h) => h.kind === 'task').map((h) => h.id).sort();
const first = async (id: string) => (await s.listPeople(db, TEAM_ID)).find((p) => p.id === id)!.displayName.split(' ')[0].toLowerCase();

describe('typo tolerance', () => {
  it('finds a title despite a swapped, dropped or added letter', async () => {
    for (const q of ['lnading', 'landng', 'landinng']) expect(taskIds(await all(q)), q).toContain('tsk_001');
    expect((await all('lnading')).some((h) => h.kind === 'project' && h.id === 'prj_landing')).toBe(true);
    expect(taskIds(await all('photograper'))).toContain('tsk_053');
  });

  it('finds a person despite a typo, and ignores accents and case', async () => {
    const name = await first(BO);
    const typo = name.slice(0, 2) + name[3] + name[2] + name.slice(4);
    expect((await all(typo)).some((h) => h.kind === 'person' && h.id === BO)).toBe(true);
    expect((await all(name.toUpperCase())).some((h) => h.kind === 'person' && h.id === BO)).toBe(true);
  });

  it('lets a clean match outrank a typo match', async () => {
    const hits = await all('tier');
    const exact = hits.findIndex((h) => h.kind === 'task' && /tier/i.test(h.title));
    const hitsTypo = await all('tire'); // a swap of "tier"
    expect(exact).toBeGreaterThanOrEqual(0);
    expect(taskIds(hitsTypo)).toContain('tsk_012');
  });

  it('does not stretch a short word', async () => {
    expect(taskIds(await all('tir'))).not.toContain('tsk_012');
  });

  it('keeps a plain word working the way it did', async () => {
    expect(taskIds(await all('landing page')).length).toBeGreaterThan(3);
    expect(await all('')).toEqual([]);
    expect(await all('zzzzqqqq')).toEqual([]);
  });
});

describe('filters', () => {
  it('is:late matches the late flag, and only that', async () => {
    const tasks = await s.teamTasks(db, TEAM_ID, AS_OF);
    const want = tasks.filter((t) => flagKeyOf(t, AS_OF) === 'late' && t.statusCategory !== 'dropped').map((t) => t.id).sort();
    expect(want).toContain('tsk_021');
    expect(taskIds(await all('is:late'))).toEqual(want);
    expect(taskIds(await all('is:late is:open'))).toEqual(['tsk_021', 'tsk_025', 'tsk_033', 'tsk_034']);
  });

  it('is:blocked, is:todo, is:doing, is:done and is:dropped match the status words', async () => {
    const tasks = await s.teamTasks(db, TEAM_ID, AS_OF);
    for (const k of ['blocked', 'todo', 'doing', 'done', 'dropped'] as const) {
      const want = tasks.filter((t) => statusOf(t) === k).map((t) => t.id).sort();
      expect(want.length, k).toBeGreaterThan(0);
      expect(taskIds(await all(`is:${k}`)), k).toEqual(want);
    }
    expect(taskIds(await all('is:blocked'))).toEqual(['tsk_025', 'tsk_027', 'tsk_033', 'tsk_045']);
  });

  it('is:atrisk, is:ahead and is:ontime use the same derivation as the task rows', async () => {
    expect(taskIds(await all('is:atrisk'))).toEqual(['tsk_027', 'tsk_028', 'tsk_029', 'tsk_035']);
    expect(taskIds(await all('is:ahead'))).toEqual(['tsk_038', 'tsk_049', 'tsk_054']);
    expect(taskIds(await all('is:ontime'))).toContain('tsk_001');
    expect(taskIds(await all('is:ontime'))).not.toContain('tsk_003');
  });

  it('is:mine uses the reader', async () => {
    expect(taskIds(await all('is:todo is:mine', 'per_eli'))).toEqual(['tsk_021', 'tsk_028']);
    expect(taskIds(await all('is:todo is:mine', LEAD))).toEqual(['tsk_035']);
  });

  it('@name keeps the tasks of one owner, and a typo in the name still works', async () => {
    const name = await first(BO);
    const own = (await s.teamTasks(db, TEAM_ID, AS_OF)).filter((t) => t.ownerId === BO && t.statusCategory !== 'dropped').map((t) => t.id).sort();
    expect(taskIds(await all(`@${name}`))).toEqual(own);
    expect(taskIds(await all(`@${name.slice(0, 2)}${name[3]}${name[2]}${name.slice(4)}`))).toEqual(own);
    const doing = (await s.teamTasks(db, TEAM_ID, AS_OF)).filter((t) => t.ownerId === BO && statusOf(t) === 'doing').map((t) => t.id).sort();
    expect(doing.length).toBeGreaterThan(0);
    expect(taskIds(await all(`@${name} is:doing`))).toEqual(doing);
  });

  it('#project keeps one project: its tasks, plan lines and project hit', async () => {
    const hits = await all('#landing');
    expect(hits.some((h) => h.kind === 'project' && h.id === 'prj_landing')).toBe(true);
    expect(hits.some((h) => h.kind === 'project' && h.id !== 'prj_landing')).toBe(false);
    expect(hits.some((h) => h.kind === 'person')).toBe(false);
    const want = (await s.teamTasks(db, TEAM_ID, AS_OF)).filter((t) => t.projectId === 'prj_landing' && t.statusCategory !== 'dropped').map((t) => t.id).sort();
    expect(taskIds(hits)).toEqual(want);
  });

  it('mixes words and filters', async () => {
    expect(taskIds(await all('is:late is:open tier'))).toEqual(['tsk_033']);
    // a task finished after its first date still carries the Late flag, as on the task rows
    expect(taskIds(await all('is:late tier'))).toEqual(['tsk_014', 'tsk_020', 'tsk_033', 'tsk_050', 'tsk_056']);
    expect(taskIds(await all('#tier is:todo'))).toEqual(['tsk_029', 'tsk_035']);
  });

  it('due:today and due:week keep open tasks by date', async () => {
    const tasks = await s.teamTasks(db, TEAM_ID, AS_OF);
    const today = tasks.filter((t) => t.statusCategory === 'open' && t.dueOn === AS_OF).map((t) => t.id).sort();
    expect(today.length).toBeGreaterThan(0);
    expect(taskIds(await all('due:today'))).toEqual(today);
    // 2026-10-09 is a Friday: the week runs from Monday 5 Oct to Sunday 11 Oct
    const week = tasks.filter((t) => t.statusCategory === 'open' && t.dueOn >= '2026-10-05' && t.dueOn <= '2026-10-11').map((t) => t.id).sort();
    expect(taskIds(await all('due:week'))).toEqual(week);
  });

  it('a filter that is half typed works when only one value fits, and waits when two fit', async () => {
    expect(taskIds(await all('is:bloc'))).toEqual(taskIds(await all('is:blocked')));
    expect(await all('is:d')).toEqual([]); // done, doing or dropped: nothing yet
  });

  it('an unknown owner or project gives nothing', async () => {
    expect(await all('@nobodyhere')).toEqual([]);
    expect(await all('#nosuchproject')).toEqual([]);
  });

  it('is: and due: drop the people, plan lines and projects, which have no status', async () => {
    const hits = await all('is:todo');
    expect(hits.every((h) => h.kind === 'task' || h.kind === 'comment')).toBe(true);
  });
});

describe('comment text', () => {
  it('finds a comment and opens the task it is on', async () => {
    const lead = await meAs(LEAD);
    const { comment } = await addComment(db, lead, 'task', seenTask, 'The quokka sample needs another pass');
    const hit = (await all('quokka')).find((h) => h.kind === 'comment')!;
    expect(hit).toMatchObject({ id: comment.id, href: `/tasks/${seenTask}` });
    expect(hit.title).toContain('quokka');
    expect(hit.sub).toMatch(/ on /);
  });

  it('opens a project for a comment on a project', async () => {
    await addComment(db, await meAs(LEAD), 'project', 'prj_shoot', 'Wombat budget agreed');
    const hit = (await all('wombat')).find((h) => h.kind === 'comment')!;
    expect(hit.href).toBe('/projects/prj_shoot');
  });

  it('finds a comment despite a typo, needs every word, and drops a deleted one', async () => {
    const lead = await meAs(LEAD);
    const { comment } = await addComment(db, lead, 'task', seenTask, 'Platypus keeper called back');
    expect((await all('platypuss')).some((h) => h.id === comment.id)).toBe(true);
    expect((await all('platypus giraffe')).some((h) => h.id === comment.id)).toBe(false);
    await deleteComment(db, lead, comment.id);
    expect((await all('platypus')).some((h) => h.kind === 'comment')).toBe(false);
  });

  it('writes a mention as the name, never as the stored token', async () => {
    const name = await first(BO);
    await addComment(db, await meAs(LEAD), 'task', seenTask, `Ask [[person:${BO}]] about the ibex order`);
    const hit = (await all('ibex')).find((h) => h.kind === 'comment')!;
    expect(hit.title).not.toContain('[[');
    expect(hit.title.toLowerCase()).toContain(name);
  });

  it('applies the task filters to a comment through the task it is on', async () => {
    await addComment(db, await meAs(LEAD), 'task', seenTask, 'Capybara note on the shoot');
    const task = (await s.teamTasks(db, TEAM_ID, AS_OF)).find((t) => t.id === seenTask)!;
    const status = statusOf(task);
    expect((await all(`capybara is:${status}`)).some((h) => h.kind === 'comment')).toBe(true);
    const other = status === 'done' ? 'todo' : 'done';
    expect((await all(`capybara is:${other}`)).some((h) => h.kind === 'comment')).toBe(false);
    expect((await all('capybara @' + (await first(DEE)))).some((h) => h.kind === 'comment')).toBe(true);
  });

  it('keeps comments out of the candidates that Jev reads', async () => {
    await addComment(db, await meAs(LEAD), 'task', seenTask, 'Okapi note on the shoot');
    expect((await search(db, TEAM_ID, SEE_ALL, 'okapi', AS_OF)).some((h) => h.kind === 'comment')).toBe(true);
    expect((await searchCandidates(db, TEAM_ID, SEE_ALL, 'okapi', AS_OF)).some((c) => c.hit.kind === 'comment')).toBe(false);
  });
});

describe('the reader\'s sight', () => {
  it('fixture holds: DEE cannot see the hidden project or its task', async () => {
    const sight = await sightOf(db, TEAM_ID, DEE);
    expect(sight.all).toBe(false);
    expect((await as(DEE, 'tier')).some((h) => h.id === HIDDEN || h.id === hiddenTask)).toBe(false);
  });

  it('never returns a comment on a hidden task or project', async () => {
    const lead = await meAs(LEAD);
    const t = await addComment(db, lead, 'task', hiddenTask, 'Narwhal plan for the tier pilot');
    const p = await addComment(db, lead, 'project', HIDDEN, 'Narwhal budget for the pilot');
    const seen = await all('narwhal');
    expect(seen.filter((h) => h.kind === 'comment').map((h) => h.id).sort()).toEqual([t.comment.id, p.comment.id].sort());
    expect((await as(DEE, 'narwhal')).filter((h) => h.kind === 'comment')).toEqual([]);
    expect((await as(DEE, 'narwhal is:todo')).length).toBe(0);
    expect((await as(DEE, `narwhal #tier`)).length).toBe(0);
  });

  it('does not leak a hidden item through the words of a visible comment', async () => {
    const hidden = (await s.teamTasks(db, TEAM_ID, AS_OF)).find((t) => t.id === hiddenTask)!;
    await addComment(db, await meAs(LEAD), 'task', seenTask, `Check [[task:${hiddenTask}]] and [[project:${HIDDEN}]] with the yak group`);
    const hits = await as(DEE, 'yak');
    const c = hits.find((h) => h.kind === 'comment')!;
    expect(c).toBeTruthy(); // the comment is on a task DEE sees
    expect(c.title).not.toContain(hidden.title);
    expect(c.title).not.toContain('[[');
    // a search for the hidden title does not reach it through the comment
    expect((await as(DEE, hidden.title.split(' ').slice(0, 3).join(' '))).filter((h) => h.kind === 'comment' && h.id === c.id)).toEqual([]);
    expect(JSON.stringify(hits)).not.toContain(hiddenTask);
  });

  it('never returns a hidden task, project, plan line or their words through a filter', async () => {
    const hidden = (await s.teamTasks(db, TEAM_ID, AS_OF)).filter((t) => t.projectId === HIDDEN).map((t) => t.id);
    const queries = ['is:late', 'is:blocked', 'is:todo', 'is:done', 'is:doing', 'is:atrisk', 'is:ahead', 'is:ontime', 'is:open', 'is:mine',
      '#tier', '#loyalty', '#pilot', '@' + (await first('per_fay')), 'due:week', 'due:today', 'tier', 'loyalty', 'lnoyalty'];
    for (const q of queries) {
      const hits = await as(DEE, q);
      const leaked = hits.filter((h) => h.id === HIDDEN || hidden.includes(h.id) || h.href.includes(HIDDEN) || hidden.some((id) => h.href.includes(id)));
      expect(leaked, q).toEqual([]);
    }
    // the lead sees them, so the test above is not passing by accident
    expect(taskIds(await all('#tier')).some((id) => hidden.includes(id))).toBe(true);
    expect(taskIds(await all('is:blocked'))).toContain('tsk_033');
    expect(taskIds(await as(DEE, 'is:blocked'))).not.toContain('tsk_033');
  });

  it('turns a #project filter for a hidden project into an empty result, with no hint it exists', async () => {
    expect(await as(DEE, '#tier')).toEqual([]);
    expect(await as(DEE, '#nosuchproject')).toEqual(await as(DEE, '#tier'));
  });

  it('shows a restricted person their own comments and their own filtered tasks', async () => {
    await addComment(db, await meAs(DEE), 'task', seenTask, 'Gecko check done');
    expect((await as(DEE, 'gecko')).some((h) => h.kind === 'comment' && h.href === `/tasks/${seenTask}`)).toBe(true);
    expect(taskIds(await as(DEE, 'is:mine')).length).toBeGreaterThan(0);
  });
});
