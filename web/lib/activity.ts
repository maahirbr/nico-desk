import type { Me } from './auth';
import type { Db } from './db';
import { addDays, today } from './time';

// The activity log (28 Oct): who on the team opens the app, changes things, comments and chats. Counts only, never
// what was written. Admins read it, and when NICO_ACTIVITY_EMAILS is set, only the admins listed there. A visit is one
// visit_days row per person per day, written on their first signed-in request of the day.

export function mayReadActivity(me: Me): boolean {
  if (!me.person.appRoles.includes('admin')) return false;
  const list = (process.env.NICO_ACTIVITY_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  return list.length === 0 || list.includes(me.person.email.toLowerCase());
}

// One insert per person per day per server instance. A failure (say, before db:upgrade adds the table) never stops a page.
const noted = new Set<string>();
export async function noteVisit(db: Db, personId: string): Promise<void> {
  const day = today();
  const key = `${personId}:${day}`;
  if (noted.has(key)) return;
  try {
    await db.query(`INSERT INTO visit_days (person_id, day) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [personId, day]);
    if (noted.size > 10000) noted.clear();
    noted.add(key);
  } catch { /* the log is a nice-to-have; the page is not */ }
}

export type Counts = { week: number; month: number };
export type ActivityRow = {
  id: string; name: string;
  days: Counts; lastVisit: string | null;
  changes: Counts; comments: Counts; chat: Counts;
  lastAction: string | null;
};
export type ActivityReport = { rows: ActivityRow[]; since: string | null };

// Active people of the team. "Week" is today and the 6 days before it, "month" today and the 29 before, by Kolkata day.
// Changes are task and project events made in the app or through Claude (not sheet or Granola imports), plus plan board actions. Run on a scoped db, so the fence keeps it to the team.
export async function teamActivity(db: Db, teamId: string): Promise<ActivityReport> {
  const week = addDays(today(), -6), month = addDays(today(), -29);
  const ist = (col: string) => `(${col} AT TIME ZONE 'Asia/Kolkata')::date`;
  const tally = (table: string, who: string, at: string, where = 'true') => `
    SELECT ${who} AS id, count(*) FILTER (WHERE ${ist(at)} >= $2) AS week, count(*) FILTER (WHERE ${ist(at)} >= $3) AS month, max(${at}) AS last
    FROM ${table} WHERE ${who} IS NOT NULL AND ${where} GROUP BY ${who}`;
  const { rows } = await db.query<{
    id: string; name: string; d7: number; d30: number; seen: string | null;
    x7: number; x30: number; c7: number; c30: number; m7: number; m30: number; last: string | null;
  }>(`
    WITH x AS (${tally("(SELECT actor_id, at FROM events WHERE origin IN ('app','claude') UNION ALL SELECT actor_id, at FROM plan_activity) a", 'actor_id', 'at')}),
         c AS (${tally('comments', 'author_id', 'created_at', 'deleted_at IS NULL')}),
         m AS (${tally('chat_messages', 'author_id', 'created_at', 'deleted_at IS NULL')}),
         v AS (SELECT person_id AS id, count(*) FILTER (WHERE day >= $2) AS week, count(*) FILTER (WHERE day >= $3) AS month, max(day)::text AS last
               FROM visit_days GROUP BY person_id)
    SELECT p.id, coalesce(p.nickname, p.display_name) AS name,
      coalesce(v.week, 0)::int AS d7, coalesce(v.month, 0)::int AS d30, v.last AS seen,
      coalesce(x.week, 0)::int AS x7, coalesce(x.month, 0)::int AS x30,
      coalesce(c.week, 0)::int AS c7, coalesce(c.month, 0)::int AS c30,
      coalesce(m.week, 0)::int AS m7, coalesce(m.month, 0)::int AS m30,
      greatest(x.last, c.last, m.last)::text AS last
    FROM people p
    LEFT JOIN v ON v.id = p.id LEFT JOIN x ON x.id = p.id LEFT JOIN c ON c.id = p.id LEFT JOIN m ON m.id = p.id
    WHERE p.active AND p.id IN (SELECT person_id FROM team_members WHERE team_id = $1)
    ORDER BY greatest(x.last, c.last, m.last, v.last::date::timestamp AT TIME ZONE 'Asia/Kolkata') DESC NULLS LAST, name`, [teamId, week, month]);
  const { rows: [first] } = await db.query<{ since: string | null }>(`SELECT min(day)::text AS since FROM visit_days`);
  return {
    since: first?.since ?? null,
    rows: rows.map((r) => ({
      id: r.id, name: r.name, lastVisit: r.seen, lastAction: r.last,
      days: { week: r.d7, month: r.d30 }, changes: { week: r.x7, month: r.x30 },
      comments: { week: r.c7, month: r.c30 }, chat: { week: r.m7, month: r.m30 },
    })),
  };
}
