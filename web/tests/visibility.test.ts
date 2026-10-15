import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Project visibility (13 Oct, docs/VISIBILITY-PLAN.md; 15 Oct: only an admin sees every project). Everyone else,
// leads included, sees only their own projects and the tasks in them, through View as too. Hidden reads as missing.

vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }), headers: async () => new Headers() }));

import type { Me } from '../lib/auth';
import { openDb, type Db } from '../lib/db';
import { ApiError } from '../lib/errors';
import { getProject, projectMembers, projectViewers, updateProject } from '../lib/plan';
import { search } from '../lib/search';
import { TEAM_ID } from '../lib/seed';
import * as s from '../lib/service';
import { SEE_ALL, seesProject, sightOf, workingWith } from '../lib/sight';
import { assertSeesAll, ledgerFor, projectFor, seenProjects, seenTasks, taskFor } from '../lib/visibility';

const AS_OF = '2026-10-09';
const LEAD = 'per_ada';
const ADMIN = 'per_fay';
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

  it('sees all only as an admin; a lead or a member sees their own projects, whatever the old restricted flag says', async () => {
    expect(await sightOf(db, TEAM_ID, ADMIN)).toEqual(SEE_ALL);
    expect((await sightOf(db, TEAM_ID, LEAD)).all).toBe(false);
    const sight = await sightOf(db, TEAM_ID, DEE);
    expect(sight.all).toBe(false);
    expect(seesProject(sight, HIDDEN)).toBe(false);
    await db.query(`UPDATE people SET restricted = false WHERE id = $1`, [DEE]);
    expect((await sightOf(db, TEAM_ID, DEE)).all).toBe(false); // people.restricted is no longer read
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
    const all = await seenTasks(db, await meAs(ADMIN));
    expect(all.some((t) => t.projectId === HIDDEN)).toBe(true);
  });

  it('reads a hidden task or project as missing', async () => {
    const me = await meAs(DEE, true);
    const hiddenTask = (await s.teamTasks(db, TEAM_ID)).find((t) => t.projectId === HIDDEN && t.ownerId !== DEE && t.blocked?.onId !== DEE)!;
    expect(await status(taskFor(db, me, hiddenTask.id))).toBe(404);
    expect(await status(projectFor(db, me, HIDDEN))).toBe(404);
    expect(await status(taskFor(db, await meAs(ADMIN), hiddenTask.id))).toBe('ok');
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

  it('refuses the team-wide API views to anyone but an admin', async () => {
    expect(await status(assertSeesAll(db, await meAs(DEE)))).toBe(403);
    expect(await status(assertSeesAll(db, await meAs(LEAD)))).toBe(403);
    expect(await status(assertSeesAll(db, await meAs(ADMIN)))).toBe('ok');
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

describe('the ledger (15 Oct)', () => {
  const W = { from: '2026-09-14', to: '2026-10-05', prevFrom: '2026-08-17', prevTo: '2026-09-07' };

  it('gives a lead and an admin every task in full, marking those outside their projects as not to be linked', async () => {
    const team = await s.teamTasks(db, TEAM_ID);
    for (const id of [LEAD, ADMIN]) {
      const l = await ledgerFor(db, await meAs(id), W);
      expect(l.all).toBe(true);
      expect(l.countOnly).toEqual([]);
      expect(l.rows).toEqual(s.ledgerOf(team, W.from, W.to));
      expect(l.openNow.every((t) => t.title.length > 0)).toBe(true);
    }
    expect((await ledgerFor(db, await meAs(ADMIN), W)).noLink).toEqual([]);
    const lead = await ledgerFor(db, await meAs(LEAD), W);
    const sight = await sightOf(db, TEAM_ID, LEAD);
    for (const t of lead.openNow) expect(lead.noLink.includes(t.id)).toBe(!seesProject(sight, t.projectId) && t.ownerId !== LEAD && t.createdBy !== LEAD && t.blocked?.onId !== LEAD);
  });

  it('gives a member themselves and the people they work with, every task counted, the hidden ones stripped', async () => {
    const me = await meAs(DEE);
    const l = await ledgerFor(db, me, W);
    expect(l.all).toBe(false);
    expect(l.people!.has(DEE)).toBe(true);
    const team = await s.teamTasks(db, TEAM_ID);
    const theirs = team.filter((t) => l.people!.has(t.ownerId));
    // numbers are whole: the same rows as the full ledger for those people
    expect(l.rows).toEqual(s.ledgerOf(theirs, W.from, W.to));
    // nothing from someone they do not work with
    for (const t of [...l.tasks, ...l.openNow]) expect(l.people!.has(t.ownerId)).toBe(true);
    // a task they may not open arrives with no title, words, project or reasons
    const visible = new Set((await seenTasks(db, me)).map((t) => t.id));
    for (const t of [...l.tasks, ...l.prev, ...l.openNow, ...l.waitingOn]) {
      if (visible.has(t.id)) { expect(l.countOnly).not.toContain(t.id); continue; }
      expect(l.countOnly).toContain(t.id);
      expect(t).toMatchObject({ title: '', description: null, note: null, projectId: null, workstream: null, links: [] });
      expect(t.renegotiations.every((r) => r.reason === null)).toBe(true);
    }
    expect(l.noLink).toEqual([]);
  });

  it('counts someone a member shares a live project with, and drops them once the project is archived', async () => {
    const mine = (await seenProjects(db, await meAs(DEE))).find((p) => !p.archivedAt)!;
    const mate = mine.ownerId === DEE ? mine.leadId : mine.ownerId;
    expect(mate).toBeTruthy();
    expect((await workingWith(db, TEAM_ID, DEE)).has(mate!)).toBe(true);
    await db.query(`UPDATE projects SET archived_at = now() WHERE team_id = $1`, [TEAM_ID]);
    await db.query(`UPDATE tasks SET blocked_on_id = NULL`);
    expect([...(await workingWith(db, TEAM_ID, DEE))]).toEqual([DEE]);
  });
});
