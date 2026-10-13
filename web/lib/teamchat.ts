import type { Me } from './auth';
import type { Db, Tx } from './db';
import { ApiError, bad, forbidden, notFound } from './errors';
import { assertNotViewing } from './http';
import { labels, partsOf, refsIn, type Mention, type Part, type RefKind } from './comments';
import { getProject, teamProjects } from './plan';
import { newId } from './service';
import { seesProject, seesTaskRow, sightOf, type Sight } from './sight';
import { today as todayIst } from './time';
import { sightFor } from './visibility';

// Team chat (13 Oct). Rooms: one for the whole team, one per project. No direct messages.
// A room is named by its id alone: the team's id is the team room, any other id is a project. Whoever can see a project
// can read and write in its room (lib/sight.ts). A hidden room reads as missing, the same 404 as an id that does not exist.
// A message uses the same [[person|task|project:ID]] tokens as a comment, and a mention writes an in-app notice.
// Nothing here emails, pushes or sends. Only the author edits or removes a message, and a removed one keeps its row with
// an empty body, so the room reads "Message removed". A project that is archived keeps its room, read-only.
//
// Paging uses message ids as cursors, not times: a time loses its microseconds on the way to the browser.

export const CHAT_MAX = 4000;
export const PAGE_DEFAULT = 50;
export const PAGE_MAX = 100;

export type RoomKind = 'team' | 'project';
export type RoomInfo = { kind: RoomKind; id: string; name: string; archived: boolean };
export type Room = RoomInfo & { unread: number; lastAt: string | null };

export type MessageView = {
  id: string; roomKind: RoomKind; roomId: string; authorId: string; authorName: string;
  createdAt: string; editedAt: string | null; deleted: boolean; mine: boolean;
  parts: Part[];
  body: string | null; // the stored text with tokens, for the author only, to edit
  tasks: { id: string; title: string }[]; // tasks made from this message that this reader may see
};
export type RoomPage = { room: RoomInfo; messages: MessageView[]; hasMore: boolean; lastReadAt: string | null };

type Row = {
  id: string; room_kind: RoomKind; room_id: string; author_id: string; body: string; created_at: string;
  edited_at: string | null; deleted_at: string | null; author_name: string;
};
const MESSAGE_SQL = `SELECT m.*, p.display_name AS author_name FROM chat_messages m JOIN people p ON p.id = m.author_id`;

// ---------- rooms and who may enter ----------

// The room for this reader, or a 404 for a room that is missing, hidden, or on another team.
export async function roomFor(tx: Tx, me: Me, roomId: string): Promise<RoomInfo> {
  if (roomId === me.team.id) return { kind: 'team', id: roomId, name: 'Team', archived: false };
  try {
    const p = await getProject(tx, roomId);
    if (p.teamId !== me.team.id || !seesProject(await sightFor(tx, me), p.id)) throw notFound();
    return { kind: 'project', id: p.id, name: p.name, archived: !!p.archivedAt };
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) throw notFound('No such room.');
    throw e;
  }
}

// Unread per room the reader can see: other people's messages that still stand and came after the reader's read mark.
async function counts(db: Tx, me: Me): Promise<Map<string, { unread: number; lastAt: string | null }>> {
  const { rows } = await db.query<{ room_id: string; unread: number; last_at: string | null }>(
    `SELECT m.room_id,
            count(*) FILTER (WHERE m.author_id <> $1 AND (r.read_at IS NULL OR m.created_at > r.read_at))::int AS unread,
            max(m.created_at) AS last_at
     FROM chat_messages m LEFT JOIN chat_reads r ON r.person_id = $1 AND r.room_kind = m.room_kind AND r.room_id = m.room_id
     WHERE m.deleted_at IS NULL
       AND (m.room_id = $2 OR m.room_id IN (SELECT id FROM projects WHERE team_id = $2))
     GROUP BY m.room_id`, [me.person.id, me.team.id]);
  return new Map(rows.map((r) => [r.room_id, { unread: r.unread, lastAt: r.last_at }]));
}

