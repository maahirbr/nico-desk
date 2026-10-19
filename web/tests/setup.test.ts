import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// The setup check-list on a project page (19 Oct): the steps for each board kind, what ticks them, who sees the
// list, and that loading it writes nothing. Tests pin today to 2026-10-09.

const state = vi.hoisted(() => ({ jar: {} as Record<string, string>, testDb: null as unknown }));

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (n: string) => (n in state.jar ? { name: n, value: state.jar[n] } : undefined) }),
  headers: async () => new Headers(),
}));
vi.mock('../lib/db', async (orig) => ({ ...(await orig<typeof import('../lib/db')>()), db: async () => state.testDb }));

import type { Me } from '../lib/auth';
import { openDb, type Db } from '../lib/db';
import { markMeetingHeld, setMeetingRhythm } from '../lib/meetings';
import { createProject, type ProjectInput } from '../lib/plan';
import * as s from '../lib/service';
import { TEAM_ID } from '../lib/seed';
import { MEETINGS_ON, SETUP_SINCE, setupState, setupSteps, type SetupInput } from '../lib/setup';

const TODAY = '2026-10-09';
const LEAD = 'per_ada'; // a team lead
const ADMIN = 'per_fay';
const OWNER = 'per_bo'; // a plain member who owns the project
const OTHER = 'per_cy'; // a plain member with no tie to the project
let db: Db;

beforeAll(() => { process.env.NICO_SESSION_SECRET = 'setup-test-secret'; });
beforeEach(async () => { db = await openDb(); state.testDb = db; state.jar = {}; });

async function meAs(id: string): Promise<Me> {
  const person = (await s.listPeople(db, TEAM_ID)).find((p) => p.id === id)!;
  return { person, realPerson: person, viewingAs: false, team: { id: TEAM_ID, name: 'Team', teamType: 'department' } };
}

