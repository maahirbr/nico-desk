import { fmtDate } from './time';

// "Updates for you": major changes to tasks made by someone else, worked out from the events table
// alone (no schema change). Pure: events + tasks + project leads + viewer in, items out.
//
//   owner of the task    -> assigned to you (_created or owner_id), due_on moved, status_category
//                           done or dropped, title changed
//   blocked_on_id person -> "X is blocked on you", with the block reason (blocked_ask)
//   project lead         -> due_on moved (with its reason), blocked_ask set, dropped, owner_id changed
//   nobody               -> sees their own actions (actor_id = viewer)

export type UpdateEvent = {
  id: string; entity_id: string; field: string; before: unknown; after: unknown; reason: string | null; actor_id: string | null; at: string | Date;
};
export type UpdateTask = { id: string; title: string; ownerId: string; projectId: string | null; blocked: { onId: string | null } | null };
export type UpdateKind = 'assigned' | 'due_moved' | 'blocked' | 'blocked_on_you' | 'dropped' | 'done' | 'renamed' | 'reassigned';
export type UpdateItem = { id: string; taskId: string; projectId: string | null; kind: UpdateKind; text: string; at: string };

export const UPDATE_DAYS = 7;
const DAY = 86_400_000;
const iso = (at: string | Date) => new Date(at).toISOString();
const q = (s: string) => `“${s}”`;
const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));

export function buildUpdates(input: {
  events: UpdateEvent[];
  tasks: UpdateTask[];
  leadOf: Record<string, string>; // project id -> projects.owner_id
  names: Record<string, string>;
  viewerId: string;
  now: string | Date;
  seenAt?: string | null; // show only items after this moment
}): UpdateItem[] {
  const { events, tasks, leadOf, names, viewerId } = input;
  const now = new Date(input.now).getTime();
  const seen = input.seenAt ? new Date(input.seenAt).getTime() : NaN;
  const task = new Map(tasks.map((t) => [t.id, t]));
  const first = (id: string | null | undefined) => (id ? (names[id] ?? 'Someone').split(' ')[0] : 'Someone');

  // A block writes blocked_ask and blocked_on_id in one go; read them together by task and moment.
  const blockOn = new Map<string, string>();
  for (const e of events) if (e.field === 'blocked_on_id' && e.after) blockOn.set(`${e.entity_id}|${iso(e.at)}`, str(e.after));

  const out: UpdateItem[] = [];
  for (const e of events) {
    const t = task.get(e.entity_id);
    const ms = new Date(e.at).getTime();
    if (!t || e.actor_id === viewerId || ms > now || ms < now - UPDATE_DAYS * DAY) continue;
    if (!Number.isNaN(seen) && ms <= seen) continue;

    const owner = t.ownerId === viewerId;
    const lead = !!t.projectId && leadOf[t.projectId] === viewerId;
    const who = first(e.actor_id);
    const title = q(t.title);
    // "your task", the bare title when the owner did it, else "Priya’s".
    const subject = owner ? `your task ${title}` : e.actor_id === t.ownerId ? title : `${first(t.ownerId)}’s ${title}`;
    const why = e.reason?.trim();
    const item = (kind: UpdateKind, text: string) => out.push({ id: `${e.id}:${viewerId}`, taskId: t.id, projectId: t.projectId, kind, text, at: iso(e.at) });

    if (e.field === '_created' || e.field === 'owner_id') {
      const after = e.field === '_created' ? (e.after as Record<string, unknown> | null) : null;
      const newOwner = after ? str(after.owner_id) : str(e.after);
      if (newOwner === viewerId) {
        item('assigned', after ? `${who} assigned you ${title}${after.due_on ? `, due ${fmtDate(str(after.due_on))}` : ''}` : `${who} reassigned ${title} to you`);
      } else if (lead && !after) {
        item('reassigned', `${who} reassigned ${title} from ${first(str(e.before))} to ${first(newOwner)}`);
      }
    } else if (e.field === 'due_on' && (owner || lead)) {
      const move = `${who} moved ${subject} from ${fmtDate(str(e.before))} to ${fmtDate(str(e.after))}`;
      item('due_moved', why ? `${move}: ${why}` : lead ? `${move}: no reason given` : move);
    } else if (e.field === 'blocked_ask' && e.after) {
      const on = blockOn.get(`${e.entity_id}|${iso(e.at)}`);
      if (on === viewerId) {
        // Only while the task is still blocked on them.
        if (t.blocked?.onId === viewerId) item('blocked_on_you', `${who} is blocked on you for ${title}: ${str(e.after)}`);
      } else if (lead) {
        item('blocked', `${who} blocked ${subject}${on ? ` on ${first(on)}` : ''}: ${str(e.after)}`);
      }
    } else if (e.field === 'status_category' && e.after === 'dropped' && (owner || lead)) {
      item('dropped', `${who} dropped ${subject}: ${why || 'no reason given'}`);
    } else if (e.field === 'status_category' && e.after === 'done' && owner) {
      item('done', `${who} marked ${subject} done${why ? `: ${why}` : ''}`);
    } else if (e.field === 'title' && owner) {
      item('renamed', `${who} renamed your task ${q(str(e.before))} to ${q(str(e.after))}`);
    }
  }

  // Newest first; then one blocked-on-you line per task (the latest block).
  out.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : a.id < b.id ? 1 : -1));
  const blockedSeen = new Set<string>();
  return out.filter((i) => {
    if (i.kind !== 'blocked_on_you') return true;
    if (blockedSeen.has(i.taskId)) return false;
    blockedSeen.add(i.taskId);
    return true;
  });
}

// "5 min ago", "3 h ago", "yesterday", "4 days ago". Takes `now` so server and browser agree.
export function ago(at: string, now: string | Date): string {
  const mins = Math.floor((new Date(now).getTime() - new Date(at).getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)} h ago`;
  const days = Math.floor(mins / 1440);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

// One cookie per person, so two people on one browser keep their own cut-off. It holds an ISO moment.
export const seenCookieName = (personId: string) => `nd_seen_${personId.replace(/[^A-Za-z0-9_-]/g, '')}`;
