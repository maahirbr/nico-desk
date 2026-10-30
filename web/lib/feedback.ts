import type { Me } from './auth';
import type { Db, Tx } from './db';
import { ApiError, bad, forbidden, notFound } from './errors';
import { assertNotViewing } from './http';
import { newId, sniffImage } from './service';

// Pilot feedback from inside the app (13 Oct). Anyone signed in can send a note, and everyone on the team reads every
// note (14 Oct). A note can carry up to three screenshots, and teammates can press "+1" on it. Since 30 Oct anyone
// replies, and anyone marks a note Done, or Not now with a short reason, or reopens it; nothing is ever removed. Each of
// those tells the writer and everyone who gave +1 on Home (feedback_news), never the person who did it. Nothing is emailed.

export const FEEDBACK_MAX = 4000;
const PATH_MAX = 300;

export type FeedbackReply = { id: string; authorName: string; body: string; createdAt: string };
export type FeedbackStatus = 'open' | 'done' | 'not_now';
export type FeedbackView = { id: string; personId: string; personName: string; path: string | null; body: string; createdAt: string; images: number; votes: number; mine: boolean;
  status: FeedbackStatus; closedByName: string | null; closedAt: string | null; closedNote: string | null; replies: FeedbackReply[] };
export const CLOSE_NOTE_MAX = 280;
export const REPLY_MAX = 2000;

export const FEEDBACK_IMAGE_MAX = 600 * 1024; // the browser shrinks a screenshot well under this
export const FEEDBACK_IMAGES = 3;

