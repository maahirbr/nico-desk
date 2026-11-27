import type { Tx } from './db';
import { ApiError, bad, forbidden } from './errors';
import { mayOversee } from './roles';
import { daysBetween, nextCheckpoint } from './planUtil';
import { planState, teamProjects } from './plan';
import { newId, teamTasks } from './service';
import { addDays, fmtDate, istDate, today as todayIst } from './time';
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
// onlyProjects (27 Nov): for a project's owner or lead who is not leadership, a lead or an admin, the projects they head.
export type RemindScope = { mode: 'overdue' | 'window'; days: number; projectId?: string; sight: Sight; onlyProjects?: Set<string> };

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

  // An archived project is out of reminders altogether (20 Nov, the PM's call): its tasks, lines and meeting actions.
  // One-off tasks (no project) are not reminded either (20 Nov, the PM's call): the giver asks for an update instead.
  const archived = new Set(projects.filter((p) => p.archivedAt).map((p) => p.id));
  const tasks = (await teamTasks(db, teamId, today)).filter((t) =>
    t.statusCategory === 'open' && !!t.projectId && !archived.has(t.projectId) && !t.readOnly && seesTask(scope.sight, t) && (!scope.projectId || t.projectId === scope.projectId)
    && (!scope.onlyProjects || scope.onlyProjects.has(t.projectId)) && wanted(t.dueOn));
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
  for (const p of projects.filter((x) => x.kind === 'plan' && !x.archivedAt && seesProject(scope.sight, x.id) && (!scope.projectId || x.id === scope.projectId)
    && (!scope.onlyProjects || scope.onlyProjects.has(x.id)))) {
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
  // The flag names the day of the latest such reminder: "Reminder sent on 9 Nov" (the PM's call, 11 Nov).
  const { rows: recent } = await db.query<{ person_id: string; item_keys: string[]; at: string | Date }>(
    `SELECT person_id, item_keys, at FROM reminders WHERE team_id = $1 AND at >= $2 AND item_keys IS NOT NULL ORDER BY at`, [teamId, since]);
  const sentOn = new Map(recent.flatMap((r) => r.item_keys.map((k) => [`${r.person_id}|${k}`, istDate(new Date(r.at).toISOString())] as const)));
  for (const [pid, items] of byPerson) for (const i of items) {
    const on = sentOn.get(`${pid}|${i.key}`);
    if (!i.flag && on) i.flag = `Reminder sent on ${fmtDate(on)}`;
  }

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

// Just before a reminder goes out (20 Nov): every task in it must still be open, on a project that is not archived. A task
// finished or dropped since the page was opened stops that email, so nobody is nudged about work already done.
export async function assertStillOpen(db: Tx, itemKeys: string[]): Promise<void> {
  const ids = itemKeys.filter((k) => k.startsWith('task:')).map((k) => k.slice(5));
  if (!ids.length) return;
  const { rows } = await db.query<{ title: string; status_category: string; archived: boolean }>(
    `SELECT t.title, t.status_category, (p.archived_at IS NOT NULL) AS archived FROM tasks t LEFT JOIN projects p ON p.id = t.project_id WHERE t.id = ANY($1)`, [ids]);
  const gone = rows.find((r) => r.status_category !== 'open' || r.archived);
  if (gone) throw new ApiError(409, 'reminder_stale', `“${gone.title}” is ${gone.archived ? 'on an archived project' : gone.status_category === 'done' ? 'done' : 'dropped'} now. Reload Reminders to update this draft.`);
}

export async function assertOnTeam(db: Tx, teamId: string, personId: string) {
  const { rows } = await db.query(`SELECT 1 FROM team_members WHERE team_id = $1 AND person_id = $2`, [teamId, personId]);
  if (!rows.length) throw bad('invalid_body', 'That person is not on this team.', 'personId');
}

export async function logReminder(db: Tx, teamId: string, meId: string,
  r: { personId: string; channel: 'gmail' | 'mail_app' | 'copy' | 'sent'; subject: string; itemCount: number; itemKeys?: string[] }) {
  await assertOnTeam(db, teamId, r.personId);
  await db.query(`INSERT INTO reminders (id, team_id, person_id, sent_by, channel, subject, item_count, item_keys, at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now())`,
    [newId('rem'), teamId, r.personId, meId, r.channel, r.subject.slice(0, 200), r.itemCount, r.itemKeys ?? null]);
}

export function mayRemind(appRoles: string[]): void {
  if (!mayOversee(appRoles)) throw forbidden('Only leadership or an admin can draft reminders.');
}

// Who may remind, and about which projects (27 Nov, the PM's call): leadership, a lead or an admin, as before; and the
// owner or lead of a project, whatever their access level, for the live projects they own or lead.
export type RemindAccess = { all: boolean; projects: Set<string> };
export async function remindAccess(db: Tx, teamId: string, personId: string, appRoles: string[]): Promise<RemindAccess> {
  if (mayOversee(appRoles)) return { all: true, projects: new Set() };
  if (appRoles.includes('partner')) return { all: false, projects: new Set() };
  const { rows } = await db.query<{ id: string }>(
    `SELECT id FROM projects WHERE team_id = $1 AND archived_at IS NULL AND personal_for IS NULL AND (owner_id = $2 OR lead_id = $2)`, [teamId, personId]);
  return { all: false, projects: new Set(rows.map((r) => r.id)) };
}
export const mayRemindAny = (a: RemindAccess) => a.all || a.projects.size > 0;
export function assertMayRemind(a: RemindAccess, projectId?: string): void {
  if (!mayRemindAny(a)) throw forbidden('Only leadership, an admin, or a project\'s owner or lead can send reminders.');
  if (projectId && !a.all && !a.projects.has(projectId)) throw forbidden('You can send reminders for the projects you own or lead.');
}
// Before a project owner's or lead's reminder goes out: every item in it is on a project they own or lead.
export async function assertItemsInProjects(db: Tx, itemKeys: string[], projects: Set<string>): Promise<void> {
  const ids = (p: string) => itemKeys.filter((k) => k.startsWith(p)).map((k) => k.slice(p.length).split(':')[0]);
  const [t, l, a] = [ids('task:'), ids('line:'), ids('action:')];
  const { rows } = await db.query<{ project_id: string | null }>(
    `SELECT project_id FROM tasks WHERE id = ANY($1) UNION ALL SELECT project_id FROM plan_lines WHERE id = ANY($2)
     UNION ALL SELECT project_id FROM plan_actions WHERE id = ANY($3)`, [t, l, a]);
  if (rows.length < t.length + l.length + a.length || rows.some((r) => !r.project_id || !projects.has(r.project_id)))
    throw forbidden('You can send reminders only about the projects you own or lead.');
}
