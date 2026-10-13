import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Comments with @ and # (workstream 5, 13 Oct): who may comment, how references are stored and shown, who is told.

vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }), headers: async () => new Headers() }));

import type { Me } from '../lib/auth';
import { addComment, deleteComment, editComment, listComments, listMentions, refsIn } from '../lib/comments';
import { openDb, upgrade, type Db } from '../lib/db';
import { ApiError } from '../lib/errors';
import { match, suggest } from '../lib/quickadd';
import { TEAM_ID } from '../lib/seed';
import * as s from '../lib/service';
import { seenTasks } from '../lib/visibility';

const AS_OF = '2026-10-09';
const LEAD = 'per_ada';
const DEE = 'per_dee'; // restricted in these tests
const CY = 'per_cy'; // unrestricted
const HIDDEN = 'prj_tiers'; // DEE has no tie to it (see tests/visibility.test.ts)
let db: Db;
let hiddenTask: string;
let seenTask: string;
let seenProject: string;

beforeAll(() => { process.env.NICO_TODAY = AS_OF; });
beforeEach(async () => {
  db = await openDb();
  await db.query(`UPDATE people SET restricted = true WHERE id = $1`, [DEE]);
  const tasks = await s.teamTasks(db, TEAM_ID);
  hiddenTask = tasks.find((t) => t.projectId === HIDDEN && t.ownerId !== DEE && t.blocked?.onId !== DEE)!.id;
  const mine = (await seenTasks(db, await meAs(DEE))).find((t) => t.projectId)!;
  seenTask = mine.id;
  seenProject = mine.projectId!;
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
const mentions = async (id: string) => listMentions(db, await meAs(id));
const text = (parts: { t: string; text?: string }[]) => parts.map((p) => (p.t === 'text' ? p.text : `<${p.t}>`)).join('');
const told = async (id: string) => (await db.query(`SELECT 1 FROM notices WHERE person_id = $1 AND kind = 'mentioned'`, [id])).rows.length;

describe('comments', () => {
  it('creates a comment on a task and a project and lists them in order', async () => {
    const lead = await meAs(LEAD);
    const a = await addComment(db, lead, 'task', hiddenTask, '  First note  ');
    await addComment(db, lead, 'task', hiddenTask, 'Second note');
    expect(a.comment).toMatchObject({ authorId: LEAD, deleted: false, mine: true, body: 'First note', editedAt: null });
    expect((await listComments(db, lead, 'task', hiddenTask)).map((c) => text(c.parts))).toEqual(['First note', 'Second note']);
    await addComment(db, lead, 'project', HIDDEN, 'On the project');
    expect((await listComments(db, lead, 'project', HIDDEN)).map((c) => text(c.parts))).toEqual(['On the project']);
    expect((await listComments(db, lead, 'task', hiddenTask)).length).toBe(2); // the project thread is separate
  });

  it('refuses an empty or over-long comment', async () => {
    const lead = await meAs(LEAD);
    expect(await status(addComment(db, lead, 'task', hiddenTask, '   '))).toBe(400);
    expect(await status(addComment(db, lead, 'task', hiddenTask, 'x'.repeat(2001)))).toBe(400);
    expect(await status(addComment(db, lead, 'task', hiddenTask, 'x'.repeat(2000)))).toBe('ok');
  });

  it('stores @ and # references as ids, and shows them by name', async () => {
    const lead = await meAs(LEAD);
    const body = `Ask [[person:${CY}]] about [[task:${hiddenTask}]] in [[project:${HIDDEN}]]. [[person:${CY}]] again`;
    const { comment } = await addComment(db, lead, 'project', HIDDEN, body);
    const { rows } = await db.query(`SELECT ref_kind, ref_id FROM comment_refs WHERE comment_id = $1 ORDER BY ref_kind`, [comment.id]);
    expect(rows).toEqual([{ ref_kind: 'person', ref_id: CY }, { ref_kind: 'project', ref_id: HIDDEN }, { ref_kind: 'task', ref_id: hiddenTask }]);
    expect(refsIn(body).length).toBe(3);
    expect(comment.parts.map((p) => p.t)).toEqual(['text', 'person', 'text', 'task', 'text', 'project', 'text', 'person', 'text']);
    const person = comment.parts.find((p) => p.t === 'person');
    expect(person && 'name' in person && person.name).toBe((await s.listPeople(db, TEAM_ID)).find((p) => p.id === CY)!.displayName);
  });

  it('refuses a reference the writer cannot see or that does not exist', async () => {
    const dee = await meAs(DEE);
    expect(await status(addComment(db, dee, 'task', seenTask, `See [[task:${hiddenTask}]]`))).toBe(400);
    expect(await status(addComment(db, dee, 'task', seenTask, `See [[project:${HIDDEN}]]`))).toBe(400);
    expect(await status(addComment(db, dee, 'task', seenTask, 'See [[task:tsk_nope]]'))).toBe(400);
    expect(await status(addComment(db, dee, 'task', seenTask, 'See [[person:per_nope]]'))).toBe(400);
    expect(await status(addComment(db, dee, 'task', seenTask, `See [[project:${seenProject}]]`))).toBe('ok');
  });

  it('shows a reference as "a hidden item" to a reader who cannot see it', async () => {
    const { comment } = await addComment(db, await meAs(LEAD), 'task', seenTask, `Look at [[task:${hiddenTask}]]`);
    const lead = (await listComments(db, await meAs(LEAD), 'task', seenTask)).find((c) => c.id === comment.id)!;
    expect(lead.parts.map((p) => p.t)).toEqual(['text', 'task']);
    const forDee = (await listComments(db, await meAs(DEE), 'task', seenTask)).find((c) => c.id === comment.id)!;
    expect(forDee.parts.map((p) => p.t)).toEqual(['text', 'hidden']);
    expect(JSON.stringify(forDee.parts)).not.toContain((await s.getTask(db, hiddenTask)).title);
  });

  it('lets only the author edit or remove', async () => {
    const lead = await meAs(LEAD);
    const dee = await meAs(DEE);
    const { comment } = await addComment(db, dee, 'task', seenTask, 'Mine');
    expect(await status(editComment(db, lead, comment.id, 'Changed by someone else'))).toBe(403);
    expect(await status(deleteComment(db, lead, comment.id))).toBe(403);
    const edited = await editComment(db, dee, comment.id, 'Changed');
    expect(edited.comment.editedAt).not.toBeNull();
    expect(text(edited.comment.parts)).toBe('Changed');
    expect(await status(deleteComment(db, dee, comment.id))).toBe('ok');
    expect(await status(editComment(db, dee, comment.id, 'Again'))).toBe(404);
    expect(await status(deleteComment(db, dee, comment.id))).toBe(404);
    expect(await status(editComment(db, dee, 'cmt_nope', 'x'))).toBe(404);
  });

  it('keeps a removed comment as an empty row that reads removed, with its references gone', async () => {
    const dee = await meAs(DEE);
    const { comment } = await addComment(db, dee, 'task', seenTask, `Ping [[person:${CY}]] secret words`);
    await deleteComment(db, dee, comment.id);
    const [c] = (await listComments(db, dee, 'task', seenTask)).filter((x) => x.id === comment.id);
    expect(c).toMatchObject({ deleted: true, parts: [], body: null });
    const { rows } = await db.query<{ body: string; deleted_at: string | null }>(`SELECT body, deleted_at FROM comments WHERE id = $1`, [comment.id]);
    expect(rows[0].body).toBe('');
    expect(rows[0].deleted_at).not.toBeNull();
    expect((await db.query(`SELECT 1 FROM comment_refs WHERE comment_id = $1`, [comment.id])).rows).toEqual([]);
    expect(await mentions(CY)).toEqual([]); // the mention goes with the comment
  });

  it('gives the stored text to the author only', async () => {
    const { comment } = await addComment(db, await meAs(LEAD), 'task', seenTask, `Hi [[person:${CY}]]`);
    const theirs = (await listComments(db, await meAs(CY), 'task', seenTask)).find((c) => c.id === comment.id)!;
    expect(theirs.body).toBeNull();
    expect(theirs.mine).toBe(false);
    expect((await listComments(db, await meAs(LEAD), 'task', seenTask)).find((c) => c.id === comment.id)!.body).toBe(`Hi [[person:${CY}]]`);
  });
});

describe('comments and visibility', () => {
  it('reads a hidden task or project as missing, for listing and writing', async () => {
    const dee = await meAs(DEE);
    await addComment(db, await meAs(LEAD), 'task', hiddenTask, 'Hidden thread');
    await addComment(db, await meAs(LEAD), 'project', HIDDEN, 'Hidden thread');
    expect(await status(listComments(db, dee, 'task', hiddenTask))).toBe(404);
    expect(await status(listComments(db, dee, 'project', HIDDEN))).toBe(404);
    expect(await status(addComment(db, dee, 'task', hiddenTask, 'Hello'))).toBe(404);
    expect(await status(addComment(db, dee, 'project', HIDDEN, 'Hello'))).toBe(404);
    expect(await status(listComments(db, dee, 'task', 'tsk_nope'))).toBe(404);
    expect(await status(listComments(db, await meAs(LEAD), 'task', hiddenTask))).toBe('ok');
  });

  it('reads a comment on a subject the person cannot see as missing', async () => {
    const { comment } = await addComment(db, await meAs(LEAD), 'project', HIDDEN, 'Hidden thread');
    const dee = await meAs(DEE);
    expect(await status(editComment(db, dee, comment.id, 'x'))).toBe(404);
    expect(await status(deleteComment(db, dee, comment.id))).toBe(404);
  });

  it('opens the thread once the person is given view on the project', async () => {
    await db.query(`INSERT INTO project_viewers (project_id, person_id, added_by) VALUES ($1, $2, $3)`, [HIDDEN, DEE, LEAD]);
    expect(await status(addComment(db, await meAs(DEE), 'project', HIDDEN, 'Now I can'))).toBe('ok');
  });
});

describe('mention notices', () => {
  it('tells a mentioned person who can see the subject', async () => {
    const lead = await meAs(LEAD);
    const r = await addComment(db, lead, 'task', hiddenTask, `Please look [[person:${CY}]]`);
    const [m] = await mentions(CY);
    expect(m).toMatchObject({ commentId: r.comment.id, subjectKind: 'task', subjectId: hiddenTask, byName: lead.person.displayName });
    expect(m.snippet).toContain('@');
    const { rows } = await db.query(`SELECT kind, task_id FROM notices WHERE person_id = $1 AND comment_id = $2`, [CY, r.comment.id]);
    expect(rows).toEqual([{ kind: 'mentioned', task_id: null }]);
  });

  it('offers a mail address for the Gmail draft only for people who were told', async () => {
    await db.query(`UPDATE people SET contact_email = 'cy@draft.example' WHERE id = $1`, [CY]);
    const r = await addComment(db, await meAs(LEAD), 'task', hiddenTask, `Urgent [[person:${CY}]] and [[person:${DEE}]]`);
    expect(r.mail).toEqual([{ personId: CY, name: expect.any(String), to: 'cy@draft.example' }]); // DEE cannot see the task
  });

  it('does not tell a mentioned person who cannot see the task or project', async () => {
    const lead = await meAs(LEAD);
    await addComment(db, lead, 'task', hiddenTask, `Heads up [[person:${DEE}]]`);
    await addComment(db, lead, 'project', HIDDEN, `Heads up [[person:${DEE}]]`);
    expect(await told(DEE)).toBe(0);
    expect(await mentions(DEE)).toEqual([]);
  });

  it('tells a restricted person who does see the subject', async () => {
    await addComment(db, await meAs(LEAD), 'project', seenProject, `For you [[person:${DEE}]]`);
    expect((await mentions(DEE)).map((m) => m.subjectId)).toEqual([seenProject]);
  });

  it('does not tell the writer about their own mention, nor an inactive person', async () => {
    await db.query(`UPDATE people SET active = false WHERE id = $1`, [CY]);
    await addComment(db, await meAs(LEAD), 'task', hiddenTask, `Note to self [[person:${LEAD}]] and [[person:${CY}]]`);
    expect((await db.query(`SELECT 1 FROM notices WHERE kind = 'mentioned'`)).rows).toEqual([]);
  });

  it('tells only the people an edit adds', async () => {
    const lead = await meAs(LEAD);
    const { comment } = await addComment(db, lead, 'task', hiddenTask, `One [[person:${CY}]]`);
    await editComment(db, lead, comment.id, `One [[person:${CY}]] two [[person:${DEE}]]`); // DEE cannot see it: not told
    expect(await told(CY)).toBe(1);
    expect(await told(DEE)).toBe(0);
    const other = (await s.listPeople(db, TEAM_ID)).find((p) => p.active && ![LEAD, CY, DEE].includes(p.id))!;
    await editComment(db, lead, comment.id, `One [[person:${CY}]] two [[person:${other.id}]]`);
    expect(await told(CY)).toBe(1);
    expect(await told(other.id)).toBe(1);
  });

  it('keeps mentions out of the task notices', async () => {
    await addComment(db, await meAs(LEAD), 'task', hiddenTask, `For you [[person:${CY}]]`);
    for (const n of await s.listNotices(db, CY)) expect(n.kind).not.toBe('mentioned');
  });
});

describe('View as', () => {
  it('refuses a write while viewing as someone, and still reads', async () => {
    const view = await meAs(DEE, true);
    expect(await status(addComment(db, view, 'task', seenTask, 'Hi'))).toBe(403);
    const { comment } = await addComment(db, await meAs(DEE), 'task', seenTask, 'Mine');
    expect(await status(editComment(db, view, comment.id, 'Changed'))).toBe(403);
    expect(await status(deleteComment(db, view, comment.id))).toBe(403);
    expect(await status(listComments(db, view, 'task', seenTask))).toBe('ok');
  });
});

describe('the upgrade', () => {
  it('adds the comment tables and the mention kind to an older database, and runs again safely', async () => {
    await db.exec(`
      DROP TABLE notices; DROP TABLE comment_refs; DROP TABLE comments;
      CREATE TABLE notices (
        id text PRIMARY KEY, person_id text NOT NULL REFERENCES people(id), task_id text NOT NULL REFERENCES tasks(id),
        kind text NOT NULL CHECK (kind IN ('due_tomorrow','due_today','overdue','blocked_on_you','assigned','reassigned_away')),
        for_date date NOT NULL, created_at timestamptz NOT NULL, read_at timestamptz, UNIQUE (person_id, task_id, kind, for_date));`);
    await upgrade(db);
    await upgrade(db);
    await addComment(db, await meAs(LEAD), 'task', hiddenTask, `Hi [[person:${CY}]]`);
    expect(await told(CY)).toBe(1);
    const { rows } = await db.query<{ relrowsecurity: boolean }>(`SELECT relrowsecurity FROM pg_class WHERE relname IN ('comments','comment_refs')`);
    expect(rows.map((r) => r.relrowsecurity)).toEqual([true, true]);
  });
});

describe('picker matching', () => {
  const people = [{ id: 'a', name: 'Ada Stone' }, { id: 'b', name: 'Adam Reed' }, { id: 'c', name: 'Cy Banks' }];
  it('reuses the quick add tiers and lists every close name', () => {
    expect(match('cy', people)).toMatchObject({ status: 'matched' });
    expect(suggest('ad', people).map((p) => p.id)).toEqual(['a', 'b']);
    expect(suggest('banks', people).map((p) => p.id)).toEqual(['c']);
    expect(suggest('', people, 2).map((p) => p.id)).toEqual(['a', 'b']);
    expect(suggest('zzz', people)).toEqual([]);
    expect(suggest('nks', people).map((p) => p.id)).toEqual(['c']); // inside a word still counts
  });
});
