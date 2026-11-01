import type { Me } from './auth';
import type { Db } from './db';
import { addDays, today } from './time';

// The activity page (28 Oct, reworked 30 Oct): who on the team uses the app during the pilot. Counts and dates only,
// never what was written. Admins read it, and when NICO_ACTIVITY_EMAILS is set, only the admins listed there. A visit is one
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

// ---------- adoption (30 Oct) ----------
// Each active person gets one status: Daily (opened the app on all 5 weekdays, Monday to Friday, of the 7 days before
// today; today is left out so no one drops out each morning, and weekends never count against anyone), Some days
// (opened at least once in the last 7 days, today included), Gone quiet (signed in before, not in the last 7 days) or
// Never signed in. Visit days are kept only since 28 Oct, so
// "ever signed in" also takes every older trace a signed-in person leaves: the Google photo saved at each Google
// sign-in, a change made in the app or through Claude (from LIVE_SINCE on), feedback, a +1 or reply, a comment or chat line, updates marked
// seen, or a nickname, phone or photo they set. Someone who signed in before 28 Oct and left none of these reads as Never.

export type AdoptionStatus = 'daily' | 'some' | 'quiet' | 'never';
export type AdoptionRow = {
  id: string; name: string; email: string; status: AdoptionStatus;
  lastActive: string | null; // the latest trace, an instant
  days: string[]; // the visit days in the last 14, 'YYYY-MM-DD'
  opened7: number; weekdays: number; changes7: number; // weekdays: Mon to Fri opened in the 7 days before today
};
// The live site moved to the real pilot on 11 Oct (DECISIONS). Older changes are tasks loaded from the old tracker under
// their first owner's name, not sign-ins, so a trace other than a visit counts only from this day (India time). Visits
// are kept only since 28 Oct, so they are always after it.
export const LIVE_SINCE = '2026-10-11';

export function statusOf(weekdays: number, opened7: number, ever: boolean): AdoptionStatus {
  return weekdays >= 5 ? 'daily' : opened7 > 0 ? 'some' : ever ? 'quiet' : 'never';
}

const RANK: Record<AdoptionStatus, number> = { daily: 0, some: 1, quiet: 2, never: 3 };

export async function teamAdoption(db: Db, teamId: string): Promise<AdoptionRow[]> {
  const t = today(), week = addDays(t, -6), fortnight = addDays(t, -13), lastWeek = addDays(t, -7), yesterday = addDays(t, -1);
  const { rows } = await db.query<{ id: string; name: string; email: string; flag: boolean; last: string | null; days: string[] | null; o7: number; wd: number; x7: number }>(`
    WITH tr AS (
      SELECT person_id AS id, (day::timestamp AT TIME ZONE 'Asia/Kolkata') AS at, true AS visit FROM visit_days
      UNION ALL SELECT actor_id, at, false FROM events WHERE origin IN ('app','claude') AND actor_id IS NOT NULL
      UNION ALL SELECT actor_id, at, false FROM plan_activity WHERE actor_id IS NOT NULL
      UNION ALL SELECT person_id, created_at, false FROM feedback
      UNION ALL SELECT person_id, created_at, false FROM feedback_votes
      UNION ALL SELECT author_id, created_at, false FROM feedback_replies
      UNION ALL SELECT author_id, created_at, false FROM comments
      UNION ALL SELECT author_id, created_at, false FROM chat_messages
      UNION ALL SELECT person_id, seen_at, false FROM update_seen
      UNION ALL SELECT person_id, updated_at, false FROM person_photos
    ),
    last AS (SELECT id, max(at) AS at FROM tr WHERE visit OR (at AT TIME ZONE 'Asia/Kolkata')::date >= $4 GROUP BY id),
    v AS (SELECT person_id AS id, array_agg(day::text ORDER BY day) FILTER (WHERE day >= $3) AS days,
                 count(*) FILTER (WHERE day >= $2)::int AS o7,
                 count(*) FILTER (WHERE day BETWEEN $5 AND $6 AND extract(isodow FROM day) <= 5)::int AS wd
            FROM visit_days GROUP BY person_id),
    x AS (SELECT a.actor_id AS id, count(*)::int AS x7 FROM (
            SELECT actor_id, at FROM events WHERE origin IN ('app','claude') UNION ALL SELECT actor_id, at FROM plan_activity) a
          WHERE a.actor_id IS NOT NULL AND (a.at AT TIME ZONE 'Asia/Kolkata')::date >= $2 GROUP BY a.actor_id)
    SELECT p.id, coalesce(p.nickname, p.display_name) AS name, p.email,
           (p.photo_url IS NOT NULL OR p.nickname IS NOT NULL OR p.phone IS NOT NULL) AS flag,
           last.at::text AS last, v.days, coalesce(v.o7, 0) AS o7, coalesce(v.wd, 0) AS wd, coalesce(x.x7, 0) AS x7
      FROM people p LEFT JOIN last ON last.id = p.id LEFT JOIN v ON v.id = p.id LEFT JOIN x ON x.id = p.id
     WHERE p.active AND p.id IN (SELECT person_id FROM team_members WHERE team_id = $1)`, [teamId, week, fortnight, LIVE_SINCE, lastWeek, yesterday]);
  return rows
    .map((r) => ({
      id: r.id, name: r.name, email: r.email, lastActive: r.last, days: r.days ?? [], opened7: r.o7, weekdays: r.wd, changes7: r.x7,
      status: statusOf(r.wd, r.o7, r.flag || r.last !== null),
    }))
    .sort((a, b) => RANK[a.status] - RANK[b.status] || (b.lastActive ?? '').localeCompare(a.lastActive ?? '') || a.name.localeCompare(b.name));
}
