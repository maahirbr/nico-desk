import { beforeEach, describe, expect, it } from 'vitest';
import type { Me } from '../lib/auth';
import { openDb, type Db } from '../lib/db';
import { ApiError } from '../lib/errors';
import { teamAdoption } from '../lib/activity';
import { addFile, getFile, myPage, restorePage, savePage } from '../lib/notes';
import { TEAM_ID } from '../lib/seed';
import * as s from '../lib/service';
import { seesProject, seesTask, sightOf } from '../lib/sight';
import { ledgerFor } from '../lib/visibility';

// Personal (11 Nov): each person's own project and notes. Only they see them: not teammates, not leads, not admins, and
// not an admin viewing as them. Personal tasks stay out of every team list and count.
const ME = 'per_cy', OTHER = 'per_dee', LEAD = 'per_ada', ADMIN = 'per_fay';
let db: Db;
beforeEach(async () => { process.env.NICO_TODAY = '2026-10-09'; db = await openDb(); });
const code = async (p: Promise<unknown>) => p.then(() => 'ok', (e) => (e instanceof ApiError ? `${e.status} ${e.code}` : (() => { throw e; })()));
const meAs = async (id: string, viewingAs = false): Promise<Me> => {
  const p = (await s.listPeople(db, TEAM_ID)).find((x) => x.id === id)!;
  return { person: p, realPerson: p, viewingAs, team: { id: TEAM_ID, name: 'Team', teamType: 'department' } };
};

describe('the Personal project', () => {
  it('is made once per person, and seen by that person alone', async () => {
    const pid = await s.ensurePersonalProject(db, TEAM_ID, ME);
    expect(await s.ensurePersonalProject(db, TEAM_ID, ME)).toBe(pid);
    const t = await s.createTask(db, ME, { teamId: TEAM_ID, title: 'Clear up my calendar', ownerId: ME, dueOn: '2026-10-12', projectId: pid });
    expect(seesProject(await sightOf(db, TEAM_ID, ME), pid)).toBe(true);
    expect(seesTask(await sightOf(db, TEAM_ID, ME), t)).toBe(true);
    for (const who of [OTHER, LEAD, ADMIN]) {
      expect(seesProject(await sightOf(db, TEAM_ID, who), pid)).toBe(false);
      expect(seesTask(await sightOf(db, TEAM_ID, who), t)).toBe(false);
    }
    expect(seesProject(await sightOf(db, TEAM_ID, ME, true), pid)).toBe(false); // an admin viewing as me
  });

  it('keeps personal tasks off team lists and counts, and on my Home', async () => {
    const pid = await s.ensurePersonalProject(db, TEAM_ID, ME);
    const t = await s.createTask(db, ME, { teamId: TEAM_ID, title: 'Send the deck to Y', ownerId: ME, dueOn: '2026-10-12', projectId: pid });
    expect((await s.teamTasks(db, TEAM_ID)).some((x) => x.id === t.id)).toBe(false);
    const mine = await s.myTasks(db, ME, TEAM_ID);
    expect([...mine.tasks, ...mine.assigned].some((x) => x.id === t.id)).toBe(true);
    const viewed = await s.myTasks(db, ME, TEAM_ID, undefined, false);
    expect([...viewed.tasks, ...viewed.assigned].some((x) => x.id === t.id)).toBe(false);
    const l = await ledgerFor(db, await meAs(ADMIN), { from: '2026-10-05', to: '2026-10-18', prevFrom: '2026-09-01', prevTo: '2026-10-04' });
    expect(l.tasks.some((x) => x.id === t.id)).toBe(false);
  });

  it('takes only my own tasks: none for others, no reassigning, no team work moved in', async () => {
    const pid = await s.ensurePersonalProject(db, TEAM_ID, ME);
    expect(await code(s.createTask(db, OTHER, { teamId: TEAM_ID, title: 'Sneak a task in', ownerId: OTHER, dueOn: '2026-10-12', projectId: pid }))).toBe('400 invalid_body');
    expect(await code(s.createTask(db, ME, { teamId: TEAM_ID, title: 'For someone else', ownerId: OTHER, dueOn: '2026-10-12', projectId: pid }))).toBe('400 invalid_body');
    const mine = await s.createTask(db, ME, { teamId: TEAM_ID, title: 'Book a dentist', ownerId: ME, dueOn: '2026-10-12', projectId: pid });
    expect(await code(s.editTask(db, ME, mine.id, { version: mine.version, ownerId: OTHER }))).toBe('400 invalid_body');
    const given = await s.createTask(db, LEAD, { teamId: TEAM_ID, title: 'Team work to do', ownerId: ME, dueOn: '2026-10-12' });
    expect(await code(s.editTask(db, ME, given.id, { version: given.version, projectId: pid }))).toBe('400 invalid_body');
    const own = await s.createTask(db, ME, { teamId: TEAM_ID, title: 'Made by me, for me', ownerId: ME, dueOn: '2026-10-12' });
    expect((await s.editTask(db, ME, own.id, { version: own.version, projectId: pid })).projectId).toBe(pid);
    const back = await s.getTask(db, own.id);
    expect((await s.editTask(db, ME, back.id, { version: back.version, projectId: null })).projectId).toBe(null); // moving out is fine
  });
});

