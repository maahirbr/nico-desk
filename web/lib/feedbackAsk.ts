import type { Db } from './db';

// The feedback ask (15 Nov, the PM's call): a card on Home asking everyone for one thing to improve or one thing that is
// working well, on the way to v3. It ticks itself off: it shows until the person sends a feedback note (from the card or
// the Feedback button) on or after `since`, and stops after `until` whatever happens. In the app only: nothing is sent.
// Everyone sees how many have shared, for a little nudge and in the open (the PM's call); only an admin sees who has not.
// To ask again later, change the dates (and the words).
export const FEEDBACK_ASK = {
  since: '2026-11-15', // IST date the ask began
  until: '2026-11-30', // the last day it shows (the PM's call: to the end of November)
};

export type FeedbackAsk = { open: boolean; shared: number | null; of: number | null; notYet: string[] };

export async function feedbackAskFor(db: Db, personId: string, teamId: string, today: string, isAdmin: boolean): Promise<FeedbackAsk | null> {
  if (today < FEEDBACK_ASK.since || today > FEEDBACK_ASK.until) return null;
  const since = `${FEEDBACK_ASK.since}T00:00:00+05:30`;
  const { rows: [mine] } = await db.query(`SELECT 1 FROM feedback WHERE person_id = $1 AND created_at >= $2::timestamptz LIMIT 1`, [personId, since]);
  const { rows } = await db.query<{ name: string; shared: boolean }>(
    `SELECT COALESCE(p.nickname, p.display_name) AS name,
            EXISTS (SELECT 1 FROM feedback f WHERE f.person_id = p.id AND f.created_at >= $2::timestamptz) AS shared
       FROM people p WHERE p.active AND p.id IN (SELECT person_id FROM team_members WHERE team_id = $1) ORDER BY 1`, [teamId, since]);
  return { open: !mine, shared: rows.filter((r) => r.shared).length, of: rows.length, notYet: isAdmin ? rows.filter((r) => !r.shared).map((r) => r.name) : [] };
}
