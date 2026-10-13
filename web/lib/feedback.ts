import type { Me } from './auth';
import type { Db } from './db';
import { bad, forbidden, notFound } from './errors';
import { assertNotViewing } from './http';
import { newId } from './service';

// Pilot feedback from inside the app (13 Oct). Anyone signed in can send a note. Only an admin reads the list.
// Nothing is emailed. The note stays in the database until an admin marks it read.

export const FEEDBACK_MAX = 4000;
const PATH_MAX = 300;

export type FeedbackView = { id: string; personId: string; personName: string; path: string | null; body: string; createdAt: string; readAt: string | null };

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

type Row = { id: string; person_id: string; person_name: string; path: string | null; body: string; created_at: string; read_at: string | null };

function mustBeAdmin(me: Me) {
  // Judged on the person being shown, so an admin who is viewing as a member sees what that member would: a refusal.
  if (!me.person.appRoles.includes('admin')) throw forbidden('Only an admin can read feedback.');
}

export async function listFeedback(db: Db, me: Me): Promise<FeedbackView[]> {
  mustBeAdmin(me);
  const { rows } = await db.query<Row>(
    `SELECT f.id, f.person_id, p.display_name AS person_name, f.path, f.body, f.created_at, f.read_at
       FROM feedback f JOIN people p ON p.id = f.person_id
      WHERE f.person_id IN (SELECT person_id FROM team_members WHERE team_id = $1)
      ORDER BY f.created_at DESC, f.id DESC`,
    [me.team.id],
  );
  return rows.map((r) => ({ id: r.id, personId: r.person_id, personName: r.person_name, path: r.path, body: r.body, createdAt: r.created_at, readAt: r.read_at }));
}

export async function markFeedbackRead(db: Db, me: Me, id: string): Promise<{ id: string; readAt: string }> {
  assertNotViewing(me);
  mustBeAdmin(me);
  const { rows } = await db.query<{ read_at: string }>(
    `UPDATE feedback SET read_at = COALESCE(read_at, now())
      WHERE id = $1 AND person_id IN (SELECT person_id FROM team_members WHERE team_id = $2)
      RETURNING read_at`,
    [id, me.team.id],
  );
  if (!rows[0]) throw notFound('No such note.');
  return { id, readAt: rows[0].read_at };
}
