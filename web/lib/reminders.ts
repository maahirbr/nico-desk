import type { Tx } from './db';
import { bad, forbidden } from './errors';
import { isLeadOrAdmin } from './roles';
import { daysBetween, nextCheckpoint } from './planUtil';
import { planState, teamProjects } from './plan';
import { newId, teamTasks } from './service';
import { addDays, today as todayIst } from './time';
import { doneByNote } from './jevUses';
import { seesProject, seesTask, type Sight } from './sight';
import { bodyFor, subjectFor, type RemindItem } from './reminderText';

export { bodyFor, subjectFor, type RemindItem };

// Reminder emails, drafted per person: what is past its date and what is coming up, across
// tasks, plan lines and actions from meetings. The app never sends anything. A lead opens the
// draft in their own Gmail or mail app, reads it and presses Send; the app records that.
//
// Still needed? Before an item goes in, code flags it when a reminder may not be needed (the repo owner's call, 19 Oct):
//   - it is blocked, waiting on someone else;
//   - its owner changed it or commented on it in the last RECENT_DAYS days;
//   - it was in a reminder to this person in the last RECENT_DAYS days.
// Then Jev, when it is on, reads the owner's latest note on each task still unflagged, for "done or no longer needed".
// A flagged item starts left out of the email, with its reason shown, and the lead can tick it back in.

export const RECENT_DAYS = 2; // today and the two days before it
type Env = Record<string, string | undefined>;
export type ReminderDraft = {
  personId: string; name: string; to: string | null; items: RemindItem[]; subject: string; body: string; lastAt: string | null;
};
// sight: the lead's own (lib/sight.ts), so a draft never names a task or plan line the lead cannot see.
export type RemindScope = { mode: 'overdue' | 'window'; days: number; projectId?: string; sight: Sight };

