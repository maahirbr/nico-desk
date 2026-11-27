import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from '../lib/db';
import { createProject, moveTargets, projectMembers } from '../lib/plan';
import { TEAM_ID } from '../lib/seed';
import * as s from '../lib/service';

// Moving a task into a project (23 Nov): a one-off, or a task filed in the wrong project.
const ME = 'per_ada', OTHER = 'per_bo', OUTSIDER = 'per_cy';
let db: Db;
beforeAll(() => { process.env.NICO_TODAY = '2026-10-09'; });
beforeEach(async () => { db = await openDb(); });
const project = (name: string, ownerId = ME) => createProject(db, ownerId, TEAM_ID, { name, kind: 'tasks', ownerId, goal: 'A goal for it', workstreams: [], members: [] });

describe('moving a task', () => {
  it('lists the open projects I am on, not ones I am not on', async () => {
    const mine = await project('Mine to move into');
    const theirs = await project('Not mine', OTHER);
    const ids = (await moveTargets(db, TEAM_ID, ME, false)).map((x) => x.id);
    expect(ids).toContain(mine.id);
    expect(ids).not.toContain(theirs.id);
  });

  it('moves a one-off into a project, and its owner joins the project', async () => {
    const p = await project('Shoot plan');
    const t = await s.createTask(db, ME, { teamId: TEAM_ID, title: 'Book the studio', ownerId: OUTSIDER, dueOn: '2026-10-20' });
    const moved = await s.editTask(db, ME, t.id, { version: t.version, projectId: p.id, workstream: null });
    expect(moved.projectId).toBe(p.id);
    expect((await projectMembers(db, p.id)).map((m) => m.personId)).toContain(OUTSIDER);
  });

  it('moves a task between projects', async () => {
    const a = await project('First home');
    const b = await project('Right home');
    const t = await s.createTask(db, ME, { teamId: TEAM_ID, title: 'Fix the tags', ownerId: ME, dueOn: '2026-10-20', projectId: a.id });
    expect((await s.editTask(db, ME, t.id, { version: t.version, projectId: b.id, workstream: null })).projectId).toBe(b.id);
  });
});
