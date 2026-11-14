import { fmtDate } from './time';

// The words of a reminder email. Shared by the server (the first draft) and the Reminders page, which rebuilds
// the subject and the text when a lead ticks an item in or out. No database here, so a client file can import it.

// key: stable across loads, logged with a reminder so the next draft knows what was already in one.
// flag: why the item may not be needed. A flagged item starts left out of the email; the lead can tick it back in.
export type RemindItem = {
  key: string; title: string; dueOn: string; days: number; where: string; kind: 'task' | 'line' | 'action'; flag: string | null;
};

// Leads with "Reminder" and names the state; short, since phone inboxes cut long subjects.
export function subjectFor(items: RemindItem[]): string {
  const over = items.filter((i) => i.days < 0).length;
  const soon = items.length - over;
  if (over && soon) return `Reminder: ${over} overdue, ${soon} coming up`;
  if (over) return `Reminder: ${over} overdue ${over === 1 ? 'item' : 'items'}`;
  return `Reminder: ${soon} ${soon === 1 ? 'item' : 'items'} coming up`;
}

// The email (15 Nov, the PM's pick: grouped by project). Each project is a heading, its items under it, the latest
// first; then one line on what to do, the link, and the sign-off. bodyFor gives the plain text (Gmail and mail-app
// drafts carry plain text only); bodyHtmlFor gives the same with the project headings in bold, for the Send button.
// signOff: the sender's name under "Best,": their nickname if they set one, else their first name.
type Group = { project: string; items: RemindItem[] };
function groups(items: RemindItem[]): Group[] {
  const by = new Map<string, RemindItem[]>();
  for (const i of [...items].sort((a, b) => a.days - b.days)) {
    const project = i.where.split(' · ')[0];
    by.set(project, [...(by.get(project) ?? []), i]);
  }
  return [...by.entries()].map(([project, list]) => ({ project, items: list }));
}
function when(i: RemindItem): string {
  if (i.days < 0) return `due ${fmtDate(i.dueOn)} (${-i.days} day${i.days === -1 ? '' : 's'} late)`;
  if (i.days === 0) return `due today, ${fmtDate(i.dueOn)}`;
  if (i.days === 1) return `due tomorrow, ${fmtDate(i.dueOn)}`;
  return `due ${fmtDate(i.dueOn)}`;
}
// A plan line keeps its line number beside its name ("line 2"), as the project heading carries the project.
const label = (i: RemindItem) => { const rest = i.where.split(' · ').slice(1).join(' · '); return rest ? `${i.title} (${rest})` : i.title; };
const ASK = 'Could you update these today? Mark them done, or push the date with a line on why:';
// The line after "Hi", so the email reads on into the list (15 Nov): what the list is, in a few friendly words.
function intro(items: RemindItem[]): string {
  const late = items.filter((i) => i.days < 0).length;
  const n = items.length;
  if (late === n) return n === 1 ? 'This task is past its date:' : `These ${n} tasks are past their date:`;
  if (late === 0) return n === 1 ? 'This task is coming up:' : `These ${n} tasks are coming up:`;
  return `These ${n} tasks need an update, ${late} past ${late === 1 ? 'its' : 'their'} date:`;
}

export function bodyFor(name: string, items: RemindItem[], appUrl: string, signOff?: string): string {
  const lines = [`Hi ${name.split(' ')[0]},`, '', intro(items), ''];
  for (const g of groups(items)) {
    lines.push(g.project);
    for (const i of g.items) lines.push(`• ${label(i)}, ${when(i)}`);
    lines.push('');
  }
  lines.push(`${ASK} ${appUrl}`);
  if (signOff?.trim()) lines.push('', 'Best,', signOff.trim());
  return lines.join('\n');
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export function bodyHtmlFor(name: string, items: RemindItem[], appUrl: string, signOff?: string): string {
  const out = [`Hi ${esc(name.split(' ')[0])},<br><br>${esc(intro(items))}<br><br>`];
  for (const g of groups(items)) {
    out.push(`<b>${esc(g.project)}</b><ul>${g.items.map((i) => `<li>${esc(label(i))}, <i>${esc(when(i))}</i></li>`).join('')}</ul>`);
  }
  out.push(`<br>${esc(ASK)} <a href="${esc(appUrl)}">${esc(appUrl)}</a>`);
  if (signOff?.trim()) out.push(`<br><br>Best,<br>${esc(signOff.trim())}`);
  return out.join('');
}