export async function reminderDrafts(db: Tx, teamId: string, scope: RemindScope, appUrl: string, today = todayIst(), env?: Env): Promise<{ drafts: ReminderDraft[]; skipped: string[] }> {
  const { rows: people } = await db.query<{ id: string; display_name: string; nickname: string | null; email: string; contact_email: string | null; never_remind: boolean }>(
    `SELECT p.* FROM people p WHERE p.active AND p.id IN (SELECT person_id FROM team_members WHERE team_id = $1) ORDER BY p.display_name`, [teamId]);
  const projects = await teamProjects(db, teamId);
  const pname = Object.fromEntries(projects.map((p) => [p.id, p.name]));
  const wanted = (d: string) => {
    const n = daysBetween(today, d);
    return n < 0 || (scope.mode === 'window' && n <= scope.days);
  };
  const byPerson = new Map<string, RemindItem[]>();
  const add = (pid: string, it: RemindItem) => byPerson.set(pid, [...(byPerson.get(pid) ?? []), it]);
  const pnames = Object.fromEntries(people.map((p) => [p.id, p.nickname ?? p.display_name]));
  const since = `${addDays(today, -RECENT_DAYS)}T00:00:00+05:30`; // days are judged in IST

  const tasks = (await teamTasks(db, teamId, today)).filter((t) =>
    t.statusCategory === 'open' && !t.readOnly && seesTask(scope.sight, t) && (!scope.projectId || t.projectId === scope.projectId) && wanted(t.dueOn));
  const touched = await ownerTouched(db, tasks.map((t) => t.id), since);
  for (const t of tasks) {
    const flag = t.blocked?.onId && t.blocked.onId !== t.ownerId ? `Blocked, waiting on ${pnames[t.blocked.onId]?.split(' ')[0] ?? 'someone else'}`
      : touched.has(`${t.id}|${t.ownerId}`) ? 'They updated it in the last 2 days'
      : null;
    add(t.ownerId, { key: `task:${t.id}`, title: t.title, dueOn: t.dueOn, days: daysBetween(today, t.dueOn), kind: 'task', flag,
      where: [t.projectId ? pname[t.projectId] : '', t.workstream ?? ''].filter(Boolean).join(' · ') || 'Tasks' });
  }
  // Roster names win; a nickname only fills a key that no roster name holds.
  const byName = new Map(people.filter((p) => p.nickname).map((p) => [p.nickname!.toLowerCase(), p.id] as const));
  for (const p of people) byName.set(p.display_name.toLowerCase(), p.id);
  for (const p of projects.filter((x) => x.kind === 'plan' && seesProject(scope.sight, x.id) && (!scope.projectId || x.id === scope.projectId))) {
    const s = await planState(db, p.id);
    for (const l of s.lines) {
      if (!l.ownerId || l.status === 'Done') continue;
      const n = nextCheckpoint(l);
      if (!n || !wanted(n.date)) continue;
      add(l.ownerId, { key: `line:${l.id}:${n.date}`, title: n.label ? `${l.what}: ${n.label}` : l.what, dueOn: n.date, days: daysBetween(today, n.date), kind: 'line',
        where: `${p.name} · line ${l.num}`, flag: null });
    }
    for (const a of s.actions) {
      if (a.done || !a.dueOn || !wanted(a.dueOn)) continue;
      const pid = byName.get(a.ownerName.toLowerCase());
      if (pid) add(pid, { key: `action:${a.id}`, title: a.task, dueOn: a.dueOn, days: daysBetween(today, a.dueOn), kind: 'action',
        where: `${p.name} · action from ${a.source.title ?? 'a meeting'}`, flag: null });
    }
  }

  const { rows: last } = await db.query<{ person_id: string; at: string }>(
    `SELECT person_id, max(at) AS at FROM reminders WHERE team_id = $1 GROUP BY person_id`, [teamId]);
  const lastAt = new Map(last.map((r) => [r.person_id, r.at]));
  // Item keys from recent reminders. A row logged before keys were kept has none, so it flags nothing.
  const { rows: recent } = await db.query<{ person_id: string; item_keys: string[] }>(
    `SELECT person_id, item_keys FROM reminders WHERE team_id = $1 AND at >= $2 AND item_keys IS NOT NULL`, [teamId, since]);
  const sentRecently = new Set(recent.flatMap((r) => r.item_keys.map((k) => `${r.person_id}|${k}`)));
  for (const [pid, items] of byPerson) for (const i of items) if (!i.flag && sentRecently.has(`${pid}|${i.key}`)) i.flag = 'Already in a reminder in the last 2 days';

  // Jev reads words only, on the tasks no rule flagged. Off, slow or unsure leaves them in.
  const ask = tasks.filter((t) => byPerson.get(t.ownerId)?.find((i) => i.key === `task:${t.id}`)?.flag === null);
  for (const id of await doneByNote(db, teamId, ask, today, env)) {
    const t = tasks.find((x) => x.id === id)!;
    const it = byPerson.get(t.ownerId)!.find((i) => i.key === `task:${id}`)!;
    it.flag = 'Their latest note reads as done or not needed';
  }
  const drafts: ReminderDraft[] = [];
  const skipped: string[] = [];
  for (const p of people) {
    const items = (byPerson.get(p.id) ?? []).sort((a, b) => a.dueOn.localeCompare(b.dueOn));
    if (!items.length) continue;
    if (p.never_remind) { skipped.push(pnames[p.id]); continue; }
    drafts.push({
      personId: p.id, name: pnames[p.id], to: p.contact_email ?? (p.email.endsWith('@example.test') ? null : p.email), items,
      subject: subjectFor(items.filter((i) => !i.flag)), body: bodyFor(pnames[p.id], items.filter((i) => !i.flag), appUrl), lastAt: lastAt.get(p.id) ?? null,
    });
  }
  return { drafts, skipped };
}

// "task|person" for each task its owner changed or commented on since the cut-off. Creating a task is not an update.
async function ownerTouched(db: Tx, taskIds: string[], since: string): Promise<Set<string>> {
  if (!taskIds.length) return new Set();
  const { rows } = await db.query<{ id: string; by: string }>(
    `SELECT entity_id AS id, actor_id AS by FROM events
      WHERE entity_type = 'task' AND entity_id = ANY($1) AND field <> '_created' AND actor_id IS NOT NULL AND at >= $2
     UNION
     SELECT subject_id, author_id FROM comments
      WHERE subject_kind = 'task' AND subject_id = ANY($1) AND deleted_at IS NULL AND created_at >= $2`, [taskIds, since]);
  return new Set(rows.map((r) => `${r.id}|${r.by}`));
}

export async function logReminder(db: Tx, teamId: string, meId: string,
  r: { personId: string; channel: 'gmail' | 'mail_app' | 'copy'; subject: string; itemCount: number; itemKeys?: string[] }) {
  const { rows } = await db.query(`SELECT 1 FROM team_members WHERE team_id = $1 AND person_id = $2`, [teamId, r.personId]);
  if (!rows.length) throw bad('invalid_body', 'That person is not on this team.', 'personId');
  await db.query(`INSERT INTO reminders (id, team_id, person_id, sent_by, channel, subject, item_count, item_keys, at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now())`,
    [newId('rem'), teamId, r.personId, meId, r.channel, r.subject.slice(0, 200), r.itemCount, r.itemKeys ?? null]);
}

export function mayRemind(appRoles: string[]): void {
  if (!isLeadOrAdmin(appRoles)) throw forbidden('Only a lead can draft reminders.');
}