// The team room first, then the projects the reader sees, by latest message. An archived project shows only if it has messages.
export async function listRooms(db: Db, me: Me): Promise<Room[]> {
  const [sight, byRoom, projects] = await Promise.all([sightFor(db, me), counts(db, me), teamProjects(db, me.team.id)]);
  const stat = (id: string) => byRoom.get(id) ?? { unread: 0, lastAt: null };
  const rooms: Room[] = projects
    .filter((p) => seesProject(sight, p.id) && (!p.archivedAt || byRoom.has(p.id)))
    .map((p) => ({ kind: 'project' as const, id: p.id, name: p.name, archived: !!p.archivedAt, ...stat(p.id) }));
  rooms.sort((a, b) => (b.lastAt ?? '').localeCompare(a.lastAt ?? '') || a.name.localeCompare(b.name));
  return [{ kind: 'team', id: me.team.id, name: 'Team', archived: false, ...stat(me.team.id) }, ...rooms];
}

// Unread across every room this reader sees, for the badge in the nav.
export async function unreadTotal(db: Db, me: Me): Promise<number> {
  const [sight, byRoom] = await Promise.all([sightFor(db, me), counts(db, me)]);
  let n = 0;
  for (const [id, c] of byRoom) if (id === me.team.id || seesProject(sight, id)) n += c.unread;
  return n;
}

// ---------- reading ----------

async function views(tx: Tx, me: Me, sight: Sight, rows: Row[]): Promise<MessageView[]> {
  const names = await labels(tx, me, sight, rows.flatMap((r) => (r.deleted_at ? [] : refsIn(r.body))));
  const made = new Map<string, { id: string; title: string }[]>();
  if (rows.length) {
    const { rows: ls } = await tx.query<{ message_id: string; id: string; title: string; project_id: string | null; owner_id: string; created_by: string | null; blocked_on_id: string | null }>(
      `SELECT l.message_id, t.id, t.title, t.project_id, t.owner_id, t.created_by, t.blocked_on_id FROM chat_task_links l JOIN tasks t ON t.id = l.task_id
       WHERE l.message_id = ANY($1) ORDER BY l.created_at`, [rows.map((r) => r.id)]);
    for (const l of ls) if (seesTaskRow(sight, l)) made.set(l.message_id, [...(made.get(l.message_id) ?? []), { id: l.id, title: l.title }]);
  }
  return rows.map((r) => {
    const deleted = !!r.deleted_at;
    const mine = r.author_id === me.person.id;
    return {
      id: r.id, roomKind: r.room_kind, roomId: r.room_id, authorId: r.author_id, authorName: r.author_name,
      createdAt: r.created_at, editedAt: r.edited_at, deleted, mine,
      parts: deleted ? [] : partsOf(r.body, names), body: mine && !deleted ? r.body : null,
      tasks: made.get(r.id) ?? [],
    };
  });
}

// The newest `limit` messages, oldest first. `before` is a message id: the page ends just above it.
export async function listMessages(db: Db, me: Me, roomId: string, opts: { before?: string; limit?: number } = {}): Promise<RoomPage> {
  const room = await roomFor(db, me, roomId);
  const limit = Math.min(Math.max(Math.trunc(opts.limit ?? PAGE_DEFAULT), 1), PAGE_MAX);
  if (opts.before) {
    const { rows } = await db.query(`SELECT 1 FROM chat_messages WHERE id = $1 AND room_id = $2`, [opts.before, roomId]);
    if (!rows.length) throw bad('invalid_cursor', 'That message is not in this room.', 'before');
  }
  const { rows } = await db.query<Row>(
    `${MESSAGE_SQL} WHERE m.room_id = $1 ${opts.before ? `AND (m.created_at, m.id) < (SELECT created_at, id FROM chat_messages WHERE id = $3)` : ''}
     ORDER BY m.created_at DESC, m.id DESC LIMIT $2`,
    opts.before ? [roomId, limit + 1, opts.before] : [roomId, limit + 1]);
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit).reverse();
  const { rows: rd } = await db.query<{ read_at: string }>(`SELECT read_at FROM chat_reads WHERE person_id = $1 AND room_id = $2`, [me.person.id, roomId]);
  return { room, messages: await views(db, me, await sightFor(db, me), page), hasMore, lastReadAt: rd[0]?.read_at ?? null };
}

