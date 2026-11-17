import { beforeEach, describe, expect, it } from 'vitest';
import type { Me } from '../lib/auth';
import { openDb, type Db } from '../lib/db';
import { ApiError } from '../lib/errors';
import { teamAdoption } from '../lib/activity';
import { addFile, getFile, myPage, restorePage, savePage } from '../lib/notes';
import { myFocus, setFocus } from '../lib/focus';
import { flagKeyOf } from '../lib/flags';
import { addProjectPeople, myProjects } from '../lib/plan';
import { fmtDate, NO_DATE } from '../lib/time';
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
    await db.query(`UPDATE personal_notes SET updated_at = now() - interval '2 days' WHERE person_id = $1`, [ME]); // notes live here since 15 Nov
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

describe('Your projects on Home', () => {
  it('puts Personal first, by that name, with no part', async () => {
    await s.ensurePersonalProject(db, TEAM_ID, 'per_cy');
    const mine = await myProjects(db, TEAM_ID, 'per_cy');
    expect(mine[0]).toMatchObject({ name: 'Personal 🔒', role: '' });
    expect(mine.slice(1).every((p) => !p.name.startsWith('Personal') && p.role)).toBe(true);
    expect((await myProjects(db, TEAM_ID, 'per_cy', false)).some((p) => p.name.startsWith('Personal'))).toBe(false); // viewing as them
  });
});

describe('a Personal task with no date', () => {
  it('can be added, sorts last, is never late, and needs no reason to get a date', async () => {
    const pid = await s.ensurePersonalProject(db, TEAM_ID, ME);
    const t = await s.createTask(db, ME, { teamId: TEAM_ID, title: 'Someday: read that book', ownerId: ME, dueOn: NO_DATE, projectId: pid });
    expect(t.dueOn).toBe(NO_DATE);
    expect(t.overdue).toBe(false);
    expect(fmtDate(t.dueOn)).toBe('No date');
    expect(flagKeyOf(t, '2026-10-09')).toBeNull();
    const dated = await s.renegotiate(db, ME, t.id, { version: t.version, newDueOn: '2026-10-20', reason: '' });
    expect(dated.dueOn).toBe('2026-10-20');
  });
  it('is refused outside Personal, and cannot leave Personal without a date', async () => {
    const pid = await s.ensurePersonalProject(db, TEAM_ID, ME);
    expect(await code(s.createTask(db, ME, { teamId: TEAM_ID, title: 'No date on a team task', ownerId: ME, dueOn: NO_DATE }))).toBe('400 invalid_body');
    const team = (await s.listProjects(db, TEAM_ID)).find((p) => !p.personalFor && !p.archived)!;
    expect(await code(s.createTask(db, ME, { teamId: TEAM_ID, title: 'No date on a team task', ownerId: ME, dueOn: NO_DATE, projectId: team.id }))).toBe('400 invalid_body');
    const t = await s.createTask(db, ME, { teamId: TEAM_ID, title: 'Someday task', ownerId: ME, dueOn: NO_DATE, projectId: pid });
    expect(await code(s.editTask(db, ME, t.id, { version: t.version, projectId: team.id }))).toBe('400 invalid_body');
    expect(await code(s.editTask(db, ME, t.id, { version: t.version, projectId: null }))).toBe('400 invalid_body');
    const other = await s.createTask(db, ME, { teamId: TEAM_ID, title: 'A dated task', ownerId: ME, dueOn: '2026-10-12', projectId: pid });
    expect(await code(s.renegotiate(db, ME, other.id, { version: other.version, newDueOn: NO_DATE, reason: 'x' }))).toBe('400 invalid_body');
  });
});

// 16 Nov review: a Personal project takes no one else, and Home lists only my own.
describe('a Personal project stays one person\'s', () => {
  it('refuses new people and never shows on someone else\'s Home', async () => {
    const pid = await s.ensurePersonalProject(db, TEAM_ID, ME);
    expect(await code(addProjectPeople(db, ME, pid, [{ personId: OTHER, role: 'Member' }]))).toBe('400 invalid_body');
    await db.query(`INSERT INTO project_members VALUES ($1,$2,'Member')`, [pid, OTHER]); // as if it got in some other way
    expect((await myProjects(db, TEAM_ID, OTHER)).some((p) => p.id === pid)).toBe(false);
    expect((await myProjects(db, TEAM_ID, ME)).some((p) => p.id === pid)).toBe(true);
  });
});


