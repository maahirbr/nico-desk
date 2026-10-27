import { linkText } from '@/lib/links';
import type { LogLine } from '@/lib/service';
import { fmtDate, fmtStamp } from '@/lib/time';
import { HEALTH } from './chips';

// Plain-words lines for the update log, shared by the task page, the drawer and project pages.
// One action in the app writes several events with the same actor and timestamp (a close writes
// the status word, the category and the closed time). groupLog folds them into one sentence.

const FIELD: Record<string, string> = {
  _created: 'Created', _archived: 'Archived', _restored: 'Restored', _update: 'Update', _reopened: 'Reopened', title: 'Title', description: 'Description', note: 'Note', project_id: 'Project', workstream: 'Sub-project',
  owner_id: 'Owner', lead_id: 'Lead', health: 'Health', due_on: 'Due date', status: 'Status word', status_category: 'Status',
  closed_at: 'Closed', blocked_on_id: 'Blocked on', blocked_ask: 'Ask', priority: 'Priority', status_note: 'Status note',
};

type Names = Record<string, string>;

function show(field: string, v: unknown, names: Names, projects: Names): string {
  if (v === null || v === undefined || v === '') return 'none';
  if (field === 'owner_id' || field === 'lead_id' || field === 'blocked_on_id') return names[String(v)] ?? String(v);
  if (field === 'project_id') return projects[String(v)] ?? String(v);
  if (field === 'health') return HEALTH[v as keyof typeof HEALTH]?.word ?? String(v);
  if (field === 'due_on' && typeof v === 'string') return fmtDate(v);
  if (field === 'closed_at' && typeof v === 'string') return fmtStamp(v);
  return String(v);
}

// The word-for-word line for a single event. Used for events that stand alone.
export function logLine(e: LogLine, names: Names, projects: Names) {
  if (e.field === '_created') {
    const a = e.after as Record<string, string>;
    return `Created for ${names[a.owner_id] ?? a.owner_id}, due ${a.due_on ? fmtDate(a.due_on) : '?'}`;
  }
  if (e.field === '_update') return String(e.after);
  if (e.field === '_archived') return 'Archived the project';
  if (e.field === '_restored') return 'Restored the project';
  if (e.field === '_reopened') return 'Reopened';
  if (e.field === '_link_added') return `Added link ${linkName(e.after)}`;
  if (e.field === '_link_removed') return `Removed link ${linkName(e.before)}`;
  return `${FIELD[e.field] ?? e.field}: ${show(e.field, e.before, names, projects)} → ${show(e.field, e.after, names, projects)}`;
}

// A link event carries the url and label as written then, so the line still reads right after the link is gone.
const linkName = (v: unknown) => `“${linkText(v as { url: string; label: string | null })}”`;
const withWhy = (head: string, why: string | null | undefined) => (why ? `${head}: ${why}` : head);
const set = (v: unknown) => v !== null && v !== undefined && v !== '';

