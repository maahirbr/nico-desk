import type { Tx } from './db';
import { addDays } from './time';

// v2 demo asks, seeded after the fixtures and kept apart from them. People come from the roster by
// role, never by name, so a changed fixture roster still works. Dates hang off `today`, so a fresh
// seed always has asks that can still be answered. Synthetic only: seed() skips this on a run that
// uses a local roster or local projects.

const j = (v: unknown) => (v === null || v === undefined ? null : JSON.stringify(v));

type Demo = {
  from: number; to: number; title: string; state: 'asked' | 'countered' | 'cant' | 'accepted';
  due: number; counter?: number; reason?: string; createdDaysAgo: number; answeredDaysAgo?: number;
};

// Index 0 is the team lead; 1 to 3 are the first other people on the roster.
const DEMO: Demo[] = [
  { from: 1, to: 0, title: 'Check the discount rules for the festive launch', state: 'asked', due: 2, createdDaysAgo: 1 },
  { from: 2, to: 0, title: 'Approve the shortlist of gift boxes', state: 'asked', due: 5, createdDaysAgo: 0 },
  { from: 0, to: 1, title: 'Send the final product shots for the landing page', state: 'asked', due: 3, createdDaysAgo: 1 },
  { from: 0, to: 2, title: 'Write the three email subject lines', state: 'countered', due: 3, counter: 6, reason: 'The brief is not signed off yet.', createdDaysAgo: 3, answeredDaysAgo: 1 },
  { from: 0, to: 3, title: 'Book the studio for the second shoot', state: 'cant', due: 4, reason: 'The studio is closed that week.', createdDaysAgo: 4, answeredDaysAgo: 2 },
  { from: 3, to: 1, title: 'Update the size guide before launch', state: 'accepted', due: 7, createdDaysAgo: 2, answeredDaysAgo: 1 },
];

export async function seedAsks(tx: Tx, teamId: string, today: string): Promise<void> {
  const { rows: lead } = await tx.query<{ person_id: string }>(
    `SELECT m.person_id FROM team_members m JOIN people p ON p.id = m.person_id
     WHERE m.team_id = $1 AND m.app_role = 'lead' AND p.active ORDER BY m.person_id LIMIT 1`, [teamId]);
  const { rows: rest } = await tx.query<{ id: string }>(
    `SELECT p.id FROM people p JOIN team_members m ON m.person_id = p.id AND m.team_id = $1 AND m.app_role = 'member'
     WHERE p.active AND p.id <> $2 ORDER BY p.id LIMIT 3`, [teamId, lead[0]?.person_id ?? '']);
  if (!lead[0] || rest.length < 3) return;
  const who = [lead[0].person_id, ...rest.map((r) => r.id)];

  for (const [n, d] of DEMO.entries()) {
    const id = `ask_demo_${n + 1}`;
    const from = who[d.from], to = who[d.to];
    const dueOn = addDays(today, d.due);
    const created = `${addDays(today, -d.createdDaysAgo)}T05:30:00Z`;
    const answered = d.answeredDaysAgo === undefined ? null : `${addDays(today, -d.answeredDaysAgo)}T08:00:00Z`;
    const agreed = d.state === 'accepted';
    await tx.query(
      `INSERT INTO tasks (id, team_id, title, owner_id, first_due_on, due_on, health, status, status_category, origin, created_by, created_at,
         ask_state, ask_due_on, ask_counter_on, ask_reason)
       VALUES ($1,$2,$3,$4,$5,$5,'not_started','open','open','app',$6,$7,$8,$5,$9,$10)`,
      [id, teamId, d.title, to, dueOn, from, created, d.state, d.counter === undefined ? null : addDays(today, d.counter), d.reason ?? null],
    );
    let k = 0;
    const ev = (actor: string, field: string, before: unknown, after: unknown, at: string, reason: string | null = null) =>
      tx.query(
        `INSERT INTO events (id, entity_type, entity_id, field, before, after, reason, actor_id, origin, at)
         VALUES ($1,'task',$2,$3,$4::jsonb,$5::jsonb,$6,$7,'app',$8)`,
        [`${id}_e${++k}`, id, field, j(before), j(after), reason, actor, at]);
    await ev(from, '_created', null, { title: d.title, owner_id: to, project_id: null, due_on: dueOn, ask_state: 'asked', ask_due_on: dueOn }, created);
    await ev(from, 'ask_state', null, 'asked', created);
    if (answered && d.state === 'countered') {
      await ev(to, 'ask_state', 'asked', 'countered', answered, d.reason ?? null);
      await ev(to, 'ask_counter_on', null, addDays(today, d.counter!), answered);
    }
    if (answered && d.state === 'cant') await ev(to, 'ask_state', 'asked', 'cant', answered, d.reason ?? null);
    if (answered && agreed) {
      await ev(to, 'ask_state', 'asked', 'accepted', answered);
      await ev(to, 'first_due_on', dueOn, dueOn, answered);
    }
  }
}
