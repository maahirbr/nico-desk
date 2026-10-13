import { fmtDate } from './time';

// "Updates for you": major changes to tasks made by someone else, worked out from the events table
// alone (no schema change). Pure: events + tasks + project leads + viewer in, items out.
//
//   owner of the task    -> assigned to you (_created or owner_id), due_on moved, status_category
//                           done or dropped, title changed
//   blocked_on_id person -> nothing here: a block on you shows under "Waiting on you" until it is cleared
//   project lead         -> due_on moved (with its reason), blocked_ask set, dropped, owner_id changed
//   owner and lead       -> someone else cleared the block, with what they did
//   nobody               -> sees their own actions (actor_id = viewer)

export type UpdateEvent = {
  id: string; entity_id: string; field: string; before: unknown; after: unknown; reason: string | null; actor_id: string | null; at: string | Date;
};
export type UpdateTask = { id: string; title: string; ownerId: string; projectId: string | null; blocked: { onId: string | null } | null; dueOn?: string; statusCategory?: string };
export type UpdateKind = 'assigned' | 'due_moved' | 'blocked' | 'unblocked' | 'dropped' | 'done' | 'renamed' | 'reassigned';
// text: the full sentence. who + clause: the same change as a short phrase about "it", for one line per task.
// fold: a change the grouped view leaves out (a small rename, or a tidy-up right after assigning).
export type UpdateItem = { id: string; taskId: string; projectId: string | null; kind: UpdateKind; text: string; at: string; who: string; clause: string; fold?: boolean };

export const UPDATE_DAYS = 7;
const DAY = 86_400_000;
const iso = (at: string | Date) => new Date(at).toISOString();
const q = (s: string) => `“${s}”`;
const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));

export function buildUpdates(input: {
  events: UpdateEvent[];
  tasks: UpdateTask[];
  leadOf: Record<string, string | string[]>; // project id -> its owner and lead
  names: Record<string, string>;
  viewerId: string;
  now: string | Date;
  seenAt?: string | null; // show only items after this moment
  days?: number; // how far back to look; a week unless a caller asks for more (the meeting agenda)
}): UpdateItem[] {
  const { events, tasks, leadOf, names, viewerId } = input;
  const now = new Date(input.now).getTime();
  const window = (input.days ?? UPDATE_DAYS) * DAY;
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
    if (!t || e.actor_id === viewerId || ms > now || ms < now - window) continue;
    if (!Number.isNaN(seen) && ms <= seen) continue;

    const owner = t.ownerId === viewerId;
    const lead = !!t.projectId && [leadOf[t.projectId] ?? []].flat().includes(viewerId);
    const who = first(e.actor_id);
    const title = q(t.title);
    // "your task", the bare title when the owner did it, else "Priya’s".
    const subject = owner ? `your task ${title}` : e.actor_id === t.ownerId ? title : `${first(t.ownerId)}’s ${title}`;
    const why = e.reason?.trim();
    const item = (kind: UpdateKind, text: string, clause: string, fold = false) =>
      out.push({ id: `${e.id}:${viewerId}`, taskId: t.id, projectId: t.projectId, kind, text, at: iso(e.at), who, clause, ...(fold ? { fold } : {}) });
    const said = (s: string | undefined) => (s ? ` (“${s}”)` : '');

    if (e.field === '_created' || e.field === 'owner_id') {
      const after = e.field === '_created' ? (e.after as Record<string, unknown> | null) : null;
      const newOwner = after ? str(after.owner_id) : str(e.after);
      if (newOwner === viewerId) {
        item('assigned', after ? `${who} assigned you ${title}${after.due_on ? `, due ${fmtDate(str(after.due_on))}` : ''}` : `${who} reassigned ${title} to you`,
          after ? `assigned it to you${after.due_on ? `, due ${fmtDate(str(after.due_on))}` : ''}` : 'reassigned it to you');
      } else if (lead && !after) {
        item('reassigned', `${who} reassigned ${title} from ${first(str(e.before))} to ${first(newOwner)}`, `reassigned it from ${first(str(e.before))} to ${first(newOwner)}`);
      }
    } else if (e.field === 'due_on' && (owner || lead)) {
      const move = `${who} moved ${subject} from ${fmtDate(str(e.before))} to ${fmtDate(str(e.after))}`;
      item('due_moved', why ? `${move}: ${why}` : lead ? `${move}: no reason given` : move,
        `moved it to ${fmtDate(str(e.after))} (was ${fmtDate(str(e.before))})${why ? `, “${why}”` : lead ? ', no reason given' : ''}`);
    } else if (e.field === 'blocked_ask' && e.after) {
      const on = blockOn.get(`${e.entity_id}|${iso(e.at)}`);
      if (on !== viewerId && lead) {
        item('blocked', `${who} blocked ${subject}${on ? ` on ${first(on)}` : ''}: ${str(e.after)}`, `blocked it${on ? ` on ${first(on)}` : ''}${said(str(e.after))}`);
      }
    } else if (e.field === 'blocked_ask' && e.before && !e.after && (owner || lead)) {
      // Done or dropped also clears a block; that change speaks for itself.
      const closedThen = events.some((x) => x.entity_id === e.entity_id && x.field === 'status_category' && iso(x.at) === iso(e.at));
      if (!closedThen) item('unblocked', `${who} cleared the block on ${subject}${why ? `: ${why}` : ''}`, `cleared the block${said(why)}`);
    } else if (e.field === 'status_category' && e.after === 'dropped' && (owner || lead)) {
      item('dropped', `${who} dropped ${subject}: ${why || 'no reason given'}`, `dropped it${why ? said(why) : ', no reason given'}`);
    } else if (e.field === 'status_category' && e.after === 'done' && owner) {
      item('done', `${who} marked ${subject} done${why ? `: ${why}` : ''}`, 'marked it done');
    } else if (e.field === 'title' && owner) {
      // A small edit (spelling, a few words added or trimmed) or a tidy-up by whoever just assigned it stays out of the grouped view.
      const tidy = events.some((x) => x.entity_id === e.entity_id && x.actor_id === e.actor_id && x.field === '_created' && new Date(x.at).getTime() <= ms);
      item('renamed', `${who} renamed your task ${q(str(e.before))} to ${q(str(e.after))}`, 'renamed it', tidy || smallEdit(str(e.before), str(e.after)));
    }
  }

  // Newest first.
  return out.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : a.id < b.id ? 1 : -1));
}

