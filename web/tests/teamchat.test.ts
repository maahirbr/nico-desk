import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Team chat (13 Oct): rooms, who may enter, soft delete, mentions, unread and tasks made from a message.
// The WhatsApp paste parser is tests/chat.test.ts; this file is the in-app chat (lib/teamchat.ts).

vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }), headers: async () => new Headers() }));

import type { Me } from '../lib/auth';
import { openDb, upgrade, type Db } from '../lib/db';
import { ApiError } from '../lib/errors';
import { TEAM_ID } from '../lib/seed';
import * as s from '../lib/service';
import {
  CHAT_MAX, deleteMessage, editMessage, linkTaskToMessage, listChatMentions, listMessages, listRooms, markRead, messageForTask,
  postMessage, taskSource, unreadTotal, type MessageView,
} from '../lib/teamchat';
import { seenTasks } from '../lib/visibility';

const AS_OF = '2026-10-09';
const LEAD = 'per_ada';
const DEE = 'per_dee'; // restricted in these tests
const CY = 'per_cy'; // unrestricted
const BO = 'per_bo';
const HIDDEN = 'prj_tiers'; // DEE has no tie to it (see tests/visibility.test.ts)
const OPEN = 'prj_landing';
let db: Db;
let hiddenTask: string;

beforeAll(() => { process.env.NICO_TODAY = AS_OF; });
beforeEach(async () => {
  db = await openDb();
  await db.query(`UPDATE people SET restricted = true WHERE id = $1`, [DEE]);
  hiddenTask = (await s.teamTasks(db, TEAM_ID)).find((t) => t.projectId === HIDDEN && t.ownerId !== DEE && t.blocked?.onId !== DEE)!.id;
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
const text = (m: MessageView) => m.parts.map((p) => (p.t === 'text' ? p.text : `<${p.t}>`)).join('');
const told = async (id: string) => (await db.query(`SELECT 1 FROM notices WHERE person_id = $1 AND kind = 'mentioned' AND message_id IS NOT NULL`, [id])).rows.length;
// Posts n messages in a row and returns their ids, oldest first.
async function post(me: Me, room: string, ...bodies: string[]): Promise<MessageView[]> {
  const out: MessageView[] = [];
  for (const b of bodies) out.push(await postMessage(db, me, room, b));
  return out;
}

describe('the fixtures', () => {
  it('start with a few messages in the team room and one project room, with their references', async () => {
    const lead = await meAs(LEAD);
    const team = await listMessages(db, lead, TEAM_ID);
    expect(team.messages.length).toBe(3);
    expect(team.messages.map((m) => m.authorId)).toEqual([LEAD, 'per_eli', LEAD]);
    expect(team.messages[1].parts.some((p) => p.t === 'person')).toBe(true);
    const room = await listMessages(db, lead, OPEN);
    expect(room.messages.length).toBe(2);
    expect(room.messages[0].parts.some((p) => p.t === 'task')).toBe(true);
    expect((await db.query(`SELECT 1 FROM chat_refs`)).rows.length).toBe(2);
  });
});

describe('post and list', () => {
  it('posts a message and lists it, newest last', async () => {
    const cy = await meAs(CY);
    const m = await postMessage(db, cy, TEAM_ID, '  Lunch at one  ');
    expect(m).toMatchObject({ authorId: CY, roomKind: 'team', roomId: TEAM_ID, mine: true, deleted: false, body: 'Lunch at one', editedAt: null });
    const page = await listMessages(db, cy, TEAM_ID);
    expect(text(page.messages[page.messages.length - 1])).toBe('Lunch at one');
    expect(page.room).toMatchObject({ kind: 'team', archived: false });
    // Someone else reads it without the editable body.
    const seen = (await listMessages(db, await meAs(BO), TEAM_ID)).messages.at(-1)!;
    expect(seen).toMatchObject({ mine: false, body: null });
  });

  it('pages back by message id, newest page last, with no gaps or repeats', async () => {
    const cy = await meAs(CY);
    const made = await post(cy, OPEN, 'm1', 'm2', 'm3', 'm4', 'm5');
    const first = await listMessages(db, cy, OPEN, { limit: 3 });
    expect(first.hasMore).toBe(true);
    expect(first.messages.map(text)).toEqual(['m3', 'm4', 'm5']);
    const second = await listMessages(db, cy, OPEN, { limit: 3, before: first.messages[0].id });
    expect(second.hasMore).toBe(true);
    expect(second.messages.slice(-2).map(text)).toEqual(['m1', 'm2']);
    const third = await listMessages(db, cy, OPEN, { limit: 3, before: second.messages[0].id });
    expect(third.hasMore).toBe(false);
    const all = [...third.messages, ...second.messages, ...first.messages].map((m) => m.id);
    expect(new Set(all).size).toBe(all.length);
    expect(all.length).toBe(7); // 2 from the fixtures and 5 new
    expect(all.slice(-5)).toEqual(made.map((m) => m.id));
  });

  it('refuses a cursor from another room', async () => {
    const cy = await meAs(CY);
    const [m] = await post(cy, TEAM_ID, 'here');
    expect(await status(listMessages(db, cy, OPEN, { before: m.id }))).toBe(400);
  });

  it('refuses an empty or over-long message', async () => {
    const cy = await meAs(CY);
    expect(await status(postMessage(db, cy, TEAM_ID, '   '))).toBe(400);
    expect(await status(postMessage(db, cy, TEAM_ID, 'x'.repeat(CHAT_MAX + 1)))).toBe(400);
    expect(await status(postMessage(db, cy, TEAM_ID, 'x'.repeat(CHAT_MAX)))).toBe('ok');
    expect(CHAT_MAX).toBe(4000);
  });

  it('shows a reference by its label and refuses one the writer cannot see', async () => {
    const lead = await meAs(LEAD);
    const m = await postMessage(db, lead, TEAM_ID, `See [[task:${hiddenTask}]] and [[person:${CY}]]`);
    expect(m.parts.map((p) => p.t)).toEqual(['text', 'task', 'text', 'person']);
    // DEE cannot reference a task in a project they do not see, nor a missing person.
    const dee = await meAs(DEE);
    expect(await status(postMessage(db, dee, TEAM_ID, `See [[task:${hiddenTask}]]`))).toBe(400);
    expect(await status(postMessage(db, dee, TEAM_ID, 'Hi [[person:per_nobody]]'))).toBe(400);
    // And DEE reads the lead's reference as "a hidden item".
    const read = (await listMessages(db, dee, TEAM_ID)).messages.find((x) => x.id === m.id)!;
    expect(read.parts.map((p) => p.t)).toEqual(['text', 'hidden', 'text', 'person']);
  });
});

describe('who may enter a room', () => {
  it('opens the team room to everyone and refuses a restricted person a hidden project room', async () => {
    const dee = await meAs(DEE);
    expect(await status(listMessages(db, dee, TEAM_ID))).toBe('ok');
    expect(await status(postMessage(db, dee, TEAM_ID, 'Hello team'))).toBe('ok');
    expect(await status(listMessages(db, dee, HIDDEN))).toBe(404);
    expect(await status(postMessage(db, dee, HIDDEN, 'Let me in'))).toBe(404);
    expect(await status(markRead(db, dee, HIDDEN))).toBe(404);
    // The same 404 as a room that does not exist.
    expect(await status(listMessages(db, dee, 'prj_nothing'))).toBe(404);
    // Someone who sees the project is in.
    const lead = await meAs(LEAD);
    expect(await status(postMessage(db, lead, HIDDEN, 'Tiers update'))).toBe('ok');
    expect(await status(listMessages(db, dee, HIDDEN))).toBe(404);
  });

  it('lists the team room first, then only the projects the reader sees, by latest message', async () => {
    const dee = await meAs(DEE);
    const rooms = await listRooms(db, dee);
    expect(rooms[0]).toMatchObject({ kind: 'team', id: TEAM_ID });
    expect(rooms.some((r) => r.id === HIDDEN)).toBe(false);
    const lead = await meAs(LEAD);
    const all = await listRooms(db, lead);
    expect(all.some((r) => r.id === HIDDEN)).toBe(true);
    await postMessage(db, lead, HIDDEN, 'newest');
    const after = await listRooms(db, lead);
    expect(after[1].id).toBe(HIDDEN); // team first, then the room with the latest message
  });

  it('lets a restricted person into a project room once they are given view on it', async () => {
    const dee = await meAs(DEE);
    expect(await status(listMessages(db, dee, HIDDEN))).toBe(404);
    await db.query(`INSERT INTO project_viewers (project_id, person_id) VALUES ($1,$2)`, [HIDDEN, DEE]);
    expect(await status(listMessages(db, dee, HIDDEN))).toBe('ok');
  });

  it('keeps an archived project room readable but not writable', async () => {
    const lead = await meAs(LEAD);
    await db.query(`UPDATE projects SET archived_at = now(), archived_by = $2 WHERE id = $1`, [OPEN, LEAD]);
    const page = await listMessages(db, lead, OPEN);
    expect(page.room.archived).toBe(true);
    expect(page.messages.length).toBe(2);
    expect(await status(postMessage(db, lead, OPEN, 'Too late'))).toBe(400);
    expect(await status(deleteMessage(db, lead, page.messages[1].id))).toBe(400);
  });
});

describe('edit and delete', () => {
  it('lets only the author edit, and marks the message edited', async () => {
    const cy = await meAs(CY);
    const [m] = await post(cy, TEAM_ID, 'First draft');
    const edited = await editMessage(db, cy, m.id, 'Second draft');
    expect(text(edited)).toBe('Second draft');
    expect(edited.editedAt).not.toBeNull();
    const bo = await meAs(BO);
    expect(await status(editMessage(db, bo, m.id, 'Hijack'))).toBe(403);
    expect(await status(deleteMessage(db, bo, m.id))).toBe(403);
    expect(await status(editMessage(db, cy, m.id, ''))).toBe(400);
  });

  it('removes a message softly: the row stays, the body is empty and it reads removed', async () => {
    const cy = await meAs(CY);
    const [m] = await post(cy, TEAM_ID, `Please see [[person:${BO}]]`);
    await deleteMessage(db, cy, m.id);
    const row = (await db.query<{ body: string; deleted_at: string | null }>(`SELECT body, deleted_at FROM chat_messages WHERE id = $1`, [m.id])).rows[0];
    expect(row.body).toBe('');
    expect(row.deleted_at).not.toBeNull();
    expect((await db.query(`SELECT 1 FROM chat_refs WHERE message_id = $1`, [m.id])).rows.length).toBe(0);
    const seen = (await listMessages(db, await meAs(BO), TEAM_ID)).messages.find((x) => x.id === m.id)!;
    expect(seen).toMatchObject({ deleted: true, parts: [], body: null });
    // A removed message cannot be edited or removed again, and its mention no longer shows on Home.
    expect(await status(editMessage(db, cy, m.id, 'Back'))).toBe(404);
    expect(await status(deleteMessage(db, cy, m.id))).toBe(404);
    expect(await listChatMentions(db, await meAs(BO))).toEqual([]);
  });

  it('does not let a person edit a message in a room they cannot see', async () => {
    const lead = await meAs(LEAD);
    const [m] = await post(lead, HIDDEN, 'Private to the project');
    const dee = await meAs(DEE);
    expect(await status(editMessage(db, dee, m.id, 'x'))).toBe(404);
    expect(await status(deleteMessage(db, dee, m.id))).toBe(404);
  });
});

describe('mentions', () => {
  it('writes an in-app notice for a mentioned person and nothing else', async () => {
    const lead = await meAs(LEAD);
    const m = await postMessage(db, lead, TEAM_ID, `Hi [[person:${CY}]] and [[person:${LEAD}]]`);
    expect(await told(CY)).toBe(1);
    expect(await told(LEAD)).toBe(0); // not the writer
    const row = (await db.query<{ message_id: string; comment_id: string | null; task_id: string | null }>(`SELECT message_id, comment_id, task_id FROM notices WHERE person_id = $1`, [CY])).rows[0];
    expect(row).toEqual({ message_id: m.id, comment_id: null, task_id: null });
    const list = await listChatMentions(db, await meAs(CY));
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ byName: 'Meera Iyer', viaChat: true, href: `/chat?room=${TEAM_ID}`, subjectTitle: 'Team' });
  });

  it('does not tell someone who cannot see the project room', async () => {
    const lead = await meAs(LEAD);
    await postMessage(db, lead, HIDDEN, `Look [[person:${DEE}]]`);
    expect(await told(DEE)).toBe(0);
    await postMessage(db, lead, HIDDEN, `Look [[person:${CY}]]`);
    expect(await told(CY)).toBe(1);
  });

  it('tells only the people an edit adds', async () => {
    const lead = await meAs(LEAD);
    const m = await postMessage(db, lead, TEAM_ID, `Hi [[person:${CY}]]`);
    await editMessage(db, lead, m.id, `Hi [[person:${CY}]] and [[person:${BO}]]`);
    expect(await told(CY)).toBe(1);
    expect(await told(BO)).toBe(1);
  });

  it('clears the Home mention once the room is read past it', async () => {
    const lead = await meAs(LEAD);
    await postMessage(db, lead, TEAM_ID, `Hi [[person:${CY}]]`);
    const cy = await meAs(CY);
    expect(await listChatMentions(db, cy)).toHaveLength(1);
    await markRead(db, cy, TEAM_ID);
    expect(await listChatMentions(db, cy)).toHaveLength(0);
  });

  it('hides a mention when the reader no longer sees the room', async () => {
    const lead = await meAs(LEAD);
    await db.query(`INSERT INTO project_viewers (project_id, person_id) VALUES ($1,$2)`, [HIDDEN, DEE]);
    await postMessage(db, lead, HIDDEN, `Look [[person:${DEE}]]`);
    expect(await told(DEE)).toBe(1);
    await db.query(`DELETE FROM project_viewers WHERE project_id = $1 AND person_id = $2`, [HIDDEN, DEE]);
    expect(await listChatMentions(db, await meAs(DEE))).toEqual([]);
  });
});

