import type { Task } from './derive';

// The ledger's "Needs attention" list: open tasks that are past due, slipped silently or blocked,
// worst first, each with WHY it is late and ONE next step. Pure: no database, no clock. The flags
// (overdue, slippedSilently, renegotiations, blocked) all come from derive(), so the ledger's
// counts and this list cannot disagree on what "late" means.

export type StepKind = 'unblock' | 'ask_date' | 'firm_date' | 'close_or_move' | 'confirm_date';
export type WhySource = 'block' | 'move' | 'none';

export type Attention = {
  taskId: string;
  title: string;
  ownerId: string;
  ownerName: string;
  projectId: string | null;
  dueOn: string;
  daysLate: number; // days past the date in force today; 0 when not past due (blocked, or moved and now ahead)
  why: string;
  whySource: WhySource;
  step: { kind: StepKind; text: string };
  remindPersonId: string | null; // whose reminder draft lists this task; null for an unblock, a sheet task or one not past due
};

export const NO_REASON = 'No reason given: slipped silently';

const days = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

// Why: the block reason first (it is the live cause), then the latest date move that has a reason.
export function whyOf(t: Task): { why: string; source: WhySource } {
  if (t.blocked?.ask.trim()) return { why: t.blocked.ask.trim(), source: 'block' };
  for (let i = t.renegotiations.length - 1; i >= 0; i--) {
    const r = t.renegotiations[i].reason?.trim();
    if (r) return { why: r, source: 'move' };
  }
  return { why: NO_REASON, source: 'none' };
}

// Next step, first match wins. "Moved more than once" counts every date move, in time or late:
// a date that has been moved twice and is still not met needs a firm date, whichever way it moved.
export function stepOf(t: Task, why: WhySource, names: Record<string, string>): Attention['step'] {
  const owner = names[t.ownerId] ?? 'the owner';
  if (t.blocked) {
    const on = t.blocked.onId ? names[t.blocked.onId] : null;
    return { kind: 'unblock', text: on ? `Unblock: waiting on ${on}` : 'Unblock: clear the block (no teammate named)' };
  }
  if (why === 'none') return { kind: 'ask_date', text: `Ask ${owner} for a new date and a reason` };
  if (t.renegotiations.length > 1) return { kind: 'firm_date', text: `Agree a firm date with ${owner}` };
  if (t.overdue) return { kind: 'close_or_move', text: 'Close it or move the date with a reason' };
  return { kind: 'confirm_date', text: `Check the new date still holds with ${owner}` };
}

export function needsAttention(t: Task): boolean {
  return t.statusCategory === 'open' && (t.overdue || t.slippedSilently || t.blocked !== null);
}

export function attentionList(tasks: Task[], names: Record<string, string>, today: string): Attention[] {
  const seen = new Set<string>();
  const rows: Attention[] = [];
  for (const t of tasks) {
    if (seen.has(t.id) || !needsAttention(t)) continue;
    seen.add(t.id);
    const { why, source } = whyOf(t);
    const step = stepOf(t, source, names);
    rows.push({
      taskId: t.id, title: t.title, ownerId: t.ownerId, ownerName: names[t.ownerId] ?? 'Unknown', projectId: t.projectId, dueOn: t.dueOn,
      daysLate: Math.max(0, days(t.dueOn, today)), why, whySource: source, step,
      // Same rule as reminderDrafts: read-only sheet tasks never reach a reminder draft, so no link for them.
      remindPersonId: step.kind === 'unblock' || t.readOnly || !t.overdue ? null : t.ownerId,
    });
  }
  // Longest overdue first; then the ones that slipped over the ones that are only blocked; then by title for a stable order.
  const rank = new Map(tasks.map((t) => [t.id, t.slippedSilently ? 0 : 1]));
  return rows.sort((a, b) => b.daysLate - a.daysLate || (rank.get(a.taskId)! - rank.get(b.taskId)!) || a.title.localeCompare(b.title));
}
