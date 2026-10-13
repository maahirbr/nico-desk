import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// "Connects to" (13 Oct, workstream 6): one test for each relation on the fixtures, then the sight rule. A hidden task or
// project never shows in a panel, not as a line, a title or a count, through View as too.

vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }), headers: async () => new Headers() }));

import type { Me } from '../lib/auth';
import { addComment, deleteComment } from '../lib/comments';
import { openDb, type Db } from '../lib/db';
import { ApiError } from '../lib/errors';
import { TEAM_ID } from '../lib/seed';
import * as s from '../lib/service';
import { threadsFor, type ThreadKind, type ThreadLine } from '../lib/threads';

const AS_OF = '2026-10-09';
const ADA = 'per_ada'; // a lead, sees everything; owns the landing page project and tsk_034, tsk_036
const FAY = 'per_fay'; // owns tsk_043 (landing page, from meeting minutes)
const DEE = 'per_dee'; // a member on the shoot, made restricted below; owns tsk_027 and tsk_041
const LANDING = 'prj_landing'; // hidden from DEE
const STUDIO = 'prj_studio'; // the plan board
let db: Db;

beforeAll(() => { process.env.NICO_TODAY = AS_OF; });
beforeEach(async () => {
  db = await openDb();
  await db.query(`UPDATE people SET restricted = true WHERE id = $1`, [DEE]);
});

async function meAs(id: string, viewingAs = false): Promise<Me> {
  const people = await s.listPeople(db, TEAM_ID);
  const person = people.find((p) => p.id === id)!;
  const real = viewingAs ? people.find((p) => p.appRoles.includes('admin'))! : person;
  return { person, realPerson: real, viewingAs, team: { id: TEAM_ID, name: 'Team', teamType: 'department' } };
}
const panel = async (id: string, kind: ThreadKind, itemId: string, viewingAs = false) => threadsFor(db, await meAs(id, viewingAs), kind, itemId);
const rel = (lines: ThreadLine[], r: ThreadLine['rel']) => lines.filter((l) => l.rel === r);
const titles = (lines: ThreadLine[], r: ThreadLine['rel']) => rel(lines, r).map((l) => l.title);
const titleOf = async (id: string) => (await s.getTask(db, id)).title;
async function block(taskId: string, ownerId: string, onId: string) {
  const t = await s.getTask(db, taskId);
  await s.blockTask(db, ownerId, taskId, { version: t.version, onId, ask: 'Need the copy first' });
}
async function say(as: string, kind: 'task' | 'project', subjectId: string, body: string) {
  return addComment(db, await meAs(as), kind, subjectId, body);
}
async function status(p: Promise<unknown>): Promise<number | 'ok'> {
  try { await p; } catch (e) { if (e instanceof ApiError) return e.status; throw e; }
  return 'ok';
}