describe('View as', () => {
  it('refuses every write while viewing as someone, and still reads', async () => {
    const view = await meAs(DEE, true);
    const real = await meAs(DEE);
    const [m] = await post(real, TEAM_ID, 'Mine');
    expect(await status(postMessage(db, view, TEAM_ID, 'Hi'))).toBe(403);
    expect(await status(editMessage(db, view, m.id, 'Changed'))).toBe(403);
    expect(await status(deleteMessage(db, view, m.id))).toBe(403);
    expect(await status(markRead(db, view, TEAM_ID))).toBe(403);
    expect(await status(linkTaskToMessage(db, view, m.id, hiddenTask))).toBe(403);
    expect(await status(listMessages(db, view, TEAM_ID))).toBe('ok');
    expect(await status(listRooms(db, view))).toBe('ok');
  });
});

describe('unread', () => {
  it('counts other people\'s messages after the read mark, per room and in total', async () => {
    const cy = await meAs(CY);
    const lead = await meAs(LEAD);
    // Fixtures: 3 in the team room and 2 in the landing room, none written by CY.
    expect((await listRooms(db, cy)).find((r) => r.id === TEAM_ID)!.unread).toBe(3);
    expect(await unreadTotal(db, cy)).toBe(5);
    await post(cy, TEAM_ID, 'My own message');
    expect(await unreadTotal(db, cy)).toBe(5); // never counts your own
    await markRead(db, cy, TEAM_ID);
    expect((await listRooms(db, cy)).find((r) => r.id === TEAM_ID)!.unread).toBe(0);
    expect(await unreadTotal(db, cy)).toBe(2);
    await post(lead, TEAM_ID, 'New one');
    expect((await listRooms(db, cy)).find((r) => r.id === TEAM_ID)!.unread).toBe(1);
    await markRead(db, cy, OPEN);
    expect(await unreadTotal(db, cy)).toBe(1);
  });

  it('does not count a removed message, or a room the reader cannot see', async () => {
    const lead = await meAs(LEAD);
    const dee = await meAs(DEE);
    const before = await unreadTotal(db, dee);
    await post(lead, HIDDEN, 'Hidden room news');
    expect(await unreadTotal(db, dee)).toBe(before);
    const [m] = await post(lead, TEAM_ID, 'Oops');
    expect(await unreadTotal(db, dee)).toBe(before + 1);
    await deleteMessage(db, lead, m.id);
    expect(await unreadTotal(db, dee)).toBe(before);
  });

  it('marks read up to a given message and never moves the mark back', async () => {
    const lead = await meAs(LEAD);
    const cy = await meAs(CY);
    const [a, , c] = await post(lead, OPEN, 'a', 'b', 'c');
    await markRead(db, cy, OPEN, c.id);
    expect((await listRooms(db, cy)).find((r) => r.id === OPEN)!.unread).toBe(0);
    await markRead(db, cy, OPEN, a.id); // older: stays where it was
    expect((await listRooms(db, cy)).find((r) => r.id === OPEN)!.unread).toBe(0);
    expect(await status(markRead(db, cy, OPEN, 'msg_missing'))).toBe(400);
    expect((await listMessages(db, cy, OPEN)).lastReadAt).not.toBeNull();
  });
});