// ---------- writing ----------

// A reference the writer cannot see is refused, with the same words as one that does not exist.
async function checkBody(tx: Tx, me: Me, sight: Sight, raw: string): Promise<{ body: string; refs: { kind: RefKind; id: string }[] }> {
  const body = raw.trim();
  if (body.length < 1 || body.length > CHAT_MAX) throw bad('invalid_body', `A message is 1 to ${CHAT_MAX} characters.`, 'body');
  const refs = refsIn(body);
  const names = await labels(tx, me, sight, refs);
  if (refs.some((r) => names.get(`${r.kind}:${r.id}`) == null)) throw bad('invalid_ref', 'One of the @ or # items is not available. Pick it again.', 'body');
  return { body, refs };
}

// Tells each newly mentioned person who can read the room, unless they are the writer. In-app only.
async function notifyMentions(tx: Tx, me: Me, room: RoomInfo, messageId: string, personIds: string[]): Promise<void> {
  for (const pid of new Set(personIds)) {
    if (pid === me.person.id) continue;
    const sight = await sightOf(tx, me.team.id, pid);
    if (room.kind === 'project' && !seesProject(sight, room.id)) continue;
    const { rows } = await tx.query(`SELECT 1 FROM people p WHERE p.id = $1 AND p.active AND p.id IN (SELECT person_id FROM team_members WHERE team_id = $2)`, [pid, me.team.id]);
    if (!rows.length) continue;
    await tx.query(
      `INSERT INTO notices (id, person_id, task_id, message_id, kind, for_date, created_at) VALUES ($1,$2,NULL,$3,'mentioned',$4,now())`,
      [newId('ntc'), pid, messageId, todayIst()]);
  }
}

function assertWritable(room: RoomInfo): void {
  if (room.archived) throw bad('project_archived', 'This project is archived. Restore it to chat here.');
}

export async function postMessage(db: Db, me: Me, roomId: string, raw: string): Promise<MessageView> {
  assertNotViewing(me);
  return db.transaction(async (tx) => {
    const room = await roomFor(tx, me, roomId);
    assertWritable(room);
    const sight = await sightFor(tx, me);
    const { body, refs } = await checkBody(tx, me, sight, raw);
    const id = newId('msg');
    await tx.query(`INSERT INTO chat_messages (id, room_kind, room_id, author_id, body) VALUES ($1,$2,$3,$4,$5)`, [id, room.kind, room.id, me.person.id, body]);
    for (const r of refs) await tx.query(`INSERT INTO chat_refs (message_id, ref_kind, ref_id) VALUES ($1,$2,$3)`, [id, r.kind, r.id]);
    await notifyMentions(tx, me, room, id, refs.filter((r) => r.kind === 'person').map((r) => r.id));
    const { rows } = await tx.query<Row>(`${MESSAGE_SQL} WHERE m.id = $1`, [id]);
    return (await views(tx, me, sight, rows))[0];
  });
}

// Loads a message in a room the reader may enter, then lets only its author through.
async function ownMessage(tx: Tx, me: Me, id: string): Promise<{ row: Row; room: RoomInfo }> {
  const { rows } = await tx.query<Row>(`${MESSAGE_SQL} WHERE m.id = $1 FOR UPDATE OF m`, [id]);
  const row = rows[0];
  if (!row) throw notFound('No such message.');
  const room = await roomFor(tx, me, row.room_id).catch((e) => { throw e instanceof ApiError && e.status === 404 ? notFound('No such message.') : e; });
  if (row.deleted_at) throw notFound('No such message.');
  if (row.author_id !== me.person.id) throw forbidden('Only the author can change a message.');
  return { row, room };
}

