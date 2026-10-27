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
