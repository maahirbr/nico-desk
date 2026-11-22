import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from '../lib/db';
import { createProject, getProject, updateProject, projectMembers } from '../lib/plan';
import { TEAM_ID } from '../lib/seed';
import * as s from '../lib/service';

// The partner team linked to the Roster (23 Nov): a partner name that is one person on the Roster is that person. They join
// the project, and the tasks owned only by that name become theirs. One owner per task: a co-owned task keeps its owner.
const ME = 'per_ada', MEMBER = 'per_bo';
let db: Db;
beforeAll(() => { process.env.NICO_TODAY = '2026-10-09'; });
beforeEach(async () => { db = await openDb(); });
const base = (id: string) => ({ teamId: TEAM_ID, dueOn: '2026-10-20', projectId: id });
const project = (people: string[]) => createProject(db, ME, TEAM_ID, {
  name: 'Hamper collab', kind: 'tasks', ownerId: ME, goal: 'A festive hamper with a studio', workstreams: [],
  members: [{ personId: MEMBER, role: 'Production' }], partnerName: 'Studio', partnerPeople: people,
});
const on = async (projectId: string) => (await projectMembers(db, projectId)).map((m) => m.personId);

describe('partner team on the Roster', () => {
  it('links a typed name once that person is added to the Roster: they join, and their tasks are theirs', async () => {
    const p = await project(['Asha Kapoor', 'Ravi']);
    const only = await s.createTask(db, ME, { ...base(p.id), title: 'Pack the hampers', ownerId: null, partnerOwner: 'Asha Kapoor' });
    const both = await s.createTask(db, ME, { ...base(p.id), title: 'Box sign-off', ownerId: ME, partnerOwner: 'Asha Kapoor' });
    expect(only).toMatchObject({ ownerId: '', partnerOwner: 'Asha Kapoor' });
    const asha = await s.addPerson(db, 'per_fay', TEAM_ID, { displayName: 'Asha Kapoor', role: 'Stylist', department: 'Studio', email: 'asha@studio.test', appRoles: ['partner'] });
    expect(await on(p.id)).toContain(asha.id);
    expect(await s.getTask(db, only.id)).toMatchObject({ ownerId: asha.id, partnerOwner: null });
    expect(await s.getTask(db, both.id)).toMatchObject({ ownerId: ME, partnerOwner: 'Asha Kapoor' }); // one owner per task
    expect((await getProject(db, p.id)).partnerPeople).toEqual(['Asha Kapoor', 'Ravi']);
  });

  it('gives a new task for a linked name to that person, and leaves an unknown name as typed', async () => {
    const p = await project(['Kabir Sethi', 'Ravi']); // Kabir Sethi is on the Roster already
    const k = await s.createTask(db, ME, { ...base(p.id), title: 'Send the samples', ownerId: null, partnerOwner: 'Kabir Sethi' });
    expect(k).toMatchObject({ ownerId: MEMBER, partnerOwner: null });
    const r = await s.createTask(db, ME, { ...base(p.id), title: 'Print the tags', ownerId: null, partnerOwner: 'Ravi' });
    expect(r).toMatchObject({ ownerId: '', partnerOwner: 'Ravi' });
  });

  it('links on saving the project, and links no one when two people share the name', async () => {
    const p = await project([]);
    const t = await s.createTask(db, ME, { ...base(p.id), title: 'Shoot the lookbook', ownerId: ME });
    await s.addPerson(db, 'per_fay', TEAM_ID, { displayName: 'Dev Rao', role: 'Photographer', department: 'Studio', email: 'dev1@studio.test', appRoles: ['partner'] });
    await s.addPerson(db, 'per_fay', TEAM_ID, { displayName: 'Dev Rao', role: 'Editor', department: 'Studio', email: 'dev2@studio.test', appRoles: ['partner'] });
    const ananya = 'per_cy';
    const cur = await getProject(db, p.id);
    await updateProject(db, ME, p.id, { name: cur.name, kind: 'tasks', ownerId: ME, goal: cur.intro ?? '', workstreams: [], members: [{ personId: MEMBER, role: 'Production' }],
      partnerName: 'Studio', partnerPeople: ['Ananya Rao', 'Dev Rao'] });
    const ids = await on(p.id);
    expect(ids).toContain(ananya);
    expect(ids.filter((x) => x.startsWith('per_') && x !== ananya && x !== MEMBER)).toEqual([]);
    expect((await s.getTask(db, t.id)).ownerId).toBe(ME);
  });
});