describe("Today's 3 on Personal", () => {
  const task = (owner: string, title: string, projectId?: string) =>
    s.createTask(db, owner, { teamId: TEAM_ID, title, ownerId: owner, dueOn: '2026-10-12', ...(projectId ? { projectId } : {}) });
  const ids = async (who: Me) => (await myFocus(db, who))!.picks.map((x) => x.id);

  it('takes up to 3 of my own open tasks, from any project, and nothing else', async () => {
    const me = await meAs(ME);
    const pid = await s.ensurePersonalProject(db, TEAM_ID, ME);
    const [a, b, c, d] = [await task(ME, 'Team task one'), await task(ME, 'Team task two'), await task(ME, 'Book a dentist', pid), await task(ME, 'One too many')];
    await setFocus(db, me, [a.id, b.id, c.id]);
    expect(await ids(me)).toEqual([a.id, b.id, c.id]);
    expect(await code(setFocus(db, me, [a.id, b.id, c.id, d.id]))).toBe('400 invalid_body');
    const theirs = await task(OTHER, 'Not mine');
    expect(await code(setFocus(db, me, [theirs.id]))).toBe('400 invalid_body');
    const shut = await s.closeTask(db, ME, d.id, { version: d.version, as: 'done' });
    expect(await code(setFocus(db, me, [shut.id]))).toBe('400 invalid_body');
    expect((await myFocus(db, await meAs(OTHER)))!.picks).toEqual([]); // mine are not theirs
  });

  it('shows nothing and saves nothing while an admin views as me', async () => {
    const t = await task(ME, 'Private plan');
    await setFocus(db, await meAs(ME), [t.id]);
    expect(await myFocus(db, await meAs(ME, true))).toBe(null);
    expect(await code(setFocus(db, await meAs(ME, true), []))).toBe('403 viewing_as');
    expect(await ids(await meAs(ME))).toEqual([t.id]);
  });

  it('keeps a done pick for the day, and drops a pick once it is dropped or handed on', async () => {
    const me = await meAs(ME);
    const [a, b, c] = [await task(ME, 'Finish the brief'), await task(ME, 'Drop me'), await task(ME, 'Hand me on')];
    await setFocus(db, me, [a.id, b.id, c.id]);
    await s.closeTask(db, ME, a.id, { version: a.version, as: 'done' });
    await s.closeTask(db, ME, b.id, { version: b.version, as: 'dropped', reason: 'Not needed' });
    await s.editTask(db, ME, c.id, { version: c.version, ownerId: OTHER });
    const left = (await myFocus(db, me))!.picks;
    expect(left.map((x) => [x.id, x.statusCategory])).toEqual([[a.id, 'done']]);
    expect(await code(setFocus(db, me, [a.id]))).toBe('ok'); // a done pick already in today's list may stay
  });

  it('starts empty the next day, with my unfinished picks offered to bring back', async () => {
    const me = await meAs(ME);
    const [a, b] = [await task(ME, 'Carry me over'), await task(ME, 'Done yesterday')];
    await setFocus(db, me, [a.id, b.id]);
    await s.closeTask(db, ME, b.id, { version: b.version, as: 'done' });
    process.env.NICO_TODAY = '2026-10-10';
    expect(await myFocus(db, me)).toEqual({ picks: [], carry: [a.id] });
    await setFocus(db, me, (await myFocus(db, me))!.carry);
    expect(await ids(me)).toEqual([a.id]);
  });

  it('leaves my running notes as they were', async () => {
    const me = await meAs(ME);
    const t = await task(ME, 'Pick me');
    await setFocus(db, me, [t.id]);
    expect((await myPage(db, me))!.updatedAt).toBe(null);
  });
});

describe('several named notes (15 Nov)', () => {
  it('turns the old page into "Notes", and makes, renames, saves and deletes notes', async () => {
    const { createNote, deleteNote, getNote, listNotes, renameNote, saveNote } = await import('../lib/notes');
    const me = await meAs(ME);
    const doc = (text: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
    await db.query(`INSERT INTO personal_pages (person_id, team_id, doc) VALUES ($1, $2, $3::jsonb)`, [ME, TEAM_ID, JSON.stringify(doc('Old page'))]);
    const first = await listNotes(db, me);
    expect(first.map((n) => n.name)).toEqual(['Notes']);
    expect(JSON.stringify((await getNote(db, me))!.doc)).toContain('Old page');
    const ideas = await createNote(db, me, '  Ideas   for the window ');
    expect(ideas.name).toBe('Ideas for the window');
    await saveNote(db, me, ideas.id, doc('Brass and ivory'));
    expect(JSON.stringify((await getNote(db, me, ideas.id))!.doc)).toContain('Brass and ivory');
    expect(JSON.stringify((await getNote(db, me))!.doc)).toContain('Old page'); // the first note is untouched
    await renameNote(db, me, ideas.id, 'Window ideas');
    expect((await listNotes(db, me)).map((n) => n.name)).toEqual(['Window ideas', 'Notes']); // newest first (16 Nov)
    // An untitled note (✎) takes its first line as its name until renamed, and the list shows a preview.
    const fresh = await createNote(db, me);
    expect(fresh.name).toBe('New note');
    const saved = await saveNote(db, me, fresh.id, { type: 'doc', content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Hamper ideas' }] }, { type: 'paragraph', content: [{ type: 'text', text: 'Brass bowls' }] }] });
    expect(saved).toMatchObject({ name: 'Hamper ideas', preview: 'Brass bowls' });
    await renameNote(db, me, fresh.id, 'Gifting');
    expect((await saveNote(db, me, fresh.id, doc('Something else'))).name).toBe('Gifting');
    // Someone else cannot read or change my note.
    const other = await meAs(OTHER);
    expect(await code(getNote(db, other, ideas.id))).toBe('404 not_found');
    expect(await code(renameNote(db, other, ideas.id, 'Mine now'))).toBe('404 not_found');
    // Delete moves a note to Recently Deleted; it can be recovered, or deleted for good from there (16 Nov).
    const { recoverNote } = await import('../lib/notes');
    await deleteNote(db, me, ideas.id);
    const after = await listNotes(db, me);
    expect(after.find((n) => n.id === ideas.id)?.deletedAt).toBeTruthy();
    expect(await code(saveNote(db, me, ideas.id, doc('nope')))).toBe('400 invalid_body'); // read only while deleted
    await recoverNote(db, me, ideas.id);
    expect((await listNotes(db, me)).find((n) => n.id === ideas.id)?.deletedAt).toBeNull();
    await deleteNote(db, me, ideas.id); await deleteNote(db, me, ideas.id); // the second press deletes it for good
    expect((await listNotes(db, me)).some((n) => n.id === ideas.id)).toBe(false);
    // Deleting every live note leaves one empty "Notes" to write in.
    for (const n of (await listNotes(db, me)).filter((x) => !x.deletedAt)) await deleteNote(db, me, n.id);
    expect((await listNotes(db, me)).filter((n) => !n.deletedAt).map((n) => n.name)).toEqual(['Notes']);
  });
});