describe('make a task from a message', () => {
  it('hands the message text to the quick add and links the new task back', async () => {
    const bo = await meAs(BO);
    const [m] = await post(bo, OPEN, 'Please check the footer links before Friday');
    const from = await messageForTask(db, await meAs(LEAD), m.id);
    expect(from).toMatchObject({ id: m.id, roomId: OPEN, roomKind: 'project', text: 'Please check the footer links before Friday' });
    // Nothing is created until a person confirms.
    expect((await db.query(`SELECT 1 FROM chat_task_links`)).rows.length).toBe(0);
    const task = await s.createTask(db, LEAD, { teamId: TEAM_ID, title: 'Check the footer links', ownerId: BO, dueOn: '2026-10-12', projectId: OPEN });
    await linkTaskToMessage(db, await meAs(LEAD), m.id, task.id);
    await linkTaskToMessage(db, await meAs(LEAD), m.id, task.id); // twice changes nothing
    expect((await db.query(`SELECT 1 FROM chat_task_links`)).rows.length).toBe(1);
    const page = await listMessages(db, bo, OPEN);
    expect(page.messages.at(-1)!.tasks).toEqual([{ id: task.id, title: 'Check the footer links' }]);
    expect(await taskSource(db, bo, task.id)).toMatchObject({ messageId: m.id, roomId: OPEN, roomName: 'Autumn landing page', authorName: 'Kabir Sethi', removed: false });
    expect(await taskSource(db, bo, hiddenTask)).toBeNull();
  });

  it('is not offered for a message in a room the reader cannot see, or one that was removed', async () => {
    const lead = await meAs(LEAD);
    const [m, n] = await post(lead, HIDDEN, 'Secret plan', 'Another');
    expect(await status(messageForTask(db, await meAs(DEE), m.id))).toBe(404);
    await deleteMessage(db, lead, n.id);
    expect(await status(messageForTask(db, lead, n.id))).toBe(404);
    expect(await status(messageForTask(db, lead, 'msg_missing'))).toBe(404);
  });

  it('keeps a task\'s link to a removed message, marked removed', async () => {
    const lead = await meAs(LEAD);
    const [m] = await post(lead, TEAM_ID, 'Ship the banner');
    const task = await s.createTask(db, LEAD, { teamId: TEAM_ID, title: 'Ship the banner', ownerId: LEAD, dueOn: '2026-10-12' });
    await linkTaskToMessage(db, lead, m.id, task.id);
    await deleteMessage(db, lead, m.id);
    expect(await taskSource(db, lead, task.id)).toMatchObject({ messageId: m.id, removed: true });
  });

  it('shows a made task only to a reader who may see it', async () => {
    const lead = await meAs(LEAD);
    const [m] = await post(lead, TEAM_ID, 'Do the tiers');
    await linkTaskToMessage(db, lead, m.id, hiddenTask);
    const seenByLead = (await listMessages(db, lead, TEAM_ID)).messages.find((x) => x.id === m.id)!;
    expect(seenByLead.tasks.length).toBe(1);
    const seenByDee = (await listMessages(db, await meAs(DEE), TEAM_ID)).messages.find((x) => x.id === m.id)!;
    expect(seenByDee.tasks).toEqual([]);
    expect((await seenTasks(db, await meAs(DEE))).some((t) => t.id === hiddenTask)).toBe(false);
  });
});

describe('the upgrade', () => {
  it('adds the chat tables and message_id to an older database, and runs again safely', async () => {
    await db.exec(`
      ALTER TABLE notices DROP COLUMN message_id;
      DROP TABLE chat_task_links; DROP TABLE chat_reads; DROP TABLE chat_refs; DROP TABLE chat_messages;`);
    await upgrade(db);
    await upgrade(db);
    const cy = await meAs(CY);
    await postMessage(db, await meAs(LEAD), TEAM_ID, `Hi [[person:${CY}]]`);
    expect(await told(CY)).toBe(1);
    await markRead(db, cy, TEAM_ID);
    // RLS is on for every chat table, with no policies.
    const { rows } = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('chat_messages','chat_refs','chat_reads','chat_task_links')`);
    expect(rows.length).toBe(4);
    expect(rows.every((r) => r.relrowsecurity)).toBe(true);
  });
});