describe('connects to: a task', () => {
  it('shows the project it is part of', async () => {
    const lines = await panel(ADA, 'task', 'tsk_034');
    expect(rel(lines, 'Part of')).toMatchObject([{ title: 'Autumn landing page', href: `/projects/${LANDING}`, kind: 'project' }]);
  });

  it('shows who it waits on, and the tasks that wait on its owner', async () => {
    await block('tsk_043', FAY, ADA);
    const waits = await panel(FAY, 'task', 'tsk_043');
    expect(rel(waits, 'Waits on')).toMatchObject([{ kind: 'person', id: ADA, sub: 'Need the copy first' }]);
    const waited = await panel(ADA, 'task', 'tsk_034');
    expect(titles(waited, 'Waiting on it')).toContain(await titleOf('tsk_043'));
    expect(titles(await panel(ADA, 'task', 'tsk_036'), 'Waiting on it')).toContain(await titleOf('tsk_043'));
    expect(titles(await panel(FAY, 'task', 'tsk_043'), 'Waiting on it')).not.toContain(await titleOf('tsk_043')); // not on itself
  });

  it('says when it came from meeting minutes, and not otherwise', async () => {
    expect(rel(await panel(FAY, 'task', 'tsk_043'), 'From')).toMatchObject([{ title: 'Meeting minutes', href: null }]);
    expect(rel(await panel(ADA, 'task', 'tsk_034'), 'From')).toEqual([]);
  });

  it('lists the links on the task', async () => {
    await s.addTaskLink(db, ADA, 'tsk_034', { url: 'https://example.com/spec', label: 'Spec' });
    expect(rel(await panel(ADA, 'task', 'tsk_034'), 'Links')).toMatchObject([{ title: 'Spec', href: 'https://example.com/spec', external: true }]);
  });

  it('shows where a comment mentions it, once for each place, and not its own thread', async () => {
    await say(ADA, 'task', 'tsk_036', 'Read [[task:tsk_034]] first');
    await say(ADA, 'task', 'tsk_036', 'And [[task:tsk_034]] again');
    await say(ADA, 'task', 'tsk_034', 'A note on itself, [[task:tsk_034]]');
    const mentions = rel(await panel(ADA, 'task', 'tsk_034'), 'Mentioned in');
    expect(mentions).toMatchObject([{ id: 'tsk_036', kind: 'task', who: expect.any(String) }]);
  });

  it('drops a mention when its comment is deleted', async () => {
    const { comment } = await say(ADA, 'task', 'tsk_036', 'Read [[task:tsk_034]] first');
    await deleteComment(db, await meAs(ADA), comment.id);
    expect(rel(await panel(ADA, 'task', 'tsk_034'), 'Mentioned in')).toEqual([]);
  });

  it('reads an unknown task as missing', async () => {
    expect(await status(panel(ADA, 'task', 'tsk_nope'))).toBe(404);
  });
});

describe('connects to: a project', () => {
  it('shows the owner, the people on it and the open checkpoints of a plan', async () => {
    const lines = await panel(ADA, 'project', STUDIO);
    expect(rel(lines, 'Owner')).toMatchObject([{ kind: 'person', id: ADA }]);
    expect(titles(lines, 'Checkpoints')).toContain('First three teams drafted');
    expect(titles(lines, 'Checkpoints')).not.toContain('Template agreed'); // done
  });

  it('shows the people on a task board with their roles', async () => {
    const lines = await panel(ADA, 'project', 'prj_shoot');
    expect(rel(lines, 'Owner')).toMatchObject([{ id: 'per_cy' }]);
    expect(lines.some((l) => l.rel === 'People' || l.rel === 'Lead')).toBe(true);
    expect(rel(lines, 'Checkpoints')).toEqual([]); // a task board has none
  });

  it('shows where a comment mentions it', async () => {
    await say(ADA, 'task', 'tsk_036', 'Part of [[project:prj_shoot]]');
    expect(rel(await panel(ADA, 'project', 'prj_shoot'), 'Mentioned in')).toMatchObject([{ id: 'tsk_036', kind: 'task' }]);
  });
});

describe('connects to: a person', () => {
  it('shows the projects they own and who waits on them', async () => {
    await block('tsk_043', FAY, ADA);
    const lines = await panel(ADA, 'person', ADA);
    expect(titles(lines, 'Owns')).toContain('Autumn landing page');
    expect(titles(lines, 'Waiting on them')).toContain(await titleOf('tsk_043'));
  });

  it('shows where a comment mentions them', async () => {
    await say(FAY, 'task', 'tsk_043', 'Over to @[[person:per_ada]]');
    expect(rel(await panel(ADA, 'person', ADA), 'Mentioned in')).toMatchObject([{ id: 'tsk_043', kind: 'task' }]);
  });

  it('reads an unknown person as missing', async () => {
    expect(await status(panel(ADA, 'person', 'per_nobody'))).toBe(404);
  });
});