describe('Personal settings', () => {
  it('changes only my own description and accent; the name stays', async () => {
    const pid = await s.ensurePersonalProject(db, TEAM_ID, ME);
    await s.updatePersonal(db, ME, TEAM_ID, { description: 'Work admin and ideas 🌿', accent: 'sage' });
    const { rows: [p] } = await db.query<{ intro: string; accent: string; name: string }>(`SELECT intro, accent, name FROM projects WHERE id = $1`, [pid]);
    expect(p).toMatchObject({ intro: 'Work admin and ideas 🌿', accent: 'sage' });
    expect(p.name.startsWith('Personal')).toBe(true);
    await s.updatePersonal(db, OTHER, TEAM_ID, { description: 'someone else' }); // goes to their own Personal, not mine
    const { rows: [again] } = await db.query<{ intro: string }>(`SELECT intro FROM projects WHERE id = $1`, [pid]);
    expect(again.intro).toBe('Work admin and ideas 🌿');
    expect(await code(s.updatePersonal(db, ME, TEAM_ID, { description: 'x'.repeat(201) }))).toBe('400 invalid_body');
  });
});

describe('Personal running notes', () => {
  const doc = (text: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text, marks: [{ type: 'bold' }] }] }] });
  it('saves my page, keeps it mine, and drops anything unsafe in it', async () => {
    const me = await meAs(ME);
    expect((await myPage(db, me))!.updatedAt).toBe(null); // nothing yet: an empty page
    await savePage(db, me, doc('Ideas for Diwali'));
    expect(JSON.stringify((await myPage(db, me))!.doc)).toContain('Ideas for Diwali');
    expect(await myPage(db, await meAs(ME, true))).toBe(null); // viewing as me: nothing
    expect(JSON.stringify((await myPage(db, await meAs(OTHER)))!.doc)).not.toContain('Diwali');
    await savePage(db, me, { type: 'doc', content: [
      { type: 'image', attrs: { src: 'https://evil.example/x.png' } },
      { type: 'paragraph', content: [{ type: 'text', text: 'click', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] },
    ] });
    const kept = JSON.stringify((await myPage(db, me))!.doc);
    expect(kept).not.toContain('evil.example');
    expect(kept).not.toContain('javascript:');
    expect(await code(savePage(db, me, { type: 'not-a-doc' }))).toBe('400 invalid_body');
  });

  it('keeps yesterday’s page to restore, and restore can be undone', async () => {
    const me = await meAs(ME);
    await savePage(db, me, doc('yesterday'));
    await db.query(`UPDATE personal_pages SET updated_at = now() - interval '2 days' WHERE person_id = $1`, [ME]);
    await savePage(db, me, doc('today'));
    expect((await myPage(db, me))!.prevAt).not.toBe(null);
    expect(JSON.stringify((await restorePage(db, me)).doc)).toContain('yesterday');
    expect(JSON.stringify((await restorePage(db, me)).doc)).toContain('today');
  });

  it('keeps attached files for their owner only, and refuses what is not allowed', async () => {
    const me = await meAs(ME);
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]);
    const f = await addFile(db, me, 'shot.png', 'image/png', png);
    expect(f).toMatchObject({ image: true, name: 'shot.png' });
    expect((await getFile(db, me, f.id))?.mime).toBe('image/png');
    expect(await getFile(db, await meAs(OTHER), f.id)).toBe(null);
    expect(await code(addFile(db, me, 'fake.png', 'image/png', new Uint8Array([1, 2, 3])))).toBe('400 invalid_body');
    expect(await code(addFile(db, me, 'run.exe', 'application/x-msdownload', new Uint8Array([1])))).toBe('400 invalid_body');
    expect((await addFile(db, me, 'brief.pdf', 'application/pdf', new Uint8Array([0x25, 0x50, 0x44, 0x46]))).image).toBe(false);
  });
});