// Same title give or take: one contains the other, or under a quarter of it changed.
export function smallEdit(a: string, b: string): boolean {
  const n = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const x = n(a), y = n(b);
  if (!x || !y) return false;
  if (x.includes(y) || y.includes(x)) return true;
  return distance(x, y) <= Math.max(x.length, y.length) * 0.25;
}

function distance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

// ---------- grouped view: by project, one line per task ----------

export type UpdateRow = { taskId: string; title: string; ownerName: string | null; summary: string; parts: { who: string; text: string }[]; at: string; closed: 'done' | 'dropped' | null; due: { label: string; tone: 'late' | 'soon' | 'later' } | null };
export type UpdateGroup = { projectId: string | null; name: string; rows: UpdateRow[] };

const addDays = (d: string, n: number) => new Date(new Date(`${d}T00:00:00Z`).getTime() + n * DAY).toISOString().slice(0, 10);

export function groupUpdates(items: UpdateItem[], tasks: UpdateTask[], projectNames: Record<string, string>, names: Record<string, string>, viewerId: string, today: string): UpdateGroup[] {
  const task = new Map(tasks.map((t) => [t.id, t]));
  const byTask = new Map<string, UpdateItem[]>();
  for (const i of items) if (!i.fold) (byTask.get(i.taskId) ?? byTask.set(i.taskId, []).get(i.taskId)!).push(i);

  const rows: (UpdateRow & { projectId: string | null })[] = [];
  for (const [taskId, list] of byTask) {
    const t = task.get(taskId);
    if (!t) continue;
    // Oldest first within the line: "Meera assigned it to you, due 19 Oct, then moved it to 22 Oct (was 19 Oct)".
    const steps = [...list].sort((a, b) => (a.at < b.at ? -1 : 1));
    // One part per run of the same person, so the page can set each name in bold.
    const parts: { who: string; text: string }[] = [];
    for (const s of steps) {
      const last = parts[parts.length - 1];
      if (last?.who === s.who) last.text += `, then ${s.clause}`;
      else parts.push({ who: s.who, text: s.clause });
    }
    const closed = t.statusCategory === 'done' ? 'done' : t.statusCategory === 'dropped' ? 'dropped' : null;
    let due: UpdateRow['due'] = null;
    if (!closed && t.dueOn) {
      if (t.dueOn < today) due = { label: 'Late', tone: 'late' };
      else if (t.dueOn === today) due = { label: 'Due today', tone: 'soon' };
      else if (t.dueOn === addDays(today, 1)) due = { label: 'Due tomorrow', tone: 'soon' };
      else due = { label: `Due ${fmtDate(t.dueOn)}`, tone: 'later' };
    }
    rows.push({ taskId, projectId: t.projectId, title: t.title, ownerName: t.ownerId === viewerId ? null : names[t.ownerId] ?? null,
      summary: parts.map((p) => `${p.who} ${p.text}`).join('; '), parts, at: steps[steps.length - 1].at, closed, due });
  }

  // Open tasks before closed ones, newest first; projects ordered by their newest line, no project last.
  rows.sort((a, b) => (!!a.closed !== !!b.closed ? (a.closed ? 1 : -1) : a.at < b.at ? 1 : -1));
  const groups = new Map<string, UpdateGroup>();
  for (const r of rows) {
    const key = r.projectId ?? '';
    if (!groups.has(key)) groups.set(key, { projectId: r.projectId, name: r.projectId ? projectNames[r.projectId] ?? 'Project' : 'No project', rows: [] });
    const { projectId: _p, ...row } = r;
    groups.get(key)!.rows.push(row);
  }
  const newest = (g: UpdateGroup) => g.rows.reduce((m, r) => (r.at > m ? r.at : m), '');
  return [...groups.values()].sort((a, b) => (!a.projectId !== !b.projectId ? (a.projectId ? -1 : 1) : newest(a) < newest(b) ? 1 : -1));
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