export async function editMessage(db: Db, me: Me, id: string, raw: string): Promise<MessageView> {
  assertNotViewing(me);
  return db.transaction(async (tx) => {
    const { row, room } = await ownMessage(tx, me, id);
    assertWritable(room);
    const sight = await sightFor(tx, me);
    const { body, refs } = await checkBody(tx, me, sight, raw);
    const { rows: before } = await tx.query<{ ref_kind: RefKind; ref_id: string }>(`SELECT ref_kind, ref_id FROM chat_refs WHERE message_id = $1`, [id]);
    const had = new Set(before.filter((r) => r.ref_kind === 'person').map((r) => r.ref_id));
    await tx.query(`UPDATE chat_messages SET body = $2, edited_at = now() WHERE id = $1`, [id, body]);
    await tx.query(`DELETE FROM chat_refs WHERE message_id = $1`, [id]);
    for (const r of refs) await tx.query(`INSERT INTO chat_refs (message_id, ref_kind, ref_id) VALUES ($1,$2,$3)`, [id, r.kind, r.id]);
    // Only people added by this edit are told.
    await notifyMentions(tx, me, room, id, refs.filter((r) => r.kind === 'person' && !had.has(r.id)).map((r) => r.id));
    const { rows } = await tx.query<Row>(`${MESSAGE_SQL} WHERE m.id = $1`, [id]);
    return (await views(tx, me, sight, rows))[0];
  });
}

// Soft delete: the row stays, with an empty body. Undo never hard-deletes, and neither does this.
export async function deleteMessage(db: Db, me: Me, id: string): Promise<void> {
  assertNotViewing(me);
  await db.transaction(async (tx) => {
    const { room } = await ownMessage(tx, me, id);
    assertWritable(room);
    await tx.query(`UPDATE chat_messages SET body = '', deleted_at = now() WHERE id = $1`, [id]);
    await tx.query(`DELETE FROM chat_refs WHERE message_id = $1`, [id]);
  });
}

// Moves the reader's read mark up to a message (the last one they were shown), or to the newest in the room. It never moves back.
// Mention notices for messages up to that point are marked read too, so Home stops showing what was seen in the room.
export async function markRead(db: Db, me: Me, roomId: string, upTo?: string): Promise<void> {
  assertNotViewing(me);
  await db.transaction(async (tx) => {
    const room = await roomFor(tx, me, roomId);
    if (upTo) {
      const { rows } = await tx.query(`SELECT 1 FROM chat_messages WHERE id = $1 AND room_id = $2`, [upTo, roomId]);
      if (!rows.length) throw bad('invalid_cursor', 'That message is not in this room.', 'upTo');
    }
    const mark = upTo
      ? `(SELECT created_at FROM chat_messages WHERE id = $4)`
      : `COALESCE((SELECT max(created_at) FROM chat_messages WHERE room_id = $3), now())`;
    const params: unknown[] = [me.person.id, room.kind, roomId, ...(upTo ? [upTo] : [])];
    await tx.query(
      `INSERT INTO chat_reads (person_id, room_kind, room_id, read_at) VALUES ($1,$2,$3,${mark})
       ON CONFLICT (person_id, room_kind, room_id) DO UPDATE SET read_at = GREATEST(chat_reads.read_at, EXCLUDED.read_at)`, params);
    await tx.query(
      `UPDATE notices SET read_at = now() WHERE person_id = $1 AND kind = 'mentioned' AND read_at IS NULL
         AND message_id IN (SELECT m.id FROM chat_messages m JOIN chat_reads r ON r.person_id = $1 AND r.room_id = m.room_id
                            WHERE m.room_id = $2 AND m.created_at <= r.read_at)`, [me.person.id, roomId]);
  });
}