// An in-app path only. A full URL, or anything with a query string, is not stored, so a note never carries a link token.
export function cleanPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const p = raw.trim().split(/[?#]/)[0];
  if (!p.startsWith('/') || p.startsWith('//') || p.length > PATH_MAX) return null;
  return p;
}

export async function sendFeedback(db: Db, me: Me, input: { body: string; path?: string | null }): Promise<{ id: string }> {
  assertNotViewing(me);
  const body = input.body.trim();
  if (!body) throw bad('invalid_body', 'Write a note first.', 'body');
  if (body.length > FEEDBACK_MAX) throw bad('invalid_body', `A note holds ${FEEDBACK_MAX} characters. This one has ${body.length}.`, 'body');
  const id = newId('fbk');
  await db.query(`INSERT INTO feedback (id, person_id, path, body) VALUES ($1,$2,$3,$4)`, [id, me.person.id, cleanPath(input.path), body]);
  return { id };
}

type Row = { id: string; person_id: string; person_name: string; path: string | null; body: string; created_at: string; images: number; votes: number; mine: boolean;
  status: FeedbackStatus; closed_by_name: string | null; closed_at: string | null; closed_note: string | null };


// Everyone on the team reads every note, whatever their role (the PM's call, 14 Oct).
export async function listFeedback(db: Db, me: Me): Promise<FeedbackView[]> {
  const { rows } = await db.query<Row>(
    `SELECT f.id, f.person_id, COALESCE(p.nickname, p.display_name) AS person_name, f.path, f.body, f.created_at,
            f.status, COALESCE(c.nickname, c.display_name) AS closed_by_name, f.closed_at, f.closed_note,
            (SELECT count(*)::int FROM feedback_images i WHERE i.feedback_id = f.id) AS images,
            (SELECT count(*)::int FROM feedback_votes v WHERE v.feedback_id = f.id) AS votes,
            EXISTS (SELECT 1 FROM feedback_votes v WHERE v.feedback_id = f.id AND v.person_id = $2) AS mine
       FROM feedback f JOIN people p ON p.id = f.person_id LEFT JOIN people c ON c.id = f.closed_by
      WHERE f.person_id IN (SELECT person_id FROM team_members WHERE team_id = $1)
      ORDER BY f.created_at DESC, f.id DESC`,
    [me.team.id, me.person.id],
  );
  const replies = await db.query<{ id: string; feedback_id: string; author_name: string; body: string; created_at: string }>(
    `SELECT r.id, r.feedback_id, COALESCE(p.nickname, p.display_name) AS author_name, r.body, r.created_at
       FROM feedback_replies r JOIN people p ON p.id = r.author_id JOIN feedback f ON f.id = r.feedback_id
      WHERE f.person_id IN (SELECT person_id FROM team_members WHERE team_id = $1)
      ORDER BY r.created_at, r.id`, [me.team.id]);
  const byNote = new Map<string, FeedbackReply[]>();
  for (const r of replies.rows) {
    const list = byNote.get(r.feedback_id) ?? [];
    list.push({ id: r.id, authorName: r.author_name, body: r.body, createdAt: r.created_at });
    byNote.set(r.feedback_id, list);
  }
  return rows.map((r) => ({ id: r.id, personId: r.person_id, personName: r.person_name, path: r.path, body: r.body, createdAt: r.created_at, images: r.images, votes: r.votes, mine: r.mine,
    status: r.status, closedByName: r.closed_by_name, closedAt: r.closed_at, closedNote: r.closed_note, replies: byNote.get(r.id) ?? [] }));
}


// A note on this team, or 404. Notes from other teams read as missing.
async function noteOnTeam(db: Db, me: Me, id: string): Promise<{ person_id: string; status: FeedbackStatus }> {
  const { rows } = await db.query<{ person_id: string; status: FeedbackStatus }>(
    `SELECT person_id, status FROM feedback WHERE id = $1 AND person_id IN (SELECT person_id FROM team_members WHERE team_id = $2)`, [id, me.team.id]);
  if (!rows[0]) throw notFound('No such note.');
  return rows[0];
}

// A screenshot on your own note, up to three. The first bytes decide the type, whatever the client says.
export async function addFeedbackImage(db: Db, me: Me, id: string, bytes: Uint8Array, claimedMime: string): Promise<{ n: number }> {
  assertNotViewing(me);
  const note = await noteOnTeam(db, me, id);
  if (note.person_id !== me.person.id) throw forbidden('Only the person who wrote a note adds pictures to it.');
  if (bytes.length === 0) throw bad('invalid_body', 'Choose a picture.', 'image');
  if (bytes.length > FEEDBACK_IMAGE_MAX) throw new ApiError(413, 'image_too_big', 'A picture must be under 600 KB.', 'image');
  const mime = sniffImage(bytes);
  if (!mime || mime !== claimedMime) throw new ApiError(415, 'image_type', 'Use a PNG, JPEG or WebP picture.', 'image');
  const { rows } = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM feedback_images WHERE feedback_id = $1`, [id]);
  if (rows[0].n >= FEEDBACK_IMAGES) throw bad('too_many_images', `A note holds ${FEEDBACK_IMAGES} pictures.`, 'image');
  const n = rows[0].n + 1;
  await db.query(`INSERT INTO feedback_images (feedback_id, n, bytes, mime) VALUES ($1,$2,$3,$4)`, [id, n, bytes, mime]);
  return { n };
}

// Any teammate can see a note's pictures, as they can read the note.
export async function getFeedbackImage(db: Db, me: Me, id: string, n: number): Promise<{ bytes: Uint8Array; mime: string } | null> {
  await noteOnTeam(db, me, id);
  const { rows } = await db.query<{ bytes: Uint8Array; mime: string }>(`SELECT bytes, mime FROM feedback_images WHERE feedback_id = $1 AND n = $2`, [id, n]);
  return rows[0] ? { bytes: new Uint8Array(rows[0].bytes), mime: rows[0].mime } : null;
}

// "+1": on or off, once per person, never on your own note, and only on an open note.
export async function voteFeedback(db: Db, me: Me, id: string, on: boolean): Promise<{ votes: number; mine: boolean }> {
  assertNotViewing(me);
  const note = await noteOnTeam(db, me, id);
  if (note.person_id === me.person.id) throw bad('own_note', 'This is your own note.', 'vote');
  if (on && note.status !== 'open') throw bad('note_closed', 'This note is closed. Reopen it to add a +1.', 'vote');
  if (on) await db.query(`INSERT INTO feedback_votes (feedback_id, person_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [id, me.person.id]);
  else await db.query(`DELETE FROM feedback_votes WHERE feedback_id = $1 AND person_id = $2`, [id, me.person.id]);
  const { rows } = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM feedback_votes WHERE feedback_id = $1`, [id]);
  return { votes: rows[0].n, mine: on };
}

type NewsKind = 'reply' | 'done' | 'not_now' | 'reopened';
// News of a change for the note's writer and everyone who gave it +1, never the person who made the change.
async function tell(db: Tx, noteId: string, actorId: string, kind: NewsKind, extra: { replyId?: string; reason?: string } = {}) {
  const { rows } = await db.query<{ person_id: string }>(
    `SELECT person_id FROM feedback WHERE id = $1 UNION SELECT person_id FROM feedback_votes WHERE feedback_id = $1`, [noteId]);
  for (const r of rows) {
    if (r.person_id === actorId) continue;
    await db.query(`INSERT INTO feedback_news (id, person_id, feedback_id, kind, actor_id, reply_id, reason) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [newId('fbn'), r.person_id, noteId, kind, actorId, extra.replyId ?? null, extra.reason ?? null]);
  }
}