const base: ProjectInput = { name: 'Gift wrap drive', kind: 'tasks', ownerId: OWNER, goal: '', workstreams: [], members: [] };
const mk = async (over: Partial<ProjectInput> = {}) => {
  const p = await createProject(db, LEAD, TEAM_ID, { ...base, ...over });
  await db.query(`INSERT INTO project_viewers (project_id, person_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [p.id, LEAD]);
  return p;
};
const keys = (steps: { key: string }[] | null) => (steps ?? []).map((x) => x.key);
const doneOf = (steps: { key: string; done: boolean }[] | null) => Object.fromEntries((steps ?? []).map((x) => [x.key, x.done]));

const none: SetupInput = { kind: 'tasks', hasMembers: false, hasWork: false, meetEvery: null, hasMinutes: false, partnerName: null, meetingsOn: false };

describe('setupSteps', () => {
  it('lists members, work and minutes on a task board, in that order', () => {
    expect(keys(setupSteps(none))).toEqual(['members', 'work', 'minutes']);
  });

  it('adds the partner step on a plan board only', () => {
    expect(keys(setupSteps({ ...none, kind: 'plan', partnerName: 'Partner' }))).toEqual(['members', 'work', 'minutes', 'partner']);
    expect(keys(setupSteps({ ...none, partnerName: 'Acme' }))).not.toContain('partner');
  });

  it('shows the rhythm step only when meetings are on', () => {
    expect(keys(setupSteps({ ...none, meetingsOn: true }))).toEqual(['members', 'work', 'rhythm', 'minutes']);
    expect(keys(setupSteps({ ...none, kind: 'plan', meetingsOn: true }))).toEqual(['members', 'work', 'rhythm', 'minutes', 'partner']);
    expect(keys(setupSteps({ ...none, meetingsOn: false, meetEvery: 'weekly' }))).not.toContain('rhythm');
  });

  it('ticks each step from its own input', () => {
    const all = setupSteps({ kind: 'plan', hasMembers: true, hasWork: true, meetEvery: 'weekly', hasMinutes: true, partnerName: 'Acme', meetingsOn: true });
    expect(all.every((x) => x.done)).toBe(true);
    expect(doneOf(setupSteps({ ...none, kind: 'plan', meetingsOn: true, partnerName: 'Partner' }))).toEqual({
      members: false, work: false, rhythm: false, minutes: false, partner: false,
    });
    expect(doneOf(setupSteps({ ...none, hasMembers: true }))).toMatchObject({ members: true, work: false, minutes: false });
    expect(doneOf(setupSteps({ ...none, hasWork: true }))).toMatchObject({ members: false, work: true });
    expect(doneOf(setupSteps({ ...none, hasMinutes: true }))).toMatchObject({ minutes: true });
    expect(doneOf(setupSteps({ ...none, meetingsOn: true, meetEvery: 'monthly' }))).toMatchObject({ rhythm: true });
  });

  it('counts an empty or default partner name as not named', () => {
    const at = (partnerName: string | null) => doneOf(setupSteps({ ...none, kind: 'plan', partnerName })).partner;
    expect(at(null)).toBe(false);
    expect(at('')).toBe(false);
    expect(at('Partner')).toBe(false);
    expect(at('Acme')).toBe(true);
  });

  it('words the work step for the board kind', () => {
    expect(setupSteps(none)[1]).toMatchObject({ title: 'Add the first tasks', button: 'Add a task', action: 'add' });
    expect(setupSteps({ ...none, kind: 'plan' })[1]).toMatchObject({ title: 'Add the first lines', button: 'Add a line', action: 'add' });
  });

  it('keeps the meeting rhythm step off until the PM says yes (G1)', () => {
    expect(MEETINGS_ON).toBe(false);
  });
});

describe('setupState', () => {
  it('shows a new task project with nothing done to its lead and its owner', async () => {
    const p = await mk();
    expect(doneOf(await setupState(db, await meAs(LEAD), p.id))).toEqual({ members: false, work: false, minutes: false });
    expect(keys(await setupState(db, await meAs(OWNER), p.id))).toEqual(['members', 'work', 'minutes']);
  });

  it('shows it to an admin and to the project lead, and hides it from a plain member', async () => {
    const p = await mk();
    expect(await setupState(db, await meAs(ADMIN), p.id)).not.toBeNull();
    expect(await setupState(db, await meAs(OTHER), p.id)).toBeNull();
    await db.query(`UPDATE projects SET lead_id = $2 WHERE id = $1`, [p.id, OTHER]);
    expect(await setupState(db, await meAs(OTHER), p.id)).not.toBeNull();
  });

  it('hides it on an archived project', async () => {
    const p = await mk();
    await db.query(`UPDATE projects SET archived_at = now(), archived_by = $2 WHERE id = $1`, [p.id, LEAD]);
    expect(await setupState(db, await meAs(LEAD), p.id)).toBeNull();
  });

  it('hides it on a project made before the list shipped, and on a seeded project', async () => {
    const made = async (id: string, at: string) => {
      await db.query(`INSERT INTO projects (id, team_id, name, department, owner_id, status, status_at) VALUES ($1,$2,$1,'Team',$3,'on_track',now())`, [id, TEAM_ID, OWNER]);
      await db.query(`INSERT INTO events (id, entity_type, entity_id, field, after, actor_id, origin, at) VALUES ($1,'project',$2,'_created','{}',$3,'app',$4::timestamptz)`,
        [`evt_${id}`, id, LEAD, at]);
    };
    await made('prj_t_old', new Date(Date.parse(SETUP_SINCE) - 60_000).toISOString());
    await made('prj_t_new', SETUP_SINCE);
    expect(await setupState(db, await meAs(LEAD), 'prj_t_old')).toBeNull();
    expect(await setupState(db, await meAs(LEAD), 'prj_t_new')).not.toBeNull();
    expect(await setupState(db, await meAs(LEAD), 'prj_shoot')).toBeNull();
  });

  it('ticks members only for someone besides the owner and the lead', async () => {
    const p = await mk({ leadId: LEAD, members: [{ personId: OWNER, role: 'Owner' }, { personId: LEAD, role: 'Lead' }] });
    expect((await setupState(db, await meAs(LEAD), p.id))![0].done).toBe(false);
    await db.query(`INSERT INTO project_members VALUES ($1,$2,'Packaging')`, [p.id, OTHER]);
    expect((await setupState(db, await meAs(LEAD), p.id))![0].done).toBe(true);
  });

  it('ticks work when a task exists on a task board', async () => {
    const p = await mk();
    await s.createTask(db, LEAD, { teamId: TEAM_ID, title: 'Print the labels', dueOn: '2026-10-12', ownerId: OWNER, projectId: p.id });
    expect(doneOf(await setupState(db, await meAs(LEAD), p.id)).work).toBe(true);
  });

  it('ticks work on a plan board from a line that is not removed', async () => {
    const p = await mk({ kind: 'plan' });
    expect(keys(await setupState(db, await meAs(LEAD), p.id))).toContain('partner');
    const line = (removed: boolean, num: number) => db.query(
      `INSERT INTO plan_lines (id, project_id, num, pillar, what, removed, remove_reason, created_at, updated_at)
       VALUES ($1,$2,$3,'general','Launch the page',$4,$5,now(),now())`,
      [`ln_t${num}`, p.id, num, removed, removed ? 'not needed' : null]);
    await line(true, 1);
    expect(doneOf(await setupState(db, await meAs(LEAD), p.id)).work).toBe(false);
    await line(false, 2);
    expect(doneOf(await setupState(db, await meAs(LEAD), p.id)).work).toBe(true);
  });

  it('ticks minutes from a held meeting, a proposal or an accepted action', async () => {
    const held = await mk();
    await setMeetingRhythm(db, LEAD, held.id, { every: 'weekly' }, TODAY);
    expect(doneOf(await setupState(db, await meAs(LEAD), held.id)).minutes).toBe(false);
    await markMeetingHeld(db, LEAD, held.id, TODAY);
    expect(doneOf(await setupState(db, await meAs(LEAD), held.id)).minutes).toBe(true);

    const prop = await mk({ kind: 'plan', name: 'Proposal drive' });
    await db.query(
      `INSERT INTO plan_proposals (id, project_id, batch, position, meeting, task, confidence, created_at) VALUES ('pp_t1',$1,'b1',1,'{}','Send the brief','sure',now())`, [prop.id]);
    expect(doneOf(await setupState(db, await meAs(LEAD), prop.id)).minutes).toBe(true);

    const act = await mk({ kind: 'plan', name: 'Action drive' });
    await db.query(`INSERT INTO plan_actions (id, project_id, task, created_at) VALUES ('pa_t1',$1,'Hand typed',now())`, [act.id]);
    expect(doneOf(await setupState(db, await meAs(LEAD), act.id)).minutes).toBe(false);
    await db.query(`INSERT INTO plan_actions (id, project_id, task, proposal_id, created_at) VALUES ('pa_t2',$1,'From minutes','pp_x',now())`, [act.id]);
    expect(doneOf(await setupState(db, await meAs(LEAD), act.id)).minutes).toBe(true);
  });

  it('ticks the partner step once the plan names one', async () => {
    const p = await mk({ kind: 'plan', partnerName: 'Acme' });
    expect(doneOf(await setupState(db, await meAs(LEAD), p.id)).partner).toBe(true);
  });

  it('writes nothing when it loads', async () => {
    const p = await mk();
    const count = async () => {
      const t = await Promise.all(['events', 'tasks', 'project_members', 'plan_proposals', 'plan_actions'].map(
        async (n) => (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${n}`)).rows[0].n));
      return t.join(',');
    };
    const before = await count();
    await setupState(db, await meAs(LEAD), p.id);
    await setupState(db, await meAs(OTHER), p.id);
    expect(await count()).toBe(before);
  });
});
