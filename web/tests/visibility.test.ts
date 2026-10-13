import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Project visibility (13 Oct, docs/VISIBILITY-PLAN.md): a restricted person sees only their own projects and the
// tasks in them, through View as too. Hidden reads as missing.

vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }), headers: async () => new Headers() }));

import type { Me } from '../lib/auth';
import { openDb, type Db } from '../lib/db';
import { ApiError } from '../lib/errors';
import { getProject, projectMembers, projectViewers, updateProject } from '../lib/plan';
import { search } from '../lib/search';
import { TEAM_ID } from '../lib/seed';
import * as s from '../lib/service';
import { SEE_ALL, seesProject, sightOf } from '../lib/sight';
import { assertSeesAll, projectFor, seenProjects, seenTasks, taskFor } from '../lib/visibility';

const AS_OF = '2026-10-09';
const LEAD = 'per_ada';
const DEE = 'per_dee'; // fixtures: a plain member on the shoot plan, nothing to do with the loyalty tiers
const HIDDEN = 'prj_tiers';
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

async function status(p: Promise<unknown>): Promise<number | 'ok'> {
  try { await p; } catch (e) { if (e instanceof ApiError) return e.status; throw e; }
  return 'ok';
}

describe('project visibility', () => {
  it('fixture holds: the restricted person has no tie to the hidden project', async () => {
    const { rows } = await db.query(
      `SELECT 1 FROM projects WHERE id = $1 AND (owner_id = $2 OR lead_id = $2)
       UNION ALL SELECT 1 FROM project_members WHERE project_id = $1 AND person_id = $2`, [HIDDEN, DEE]);
    expect(rows).toEqual([]);
  });

  it('sees all when unrestricted, a lead or an admin; only their projects when restricted', async () => {
    expect(await sightOf(db, TEAM_ID, LEAD)).toEqual(SEE_ALL);
    await db.query(`UPDATE people SET restricted = true WHERE id = $1`, [LEAD]);
    expect(await sightOf(db, TEAM_ID, LEAD)).toEqual(SEE_ALL); // a lead is never narrowed
    const sight = await sightOf(db, TEAM_ID, DEE);
    expect(sight.all).toBe(false);
    expect(seesProject(sight, HIDDEN)).toBe(false);
    await db.query(`UPDATE people SET restricted = false WHERE id = $1`, [DEE]);
    expect(await sightOf(db, TEAM_ID, DEE)).toEqual(SEE_ALL);
  });

  it('sees nothing when inactive', async () => {
    await db.query(`UPDATE people SET active = false WHERE id = $1`, [DEE]);
    const sight = await sightOf(db, TEAM_ID, DEE);
    expect(sight.all).toBe(false);
    expect(sight.all === false && sight.projects.size).toBe(0);
  });

  it('a viewer row opens one project', async () => {
    await db.query(`INSERT INTO project_viewers (project_id, person_id, added_by) VALUES ($1, $2, $3)`, [HIDDEN, DEE, LEAD]);
    expect(seesProject(await sightOf(db, TEAM_ID, DEE), HIDDEN)).toBe(true);
  });

  it('lists only visible tasks and projects, through View as too', async () => {
    for (const me of [await meAs(DEE), await meAs(DEE, true)]) {
      const projects = await seenProjects(db, me);
      expect(projects.map((p) => p.id)).not.toContain(HIDDEN);
      const tasks = await seenTasks(db, me);
      expect(tasks.length).toBeGreaterThan(0);
      for (const t of tasks) expect(t.projectId !== HIDDEN || t.ownerId === DEE || t.blocked?.onId === DEE).toBe(true);
    }
    const all = await seenTasks(db, await meAs(LEAD));
    expect(all.some((t) => t.projectId === HIDDEN)).toBe(true);
  });

  it('reads a hidden task or project as missing', async () => {
    const me = await meAs(DEE, true);
    const hiddenTask = (await s.teamTasks(db, TEAM_ID)).find((t) => t.projectId === HIDDEN && t.ownerId !== DEE && t.blocked?.onId !== DEE)!;
    expect(await status(taskFor(db, me, hiddenTask.id))).toBe(404);
    expect(await status(projectFor(db, me, HIDDEN))).toBe(404);
    expect(await status(taskFor(db, await meAs(LEAD), hiddenTask.id))).toBe('ok');
  });

  it('shows a task blocked on them, even in a hidden project', async () => {
    const t = (await s.teamTasks(db, TEAM_ID)).find((x) => x.projectId === HIDDEN && x.ownerId !== DEE)!;
    await db.query(`UPDATE tasks SET blocked_on_id = $2, blocked_ask = 'Waiting on the shoot dates', blocked_at = now() WHERE id = $1`, [t.id, DEE]);
    expect(await status(taskFor(db, await meAs(DEE), t.id))).toBe('ok');
  });

  it('keeps hidden work out of search, notices, updates and a person page', async () => {
    const me = await meAs(DEE);
    const sight = await sightOf(db, TEAM_ID, DEE);
    const hits = await search(db, TEAM_ID, sight, 'loyalty', AS_OF);
    expect(hits.some((h) => h.kind === 'project' && h.id === HIDDEN)).toBe(false);
    expect((await search(db, TEAM_ID, SEE_ALL, 'loyalty', AS_OF)).some((h) => h.id === HIDDEN)).toBe(true);

    const hiddenIds = new Set((await s.teamTasks(db, TEAM_ID)).filter((t) => t.projectId === HIDDEN).map((t) => t.id));
    const visible = new Set((await seenTasks(db, me)).map((t) => t.id));
    const { items } = await s.updatesView(db, DEE, TEAM_ID, {}, {}, null, new Date());
    for (const i of items) expect(visible.has(i.taskId)).toBe(true);
    for (const n of await s.listNotices(db, DEE)) expect(visible.has(n.taskId)).toBe(true);

    const owner = (await s.teamTasks(db, TEAM_ID)).find((t) => t.projectId === HIDDEN)!.ownerId;
    const v = await s.personView(db, TEAM_ID, DEE, owner, AS_OF);
    expect(v.projects.map((p) => p.id)).not.toContain(HIDDEN);
    for (const t of [...v.open, ...v.waitingOnThem, ...v.waitingOnOthers]) expect(hiddenIds.has(t.id) && t.ownerId !== DEE).toBe(false);
  });

  it('project settings set the viewer list, and leaving it out keeps it', async () => {
    const p = await getProject(db, HIDDEN);
    const base = { name: p.name, kind: p.kind, ownerId: p.ownerId, leadId: p.leadId, goal: p.intro ?? '', workstreams: p.workstreams, members: await projectMembers(db, HIDDEN) };
    await updateProject(db, LEAD, HIDDEN, { ...base, viewers: [DEE, p.ownerId] });
    expect(await projectViewers(db, HIDDEN)).toEqual([DEE]); // the owner already sees it
    expect(seesProject(await sightOf(db, TEAM_ID, DEE), HIDDEN)).toBe(true);
    await updateProject(db, LEAD, HIDDEN, base);
    expect(await projectViewers(db, HIDDEN)).toEqual([DEE]);
    await updateProject(db, LEAD, HIDDEN, { ...base, viewers: [] });
    expect(await projectViewers(db, HIDDEN)).toEqual([]);
  });

  it('refuses the team-wide API views to a restricted person', async () => {
    expect(await status(assertSeesAll(db, await meAs(DEE)))).toBe(403);
    expect(await status(assertSeesAll(db, await meAs(LEAD)))).toBe('ok');
  });

  it('pages read through lib/visibility.ts, never the raw team readers', () => {
    const bad: string[] = [];
    const walk = (dir: string) => {
      for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, f.name);
        if (f.isDirectory()) walk(p);
        else if (/\.tsx?$/.test(f.name) && /\b(teamTasks|teamProjects)\b/.test(fs.readFileSync(p, 'utf8'))) bad.push(p);
      }
    };
    walk(path.join(__dirname, '..', 'app'));
    walk(path.join(__dirname, '..', 'components'));
    expect(bad).toEqual([]);
  });
});