// A reply to a note, from anyone on the team (the PM's call, 30 Oct).
export async function replyFeedback(db: Db, me: Me, id: string, text: string): Promise<{ id: string }> {
  assertNotViewing(me);
  await noteOnTeam(db, me, id);
  const body = text.trim();
  if (!body) throw bad('invalid_body', 'Write a reply first.', 'body');
  if (body.length > REPLY_MAX) throw bad('invalid_body', `A reply holds ${REPLY_MAX} characters. This one has ${body.length}.`, 'body');
  const rid = newId('fbr');
  await db.transaction(async (tx) => {
    await tx.query(`INSERT INTO feedback_replies (id, feedback_id, author_id, body) VALUES ($1,$2,$3,$4)`, [rid, id, me.person.id, body]);
    await tell(tx, id, me.person.id, 'reply', { replyId: rid });
  });
  return { id: rid };
}

// Done, Not now (with a short reason, which shows on the note) or back to open. Anyone on the team may, and the note
// says who did it and when, so a wrong close is plain and anyone can reopen it.
export async function setFeedbackStatus(db: Db, me: Me, id: string, status: FeedbackStatus, reason?: string): Promise<{ status: FeedbackStatus }> {
  assertNotViewing(me);
  await noteOnTeam(db, me, id);
  const note = reason?.trim() ?? '';
  if (status === 'not_now' && note.length < 2) throw bad('invalid_body', 'Say in a line why not now.', 'reason');
  if (note.length > CLOSE_NOTE_MAX) throw bad('invalid_body', `A reason holds ${CLOSE_NOTE_MAX} characters. This one has ${note.length}.`, 'reason');
  await db.transaction(async (tx) => {
    const { rows } = await tx.query<{ status: FeedbackStatus }>(`SELECT status FROM feedback WHERE id = $1 FOR UPDATE`, [id]);
    if (rows[0].status === status && status !== 'not_now') return; // already so: no second notice
    if (status === 'open') await tx.query(`UPDATE feedback SET status = 'open', closed_by = NULL, closed_at = NULL, closed_note = NULL WHERE id = $1`, [id]);
    else await tx.query(`UPDATE feedback SET status = $2, closed_by = $3, closed_at = now(), closed_note = $4 WHERE id = $1`,
      [id, status, me.person.id, status === 'not_now' ? note : null]);
    await tell(tx, id, me.person.id, status === 'open' ? 'reopened' : status, status === 'not_now' ? { reason: note } : {});
  });
  return { status };
}

// What changed on notes I wrote or gave +1, not seen yet, newest first: the "Feedback updates" card on Home.
export type FeedbackNews = { id: string; kind: NewsKind; actorName: string; note: string; text: string | null; createdAt: string };
export async function feedbackNewsForMe(db: Db, me: Me): Promise<FeedbackNews[]> {
  const { rows } = await db.query<{ id: string; kind: NewsKind; actor_name: string; note: string; text: string | null; created_at: string }>(
    `SELECT n.id, n.kind, COALESCE(p.nickname, p.display_name) AS actor_name, f.body AS note, n.created_at,
            CASE n.kind WHEN 'reply' THEN r.body WHEN 'not_now' THEN n.reason END AS text
       FROM feedback_news n JOIN feedback f ON f.id = n.feedback_id JOIN people p ON p.id = n.actor_id
       LEFT JOIN feedback_replies r ON r.id = n.reply_id
      WHERE n.person_id = $1 AND n.seen_at IS NULL
      ORDER BY n.created_at DESC, n.id DESC LIMIT 20`, [me.person.id]);
  return rows.map((r) => ({ id: r.id, kind: r.kind, actorName: r.actor_name, note: r.note, text: r.text, createdAt: r.created_at }));
}

// Marks my feedback news seen: all of it, or the ones given. Nothing is written under View as.
export async function markFeedbackNewsSeen(db: Db, me: Me, ids?: string[]): Promise<{ ok: true }> {
  assertNotViewing(me);
  await db.query(`UPDATE feedback_news SET seen_at = now() WHERE person_id = $1 AND seen_at IS NULL ${ids ? 'AND id = ANY($2)' : ''}`,
    ids ? [me.person.id, ids] : [me.person.id]);
  return { ok: true };
}
