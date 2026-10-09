import type { Tx } from './db';
import { bad, forbidden } from './errors';
import { daysBetween, nextCheckpoint } from './planUtil';
import { planState, teamProjects } from './plan';
import { newId, teamTasks } from './service';
import { fmtDate, today as todayIst } from './time';

// Reminder emails, drafted per person: what is past its date and what is coming up, across
// tasks, plan lines and actions from meetings. The app never sends anything. A lead opens the
// draft in their own Gmail or mail app, reads it and presses Send; the app records that.

export type RemindItem = { title: string; dueOn: string; days: number; where: string; kind: 'task' | 'line' | 'action' };
export type ReminderDraft = {
  personId: string; name: string; to: string | null; items: RemindItem[]; subject: string; body: string; lastAt: string | null;
};
export type RemindScope = { mode: 'overdue' | 'window'; days: number; projectId?: string };

export async function reminderDrafts(db: Tx, teamId: string, scope: RemindScope, appUrl: string, today = todayIst()): Promise<{ drafts: ReminderDraft[]; skipped: string[] }> {
  const { rows: people } = await db.query<{ id: string; display_name: string; email: string; contact_email: string | null; never_remind: boolean }>(
    `SELECT p.* FROM people p WHERE p.active AND p.id IN (SELECT person_id FROM team_members WHERE team_id = $1) ORDER BY p.display_name`, [teamId]);
  const projects = await teamProjects(db, teamId);
  const pname = Object.fromEntries(projects.map((p) => [p.id, p.name]));
  const wanted = (d: string) => {
    const n = daysBetween(today, d);
    return n < 0 || (scope.mode === 'window' && n <= scope.days);
  };
  const byPerson = new Map<string, RemindItem[]>();
  const add = (pid: string, it: RemindItem) => byPerson.set(pid, [...(byPerson.get(pid) ?? []), it]);

  for (const t of await teamTasks(db, teamId, today)) {
    if (t.statusCategory !== 'open' || t.readOnly) continue;
    if (scope.projectId && t.projectId !== scope.projectId) continue;
    if (!wanted(t.dueOn)) continue;
    add(t.ownerId, { title: t.title, dueOn: t.dueOn, days: daysBetween(today, t.dueOn), kind: 'task',
      where: [t.projectId ? pname[t.projectId] : '', t.workstream ?? ''].filter(Boolean).join(' · ') || 'Tasks' });
  }
  const byName = new Map(people.map((p) => [p.display_name.toLowerCase(), p.id]));
  for (const p of projects.filter((x) => x.kind === 'plan' && (!scope.projectId || x.id === scope.projectId))) {
    const s = await planState(db, p.id);
    for (const l of s.lines) {
      if (!l.ownerId || l.status === 'Done') continue;
      const n = nextCheckpoint(l);
      if (!n || !wanted(n.date)) continue;
      add(l.ownerId, { title: n.label ? `${l.what}: ${n.label}` : l.what, dueOn: n.date, days: daysBetween(today, n.date), kind: 'line', where: `${p.name} · line ${l.num}` });
    }
    for (const a of s.actions) {
      if (a.done || !a.dueOn || !wanted(a.dueOn)) continue;
      const pid = byName.get(a.ownerName.toLowerCase());
      if (pid) add(pid, { title: a.task, dueOn: a.dueOn, days: daysBetween(today, a.dueOn), kind: 'action', where: `${p.name} · action from ${a.source.title ?? 'a meeting'}` });
    }
  }

  const { rows: last } = await db.query<{ person_id: string; at: string }>(
    `SELECT person_id, max(at) AS at FROM reminders WHERE team_id = $1 GROUP BY person_id`, [teamId]);
  const lastAt = new Map(last.map((r) => [r.person_id, r.at]));
  const drafts: ReminderDraft[] = [];
  const skipped: string[] = [];
  for (const p of people) {
    const items = (byPerson.get(p.id) ?? []).sort((a, b) => a.dueOn.localeCompare(b.dueOn));
    if (!items.length) continue;
    if (p.never_remind) { skipped.push(p.display_name); continue; }
    drafts.push({
      personId: p.id, name: p.display_name, to: p.contact_email ?? (p.email.endsWith('@example.test') ? null : p.email), items,
      subject: subjectFor(items), body: bodyFor(p.display_name, items, appUrl), lastAt: lastAt.get(p.id) ?? null,
    });
  }
  return { drafts, skipped };
}

// Leads with "Reminder" and names the state; short, since phone inboxes cut long subjects.
export function subjectFor(items: RemindItem[]): string {
  const over = items.filter((i) => i.days < 0).length;
  const soon = items.length - over;
  if (over && soon) return `Reminder: ${over} overdue, ${soon} coming up`;
  if (over) return `Reminder: ${over} overdue ${over === 1 ? 'item' : 'items'}`;
  return `Reminder: ${soon} ${soon === 1 ? 'item' : 'items'} coming up`;
}

export function bodyFor(name: string, items: RemindItem[], appUrl: string): string {
  const over = items.filter((i) => i.days < 0);
  const soon = items.filter((i) => i.days >= 0);
  const lines = [`Hi ${name.split(' ')[0]},`, ''];
  if (over.length) {
    lines.push('These are past their date:');
    for (const i of over) lines.push(`• ${i.title} (${i.where}): was due ${fmtDate(i.dueOn)}, ${-i.days} day${i.days === -1 ? '' : 's'} ago`);
    lines.push('');
  }
  if (soon.length) {
    lines.push(over.length ? 'And these are coming up:' : 'These are coming up:');
    for (const i of soon) lines.push(`• ${i.title} (${i.where}): due ${fmtDate(i.dueOn)}${i.days === 0 ? ' (today)' : i.days === 1 ? ' (tomorrow)' : ''}`);
    lines.push('');
  }
  lines.push('Could you update these today: close them, or give a new date you can hold, with a line on why.');
  lines.push('', `Update them here: ${appUrl}`);
  return lines.join('\n');
}

export async function logReminder(db: Tx, teamId: string, meId: string, r: { personId: string; channel: 'gmail' | 'mail_app' | 'copy'; subject: string; itemCount: number }) {
  const { rows } = await db.query(`SELECT 1 FROM team_members WHERE team_id = $1 AND person_id = $2`, [teamId, r.personId]);
  if (!rows.length) throw bad('invalid_body', 'That person is not on this team.', 'personId');
  await db.query(`INSERT INTO reminders (id, team_id, person_id, sent_by, channel, subject, item_count, at) VALUES ($1,$2,$3,$4,$5,$6,$7,now())`,
    [newId('rem'), teamId, r.personId, meId, r.channel, r.subject.slice(0, 200), r.itemCount]);
}

export function mayRemind(appRoles: string[]): void {
  if (!appRoles.includes('lead') && !appRoles.includes('admin')) throw forbidden('Only a lead can draft reminders.');
}