// ---------- make a task from a message ----------

// A message the reader may see, for the quick add to start from. Hidden, missing and removed all read as missing.
export async function messageForTask(db: Db, me: Me, id: string): Promise<{ id: string; roomId: string; roomName: string; roomKind: RoomKind; text: string }> {
  const { rows } = await db.query<Row>(`${MESSAGE_SQL} WHERE m.id = $1`, [id]);
  const row = rows[0];
  if (!row || row.deleted_at) throw notFound('No such message.');
  const room = await roomFor(db, me, row.room_id).catch((e) => { throw e instanceof ApiError && e.status === 404 ? notFound('No such message.') : e; });
  const [v] = await views(db, me, await sightFor(db, me), [row]);
  return { id, roomId: room.id, roomName: room.name, roomKind: room.kind, text: plain(v.parts) };
}

// Records that a task was made from a message. The caller has checked the message with messageForTask.
export async function linkTaskToMessage(db: Db, me: Me, messageId: string, taskId: string): Promise<void> {
  assertNotViewing(me);
  await db.query(`INSERT INTO chat_task_links (message_id, task_id, made_by) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [messageId, taskId, me.person.id]);
}

export type TaskSource = { messageId: string; roomId: string; roomName: string; authorName: string; at: string; removed: boolean };

// Where a task came from, when it was made from a chat message and the reader may enter that room.
export async function taskSource(db: Db, me: Me, taskId: string): Promise<TaskSource | null> {
  const { rows } = await db.query<Row>(
    `${MESSAGE_SQL} JOIN chat_task_links l ON l.message_id = m.id WHERE l.task_id = $1 ORDER BY l.created_at LIMIT 1`, [taskId]);
  const row = rows[0];
  if (!row) return null;
  const room = await roomFor(db, me, row.room_id).catch(() => null);
  if (!room) return null;
  return { messageId: row.id, roomId: room.id, roomName: room.name, authorName: row.author_name, at: row.created_at, removed: !!row.deleted_at };
}

// ---------- plain text and Home ----------

export const plain = (parts: Part[]): string =>
  parts.map((p) => (p.t === 'text' ? p.text : p.t === 'person' ? `@${p.name}` : p.t === 'task' ? `#${p.title}` : p.t === 'project' ? `#${p.name}` : 'a hidden item')).join('');

// Unread "mentioned" notices from chat whose message still stands and whose room this person still sees. Same shape as a
// comment mention, with a link to the room.
export async function listChatMentions(db: Db, me: Me): Promise<Mention[]> {
  const { rows } = await db.query<{ notice_id: string } & Row>(
    `SELECT n.id AS notice_id, m.*, p.display_name AS author_name FROM notices n
     JOIN chat_messages m ON m.id = n.message_id JOIN people p ON p.id = m.author_id
     WHERE n.person_id = $1 AND n.kind = 'mentioned' AND n.read_at IS NULL AND m.deleted_at IS NULL
     ORDER BY n.created_at DESC LIMIT 50`, [me.person.id]);
  const sight = await sightFor(db, me);
  const vs = await views(db, me, sight, rows);
  const out: Mention[] = [];
  for (let i = 0; i < rows.length; i++) {
    const v = vs[i];
    const room = await roomFor(db, me, v.roomId).catch(() => null);
    if (!room) continue;
    const text = plain(v.parts);
    out.push({
      noticeId: rows[i].notice_id, commentId: v.id, byName: v.authorName, subjectKind: 'project', subjectId: room.id, subjectTitle: room.name,
      snippet: text.length > 140 ? `${text.slice(0, 137)}...` : text, createdAt: v.createdAt, href: `/chat?room=${encodeURIComponent(room.id)}`, viaChat: true,
    });
  }
  return out;
}