// 13 Nov review: three more paths kept Personal work in view of others.
describe('Personal work stays private beyond the lists', () => {
  it('is never listed or handed on when its owner is removed', async () => {
    const pid = await s.ensurePersonalProject(db, TEAM_ID, ME);
    const secret = await s.createTask(db, ME, { teamId: TEAM_ID, title: 'Private errand', ownerId: ME, dueOn: '2026-10-12', projectId: pid });
    const team = await s.createTask(db, LEAD, { teamId: TEAM_ID, title: 'Team handover work', ownerId: ME, dueOn: '2026-10-12' });
    const load = await s.handoffLoad(db, ADMIN, TEAM_ID, ME);
    expect(load.tasks.map((t) => t.id)).toContain(team.id);
    expect(load.tasks.some((t) => t.id === secret.id)).toBe(false);
    expect(load.projects.some((p) => p.id === pid)).toBe(false);
    await s.removePerson(db, ADMIN, TEAM_ID, ME, OTHER, 'Left the team');
    expect((await s.getTask(db, secret.id)).ownerId).toBe(ME);
    expect((await s.getTask(db, team.id)).ownerId).toBe(OTHER);
    expect(JSON.stringify(await s.handoversForMe(db, OTHER, TEAM_ID))).not.toContain('Private errand');
  });

  it('shows its due notices to the owner, not to an admin viewing as them', async () => {
    const pid = await s.ensurePersonalProject(db, TEAM_ID, ME);
    const t = await s.createTask(db, ME, { teamId: TEAM_ID, title: 'Private due today', ownerId: ME, dueOn: '2026-10-09', projectId: pid });
    await s.runReminders(db, '2026-10-09');
    expect((await s.listNotices(db, ME)).some((n) => n.taskId === t.id)).toBe(true);
    expect((await s.listNotices(db, ME, false, true)).some((n) => n.taskId === t.id)).toBe(false);
  });

  it('adds nothing to the Activity counts', async () => {
    const pid = await s.ensurePersonalProject(db, TEAM_ID, ME);
    const before = (await teamAdoption(db, TEAM_ID)).find((r) => r.id === ME)!;
    await s.createTask(db, ME, { teamId: TEAM_ID, title: 'Private count check', ownerId: ME, dueOn: '2026-10-12', projectId: pid });
    const after = (await teamAdoption(db, TEAM_ID)).find((r) => r.id === ME)!;
    expect(after.changes7).toBe(before.changes7);
    expect(after.interactions.total).toBe(before.interactions.total);
  });
});
