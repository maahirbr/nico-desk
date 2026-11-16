import type { Me } from './auth';
import type { Db } from './db';
import type { Task } from './derive';
import { bad } from './errors';
import { assertNotViewing } from './http';
import { getTask } from './service';
import { seesTask, sightOf } from './sight';
import { today as todayIst } from './time';

// Today's 3 (16 Nov): on my Personal page, up to three of my own tasks, from any project, that I pick to focus on
// today. Kept in personal_focus, one row per person, so only I read or write them, and an admin viewing as me sees none. Picking
// changes nothing on the task itself: ticking or editing a pick goes through the task's usual rules. A pick shows only
// while the task is still mine, still visible to me and not dropped; a done pick stays, ticked, for the rest of the day.
// The next day starts empty, and my unfinished picks from the last day I picked can be brought back with one press.

export const FOCUS_MAX = 3;
export type Focus = { picks: Task[]; carry: string[] };

async function stillMine(db: Db, me: Me, ids: string[], day: string): Promise<Task[]> {
  const sight = await sightOf(db, me.team.id, me.person.id);
  const out: Task[] = [];
  for (const id of ids) {
    const t = await getTask(db, id, day).catch(() => null);
    if (t && t.teamId === me.team.id && t.ownerId === me.person.id && t.statusCategory !== 'dropped' && seesTask(sight, t)) out.push(t);
  }
  return out;
}

async function stored(db: Db, me: Me): Promise<{ day: string | null; ids: string[] }> {
  // As text: a date read as a JS Date lands on the day before in a timezone east of UTC.
  const { rows } = await db.query<{ focus_day: string | null; focus_ids: string[] }>(
    `SELECT day::text AS focus_day, task_ids AS focus_ids FROM personal_focus WHERE person_id = $1`, [me.person.id]);
  const r = rows[0];
  return r ? { day: r.focus_day, ids: r.focus_ids } : { day: null, ids: [] };
}

export async function myFocus(db: Db, me: Me): Promise<Focus | null> {
  if (me.viewingAs) return null;
  const t = todayIst();
  const s = await stored(db, me);
  if (s.day === t) return { picks: await stillMine(db, me, s.ids, t), carry: [] };
  const left = (await stillMine(db, me, s.ids, t)).filter((x) => x.statusCategory === 'open');
  return { picks: [], carry: left.map((x) => x.id) };
}

// Saves today's whole list. A task can be picked while it is open; one already in today's list stays even once done.
export async function setFocus(db: Db, me: Me, ids: string[]): Promise<Focus> {
  assertNotViewing(me);
  const want = [...new Set(ids)];
  if (want.length > FOCUS_MAX) throw bad('invalid_body', `Pick up to ${FOCUS_MAX} tasks for today.`, 'ids');
  const t = todayIst();
  const s = await stored(db, me);
  const kept = s.day === t ? new Set(s.ids) : new Set<string>();
  const ok = await stillMine(db, me, want, t);
  if (ok.length !== want.length || ok.some((x) => x.statusCategory !== 'open' && !kept.has(x.id))) {
    throw bad('invalid_body', 'Only your own open tasks can be picked.', 'ids');
  }
  await db.query(
    `INSERT INTO personal_focus (person_id, team_id, day, task_ids) VALUES ($1, $2, $3, $4)
     ON CONFLICT (person_id) DO UPDATE SET team_id = EXCLUDED.team_id, day = EXCLUDED.day, task_ids = EXCLUDED.task_ids`,
    [me.person.id, me.team.id, t, want]);
  return (await myFocus(db, me))!;
}
