import type { Me } from './auth';
import type { Db } from './db';
import { ApiError, bad, forbidden, notFound } from './errors';
import { assertNotViewing } from './http';
import { newId, sniffImage } from './service';

// Pilot feedback from inside the app (13 Oct). Anyone signed in can send a note, and everyone on the team reads every
// note (14 Oct). Notes pile up: nothing marks them read or removes them. A note can carry up to three screenshots, and
// teammates can press "+1" on it. Only people with replies_feedback (set on the Roster) reply; everyone reads the replies,
// and the writer sees new ones on Home. Nothing is emailed.

export const FEEDBACK_MAX = 4000;
const PATH_MAX = 300;

export type FeedbackReply = { id: string; authorName: string; body: string; createdAt: string };
export type FeedbackView = { id: string; personId: string; personName: string; path: string | null; body: string; createdAt: string; images: number; votes: number; mine: boolean; replies: FeedbackReply[] };
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

type Row = { id: string; person_id: string; person_name: string; path: string | null; body: string; created_at: string; images: number; votes: number; mine: boolean };


// Everyone on the team reads every note, whatever their role (the PM's call, 14 Oct). Marking a note read stays with admins.
export async function listFeedback(db: Db, me: Me): Promise<FeedbackView[]> {
  const { rows } = await db.query<Row>(
    `SELECT f.id, f.person_id, p.display_name AS person_name, f.path, f.body, f.created_at,
            (SELECT count(*)::int FROM feedback_images i WHERE i.feedback_id = f.id) AS images,
            (SELECT count(*)::int FROM feedback_votes v WHERE v.feedback_id = f.id) AS votes,
            EXISTS (SELECT 1 FROM feedback_votes v WHERE v.feedback_id = f.id AND v.person_id = $2) AS mine
       FROM feedback f JOIN people p ON p.id = f.person_id
      WHERE f.person_id IN (SELECT person_id FROM team_members WHERE team_id = $1)
      ORDER BY f.created_at DESC, f.id DESC`,
    [me.team.id, me.person.id],
  );
  const replies = await db.query<{ id: string; feedback_id: string; author_name: string; body: string; created_at: string }>(
    `SELECT r.id, r.feedback_id, p.display_name AS author_name, r.body, r.created_at
       FROM feedback_replies r JOIN people p ON p.id = r.author_id JOIN feedback f ON f.id = r.feedback_id
      WHERE f.person_id IN (SELECT person_id FROM team_members WHERE team_id = $1)
      ORDER BY r.created_at, r.id`, [me.team.id]);
  const byNote = new Map<string, FeedbackReply[]>();
  for (const r of replies.rows) {
    const list = byNote.get(r.feedback_id) ?? [];
    list.push({ id: r.id, authorName: r.author_name, body: r.body, createdAt: r.created_at });
    byNote.set(r.feedback_id, list);
  }
  return rows.map((r) => ({ id: r.id, personId: r.person_id, personName: r.person_name, path: r.path, body: r.body, createdAt: r.created_at, images: r.images, votes: r.votes, mine: r.mine, replies: byNote.get(r.id) ?? [] }));
}


// A note on this team, or 404. Notes from other teams read as missing.
async function noteOnTeam(db: Db, me: Me, id: string): Promise<{ person_id: string }> {
  const { rows } = await db.query<{ person_id: string }>(
    `SELECT person_id FROM feedback WHERE id = $1 AND person_id IN (SELECT person_id FROM team_members WHERE team_id = $2)`, [id, me.team.id]);
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

// "+1": on or off, once per person, never on your own note.
export async function voteFeedback(db: Db, me: Me, id: string, on: boolean): Promise<{ votes: number; mine: boolean }> {
  assertNotViewing(me);
  const note = await noteOnTeam(db, me, id);
  if (note.person_id === me.person.id) throw bad('own_note', 'This is your own note.', 'vote');
  if (on) await db.query(`INSERT INTO feedback_votes (feedback_id, person_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [id, me.person.id]);
  else await db.query(`DELETE FROM feedback_votes WHERE feedback_id = $1 AND person_id = $2`, [id, me.person.id]);
  const { rows } = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM feedback_votes WHERE feedback_id = $1`, [id]);
  return { votes: rows[0].n, mine: on };
}

// A reply to a note, only from someone the Roster lets reply. A reply on your own note counts as seen at once.
export async function replyFeedback(db: Db, me: Me, id: string, text: string): Promise<{ id: string }> {
  assertNotViewing(me);
  if (!me.person.repliesFeedback) throw forbidden('Only the people building Nico Desk reply to feedback.');
  const note = await noteOnTeam(db, me, id);
  const body = text.trim();
  if (!body) throw bad('invalid_body', 'Write a reply first.', 'body');
  if (body.length > REPLY_MAX) throw bad('invalid_body', `A reply holds ${REPLY_MAX} characters. This one has ${body.length}.`, 'body');
  const rid = newId('fbr');
  await db.query(`INSERT INTO feedback_replies (id, feedback_id, author_id, body, seen_at) VALUES ($1,$2,$3,$4,$5)`,
    [rid, id, me.person.id, body, note.person_id === me.person.id ? new Date().toISOString() : null]);
  return { id: rid };
}

// Replies to my notes that I have not seen yet, newest first: the "Replies to your feedback" card on Home.
export type NewReply = { id: string; authorName: string; body: string; createdAt: string; note: string };
export async function newRepliesForMe(db: Db, me: Me): Promise<NewReply[]> {
  const { rows } = await db.query<{ id: string; author_name: string; body: string; created_at: string; note: string }>(
    `SELECT r.id, p.display_name AS author_name, r.body, r.created_at, f.body AS note
       FROM feedback_replies r JOIN feedback f ON f.id = r.feedback_id JOIN people p ON p.id = r.author_id
      WHERE f.person_id = $1 AND r.seen_at IS NULL AND r.author_id <> $1
      ORDER BY r.created_at DESC LIMIT 20`, [me.person.id]);
  return rows.map((r) => ({ id: r.id, authorName: r.author_name, body: r.body, createdAt: r.created_at, note: r.note }));
}

// Marks replies to my own notes seen: all of them, or the ones given. Nothing is written under View as.
export async function markRepliesSeen(db: Db, me: Me, ids?: string[]): Promise<{ ok: true }> {
  assertNotViewing(me);
  await db.query(
    `UPDATE feedback_replies r SET seen_at = now()
       FROM feedback f WHERE f.id = r.feedback_id AND f.person_id = $1 AND r.seen_at IS NULL ${ids ? 'AND r.id = ANY($2)' : ''}`,
    ids ? [me.person.id, ids] : [me.person.id]);
  return { ok: true };
}

