import type { Db, Tx } from './db';
import { bad, forbidden } from './errors';
import { newId, teamTasks } from './service';
import type { Me } from './auth';
import { sightFor, taskFor } from './visibility';
import { seesTask } from './sight';
import { ANSWER_FIELDS } from './updates';

// "Ask for an update" (the PM's call, 3 Nov, from a pilot teammate's feedback). Anyone who can see an open task, other
// than its owner, asks its owner for an update, with an optional question. The owner sees it on Home and answers by
// adding an update or changing the task: its status, a block or the date. Any such change by someone other than the
// asker answers every open ask on the task, so the answer is read from the events table and no write path needs a hook.
// The asker reads the answer in "Updates for you" (lib/updates.ts). An ask still open after ASK_STALE_DAYS shows on
// Reminders. In-app only: nothing is emailed or sent.

export const ASK_STALE_DAYS = 2;

export type Ask = { id: string; taskId: string; askerId: string; question: string | null; askedAt: string; mine?: boolean };
type AskRow = { id: string; task_id: string; asker_id: string; question: string | null; asked_at: string | Date };
const toAsk = (r: AskRow): Ask => ({ id: r.id, taskId: r.task_id, askerId: r.asker_id, question: r.question, askedAt: new Date(r.asked_at).toISOString() });

// Open: nobody but the asker has answered since it was asked.
const OPEN = `NOT EXISTS (SELECT 1 FROM events e WHERE e.entity_type = 'task' AND e.entity_id = a.task_id AND e.at > a.asked_at
  AND e.actor_id IS DISTINCT FROM a.asker_id AND e.field = ANY('{${ANSWER_FIELDS.join(',')}}'::text[]))`;

export async function askForUpdate(db: Db, me: Me, taskId: string, question?: string | null): Promise<Ask> {
  const q = question?.trim() || null;
  if (q && q.length > 140) throw bad('invalid_body', 'A question is up to 140 characters.', 'question');
  return db.transaction(async (tx) => {
    const t = await taskFor(tx, me, taskId);
    if (t.readOnly) throw forbidden('This task comes from a Sheet. Ask there.');
    if (t.statusCategory !== 'open') throw bad('task_closed', 'This task is closed. There is nothing to ask.');
    if (!t.ownerId) throw bad('no_owner', 'Only a partner owns this task, so there is no one here to ask.');
    if (t.ownerId === me.person.id) throw bad('own_task', 'This is your own task.');
    const { rows: open } = await tx.query(`SELECT 1 FROM update_asks a WHERE a.task_id = $1 AND a.asker_id = $2 AND ${OPEN}`, [taskId, me.person.id]);
    if (open.length) throw bad('already_asked', 'You already asked. It is waiting on a reply.');
    const id = newId('ask');
    const { rows } = await tx.query<AskRow>(
      `INSERT INTO update_asks (id, task_id, asker_id, question, asked_at) VALUES ($1,$2,$3,$4,now()) RETURNING *`, [id, taskId, me.person.id, q]);
    return toAsk(rows[0]);
  });
}

// The open asks on one task, oldest first. The drawer shows them to the owner, and "Asked" to the asker.
export async function asksOnTask(db: Tx, me: Me, taskId: string): Promise<Ask[]> {
  await taskFor(db, me, taskId);
  const { rows } = await db.query<AskRow>(`SELECT a.* FROM update_asks a WHERE a.task_id = $1 AND ${OPEN} ORDER BY a.asked_at`, [taskId]);
  return rows.map((r) => ({ ...toAsk(r), mine: r.asker_id === me.person.id }));
}

// The open asks on my open tasks, for the Home card, newest first. An ask on a task I no longer see stays out.
export type AskForMe = Ask & { title: string };
export async function asksForMe(db: Tx, me: Me): Promise<AskForMe[]> {
  const { rows } = await db.query<AskRow & { title: string }>(
    `SELECT a.*, t.title FROM update_asks a JOIN tasks t ON t.id = a.task_id
      WHERE t.owner_id = $1 AND t.team_id = $2 AND t.status_category = 'open' AND a.asker_id <> $1 AND ${OPEN}
      ORDER BY a.asked_at DESC`, [me.person.id, me.team.id]);
  return rows.map((r) => ({ ...toAsk(r), title: r.title }));
}

// Reminders: open asks on open tasks the lead sees, asked ASK_STALE_DAYS or more days ago, oldest first.
export type StaleAsk = Ask & { title: string; ownerId: string; days: number };
export async function staleAsks(db: Tx, me: Me, projectId?: string, now = new Date()): Promise<StaleAsk[]> {
  const cut = new Date(now.getTime() - ASK_STALE_DAYS * 86_400_000).toISOString();
  const { rows } = await db.query<AskRow>(
    `SELECT a.* FROM update_asks a JOIN tasks t ON t.id = a.task_id
      WHERE t.team_id = $1 AND t.status_category = 'open' AND a.asked_at <= $2 AND ${OPEN} ORDER BY a.asked_at`, [me.team.id, cut]);
  if (!rows.length) return [];
  const sight = await sightFor(db, me);
  const tasks = new Map((await teamTasks(db, me.team.id)).map((t) => [t.id, t]));
  const out: StaleAsk[] = [];
  for (const r of rows) {
    const t = tasks.get(r.task_id);
    if (!t || !t.ownerId || !seesTask(sight, t) || (projectId && t.projectId !== projectId)) continue;
    const a = toAsk(r);
    out.push({ ...a, title: t.title, ownerId: t.ownerId, days: Math.floor((now.getTime() - Date.parse(a.askedAt)) / 86_400_000) });
  }
  return out;
}