// One sentence (or a few, for an edit that changed several fields) for the events of one action.
export function actionText(events: LogLine[], names: Names, projects: Names): string {
  const by = new Map<string, LogLine>();
  for (const e of events) by.set(e.field, e);
  const out: string[] = [];
  const used = new Set<string>();
  const take = (f: string) => { used.add(f); return by.get(f); };

  const created = take('_created');
  if (created) return logLine(created, names, projects);
  const arch = take('_archived') ?? take('_restored');
  if (arch) return logLine(arch, names, projects);
  const upd = take('_update');
  if (upd) return logLine(upd, names, projects);
  const added = take('_link_added');
  if (added) return logLine(added, names, projects);
  const removed = take('_link_removed');
  if (removed) return logLine(removed, names, projects);

  // Status changes: the category says what happened; the status word and closed time repeat it.
  const reopened = take('_reopened');
  const cat = take('status_category');
  if (reopened || (cat && cat.after === 'open')) {
    out.push(withWhy('Reopened', reopened?.reason ?? cat?.reason));
    used.add('status'); used.add('closed_at'); used.add('status_category');
  } else if (cat && cat.after === 'done') {
    out.push(withWhy('Marked done', cat.reason));
    used.add('status'); used.add('closed_at');
  } else if (cat && cat.after === 'dropped') {
    out.push(withWhy('Dropped', cat.reason));
    used.add('status'); used.add('closed_at');
  }
  // A close or drop clears any block as part of the same action: the sentence above covers it.
  const closing = cat && (cat.after === 'done' || cat.after === 'dropped');
  if (closing) { used.add('blocked_on_id'); used.add('blocked_ask'); }

  const ask = by.get('blocked_ask');
  const on = by.get('blocked_on_id');
  if (!closing && ask) {
    used.add('blocked_ask'); used.add('blocked_on_id');
    if (set(ask.after)) {
      const who = on && set(on.after) ? names[String(on.after)] ?? String(on.after) : null;
      out.push(`Blocked: ${ask.after}${who ? ` (waiting on ${who})` : ''}`);
    } else {
      out.push(withWhy('Unblocked', ask.reason));
    }
  } else if (!closing && on) {
    used.add('blocked_on_id');
    out.push(set(on.after) ? `Now waiting on ${names[String(on.after)] ?? String(on.after)}` : 'No longer waiting on anyone');
  }

  // A status word with no category beside it (older sheet-style events).
  const word = by.get('status');
  if (word && !used.has('status')) {
    used.add('status');
    const w = String(word.after);
    const line = w === 'doing' ? 'Started' : w === 'todo' ? 'Moved back to Not started' : w === 'done' ? 'Marked done' : w === 'dropped' ? 'Dropped' : `Status: ${show('status', word.before, names, projects)} → ${w}`;
    out.push(withWhy(line, word.reason));
    if (w === 'done' || w === 'dropped') used.add('closed_at');
  }

  const health = by.get('health');
  if (health) {
    used.add('health');
    if (health.after === 'not_started') out.push(withWhy('Moved back to Not started', health.reason));
    else if (health.before === 'not_started' || !set(health.before)) out.push(withWhy('Started', health.reason));
    else out.push(`Health: ${show('health', health.before, names, projects)} → ${show('health', health.after, names, projects)}`);
  }

  const due = by.get('due_on');
  if (due) {
    used.add('due_on');
    out.push(withWhy(`Due date moved ${show('due_on', due.before, names, projects)} → ${show('due_on', due.after, names, projects)}`, due.reason));
  }

  const title = by.get('title');
  if (title) { used.add('title'); out.push(`Renamed to “${title.after}”`); }
  const owner = by.get('owner_id');
  if (owner) { used.add('owner_id'); out.push(`${owner.entity_type === 'project' ? 'Project owner changed to' : 'Reassigned to'} ${show('owner_id', owner.after, names, projects)}`); }
  const lead = by.get('lead_id');
  if (lead) { used.add('lead_id'); out.push(`Project lead changed to ${show('lead_id', lead.after, names, projects)}`); }
  const proj = by.get('project_id');
  if (proj) { used.add('project_id'); out.push(set(proj.after) ? `Moved to project ${show('project_id', proj.after, names, projects)}` : 'Taken out of its project'); }
  const ws = by.get('workstream');
  if (ws) { used.add('workstream'); out.push(set(ws.after) ? `Sub-project set to ${ws.after}` : 'Sub-project cleared'); }
  const desc = by.get('description');
  if (desc) { used.add('description'); out.push(set(desc.after) ? 'Description updated' : 'Description cleared'); }
  const note = by.get('note');
  if (note) { used.add('note'); out.push(set(note.after) ? `Note: ${note.after}` : 'Note cleared'); }
  const pri = by.get('priority');
  if (pri) { used.add('priority'); out.push(`Priority set to ${pri.after}`); }
  const sn = by.get('status_note');
  if (sn) { used.add('status_note'); out.push(set(sn.after) ? `Status note: ${sn.after}` : 'Status note cleared'); }

  // Anything not covered above keeps its literal line, so no change is ever hidden.
  for (const e of events) if (!used.has(e.field)) out.push(logLine(e, names, projects));
  // Closed time and status word are redundant only beside a status category; alone they show.
  return out.join('. ');
}

export type LogEntry<T extends LogLine = LogLine> = T & { key: string; text: string; events: T[] };

// Folds events from one action (same task, same actor, same timestamp) into one entry, newest
// first as given. The entry carries the first event's fields plus `text`. The reason is inside
// `text` where it belongs to the sentence, so callers show `text` and need not print `reason`.
export function groupLog<T extends LogLine>(events: T[], names: Names, projects: Names): LogEntry<T>[] {
  const groups: T[][] = [];
  const index = new Map<string, T[]>();
  for (const e of events) {
    const k = `${e.entity_id}|${e.actor_id ?? ''}|${e.at}`;
    const g = index.get(k);
    if (g) g.push(e);
    else { const n = [e]; index.set(k, n); groups.push(n); }
  }
  return groups.map((g) => {
    // The log is newest first, so ids within an action arrive reversed; restore write order.
    const ordered = [...g].reverse();
    const head = g[g.length - 1];
    return { ...head, key: head.id, text: actionText(ordered, names, projects), events: ordered };
  });
}
