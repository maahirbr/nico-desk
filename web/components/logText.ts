import type { LogLine } from '@/lib/service';
import { fmtDate, fmtStamp } from '@/lib/time';
import { HEALTH } from './chips';

// Plain-words lines for the update log, shared by the task page and project pages.

const FIELD: Record<string, string> = {
  _created: 'Created', _update: 'Update', _reopened: 'Reopened', title: 'Title', description: 'Description', note: 'Note', project_id: 'Project', workstream: 'Sub-project',
  owner_id: 'Owner', health: 'Health', due_on: 'Due date', status: 'Status word', status_category: 'Status',
  closed_at: 'Closed', blocked_on_id: 'Blocked on', blocked_ask: 'Ask', priority: 'Priority', status_note: 'Status note',
};

function show(field: string, v: unknown, names: Record<string, string>, projects: Record<string, string>): string {
  if (v === null || v === undefined || v === '') return 'none';
  if (field === 'owner_id' || field === 'blocked_on_id') return names[String(v)] ?? String(v);
  if (field === 'project_id') return projects[String(v)] ?? String(v);
  if (field === 'health') return HEALTH[v as keyof typeof HEALTH]?.word ?? String(v);
  if (field === 'due_on' && typeof v === 'string') return fmtDate(v);
  if (field === 'closed_at' && typeof v === 'string') return fmtStamp(v);
  return String(v);
}

export function logLine(e: LogLine, names: Record<string, string>, projects: Record<string, string>) {
  if (e.field === '_created') {
    const a = e.after as Record<string, string>;
    return `Created for ${names[a.owner_id] ?? a.owner_id}, due ${a.due_on ? fmtDate(a.due_on) : '?'}`;
  }
  if (e.field === '_update') return String(e.after);
  if (e.field === '_reopened') return 'Reopened';
  return `${FIELD[e.field] ?? e.field}: ${show(e.field, e.before, names, projects)} → ${show(e.field, e.after, names, projects)}`;
}