describe('connects to: sight', () => {
  const HIDDEN_WORDS = ['Autumn landing page', 'Loyalty tier pilot'];

  it('fixture holds: the restricted person sees the shoot and neither hidden project', async () => {
    const dee = await meAs(DEE);
    expect((await s.getTask(db, 'tsk_027')).projectId).toBe('prj_shoot');
    expect((await s.getTask(db, 'tsk_036')).projectId).toBe(LANDING);
    expect(await status(threadsFor(db, dee, 'project', 'prj_shoot'))).toBe('ok');
    expect(await status(threadsFor(db, dee, 'project', LANDING))).toBe(404);
  });

  it('reads a hidden task or project as missing, through View as too', async () => {
    for (const viewing of [false, true]) {
      expect(await status(panel(DEE, 'task', 'tsk_036', viewing))).toBe(404);
      expect(await status(panel(DEE, 'project', LANDING, viewing))).toBe(404);
      expect(await status(panel(DEE, 'project', 'prj_tiers', viewing))).toBe(404);
    }
  });

  it('leaves a hidden project and its tasks out of a visible task panel', async () => {
    await say(ADA, 'task', 'tsk_036', 'Check [[task:tsk_027]] with [[project:prj_shoot]]'); // hidden thread
    await say(ADA, 'task', 'tsk_041', 'Same crop as [[task:tsk_027]]'); // visible thread
    const hiddenTitle = await titleOf('tsk_036');
    for (const viewing of [false, true]) {
      const lines = await panel(DEE, 'task', 'tsk_027', viewing);
      expect(titles(lines, 'Mentioned in')).toEqual([await titleOf('tsk_041')]);
      const text = JSON.stringify(lines);
      for (const w of [...HIDDEN_WORDS, hiddenTitle]) expect(text).not.toContain(w);
    }
    // A task blocked on the reader is theirs to see (lib/sight.ts), even in a hidden project. Its project stays hidden.
    await block('tsk_043', FAY, DEE);
    const blocked = await panel(DEE, 'task', 'tsk_027');
    expect(titles(blocked, 'Waiting on it')).toContain(await titleOf('tsk_043'));
    expect(JSON.stringify(blocked)).not.toContain('Autumn landing page');
    expect(rel(await panel(DEE, 'task', 'tsk_043'), 'Part of')).toEqual([]); // the task opens, its hidden project is left out
    // the lead, who sees all, does see them: the lines are cut by sight, not missing
    expect(titles(await panel(ADA, 'task', 'tsk_027'), 'Mentioned in')).toHaveLength(2);
  });

  it('leaves hidden comments and projects out of a project and a person panel', async () => {
    await block('tsk_043', FAY, 'per_cy'); // a hidden task waits on someone else
    await say(ADA, 'task', 'tsk_036', 'See [[project:prj_shoot]] and [[person:per_cy]]'); // hidden thread
    await say(ADA, 'task', 'tsk_041', 'See [[person:per_cy]]'); // visible thread
    await say(ADA, 'task', 'tsk_036', 'Ask [[person:per_dee]]'); // hidden thread
    for (const viewing of [false, true]) {
      const project = await panel(DEE, 'project', 'prj_shoot', viewing);
      expect(rel(project, 'Mentioned in')).toEqual([]);
      const cy = await panel(DEE, 'person', 'per_cy', viewing);
      expect(titles(cy, 'Mentioned in')).toEqual([await titleOf('tsk_041')]);
      expect(titles(cy, 'Owns')).not.toContain('Autumn landing page');
      expect(titles(cy, 'Waiting on them')).not.toContain(await titleOf('tsk_043'));
      const ada = await panel(DEE, 'person', ADA, viewing); // owns the hidden landing page
      expect(rel(ada, 'Owns')).toEqual([]);
      const dee = await panel(DEE, 'person', DEE, viewing);
      expect(rel(dee, 'Mentioned in')).toEqual([]); // the only mention is on a hidden task
      const text = JSON.stringify([project, cy, ada, dee]);
      for (const w of [...HIDDEN_WORDS, await titleOf('tsk_036'), await titleOf('tsk_043')]) expect(text).not.toContain(w);
    }
  });

  it('shows a project once it is opened to the reader', async () => {
    await db.query(`INSERT INTO project_viewers (project_id, person_id, added_by) VALUES ($1, $2, $3)`, [LANDING, DEE, ADA]);
    expect(titles(await panel(DEE, 'task', 'tsk_036'), 'Part of')).toEqual(['Autumn landing page']); // now opened to them
  });
});
