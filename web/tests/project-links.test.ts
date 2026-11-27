import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Me } from '../lib/auth';
import { openDb, type Db } from '../lib/db';
import { ApiError } from '../lib/errors';
import { createProject } from '../lib/plan';
import { addProjectLink, projectLinks, removeProjectLink } from '../lib/projectLinks';
import { TEAM_ID } from '../lib/seed';
import * as s from '../lib/service';

// Key documents on a project (23 Nov): anyone on it adds links, in the order added; each removes their own,
// and a partner never sees a Nicobar-only link.
const OWNER = 'per_ada', MEMBER = 'per_bo';
let db: Db;
beforeAll(() => { process.env.NICO_TODAY = '2026-10-09'; });
beforeEach(async () => { db = await openDb(); });
const meAs = async (id: string): Promise<Me> => {
  const person = (await s.listPeople(db, TEAM_ID)).find((p) => p.id === id)!;
  return { person, realPerson: person, viewingAs: false, team: { id: TEAM_ID, name: 'Team', teamType: 'department' } } as Me;
};
const code = async (p: Promise<unknown>) => p.then(() => 'ok', (e) => (e instanceof ApiError ? `${e.status}` : (() => { throw e; })()));

describe('key documents', () => {
  it('keeps links in the order added, and lets the owner remove one', async () => {
    const p = await createProject(db, OWNER, TEAM_ID, { name: 'Gifting', kind: 'tasks', ownerId: OWNER, goal: 'A goal', workstreams: [], members: [{ personId: MEMBER, role: 'Design' }] });
    const me = await meAs(OWNER);
    await addProjectLink(db, me, p.id, { url: 'https://docs.google.com/document/d/abc', label: 'Brief' });
    let links = await addProjectLink(db, me, p.id, { url: 'https://docs.google.com/spreadsheets/d/xyz', label: 'Pre-read: Q4 plan' });
    expect(links.map((l) => l.label)).toEqual(['Brief', 'Pre-read: Q4 plan']);
    links = await removeProjectLink(db, me, p.id, links[0].id);
    expect(links.map((l) => l.label)).toEqual(['Pre-read: Q4 plan']);
  });

  it('lets anyone on the project add one and remove their own, not someone else\'s, and refuses a bad link', async () => {
    const p = await createProject(db, OWNER, TEAM_ID, { name: 'Gifting', kind: 'tasks', ownerId: OWNER, goal: 'A goal', workstreams: [], members: [{ personId: MEMBER, role: 'Design' }] });
    const mine = (await addProjectLink(db, await meAs(MEMBER), p.id, { url: 'https://example.com/moms', label: 'MOMs' }))[0];
    const owners = (await addProjectLink(db, await meAs(OWNER), p.id, { url: 'https://example.com/brief', label: 'Brief' }))[1];
    expect(await code(removeProjectLink(db, await meAs(MEMBER), p.id, owners.id))).toBe('403');
    expect(await code(removeProjectLink(db, await meAs(MEMBER), p.id, mine.id))).toBe('ok');
    expect(await code(addProjectLink(db, await meAs('per_cy'), p.id, { url: 'https://example.com/doc' }))).toBe('403'); // not on it
    expect(await code(addProjectLink(db, await meAs(OWNER), p.id, { url: 'not a link' }))).toBe('400');
  });

  it('keeps a Nicobar-only link from a partner on a partner project', async () => {
    const p = await createProject(db, OWNER, TEAM_ID, { name: 'Collab', kind: 'tasks', ownerId: OWNER, goal: 'A goal', workstreams: [], members: [], partnerName: 'Studio', partnerPeople: [] });
    await addProjectLink(db, await meAs(OWNER), p.id, { url: 'https://example.com/shared', label: 'Shared plan' });
    await addProjectLink(db, await meAs(OWNER), p.id, { url: 'https://example.com/costs', label: 'Our costs', nicobarOnly: true });
    expect((await projectLinks(db, p.id, true)).map((l) => l.label)).toEqual(['Shared plan']);
    expect((await projectLinks(db, p.id, false)).map((l) => l.label)).toEqual(['Shared plan', 'Our costs']);
  });
});
