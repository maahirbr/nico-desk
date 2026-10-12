import type { Task } from './derive';

// Undo is never a delete. The log is append-only, so an undo is a new change that puts the fields
// back, through the same API and the same rules as any other change (and it shows in the log, with
// the reason "Undone"). Two pure functions, both tested:
//   canUndo  : is there a clean inverse that this person's rights allow? If not, no Undo is offered.
//   planUndo : the steps that put the touched fields back, given the task as it is now.
// Only the fields the action touched are put back, so a change made by someone else in the six
// seconds is not overwritten.

export type UndoField = 'category' | 'blocked' | 'health' | 'due' | 'owner' | 'title' | 'description' | 'note' | 'workstream';

export type UndoSnap = Pick<Task, 'statusCategory' | 'blocked' | 'health' | 'dueOn' | 'ownerId' | 'title' | 'description' | 'note' | 'workstream' | 'readOnly'>;

// path is relative to /tasks/:id; the runner adds the version it holds after each step.
export type UndoStep = { path: string; method: 'POST' | 'PATCH'; body: Record<string, unknown> };

export const UNDO_REASON = 'Undone';

const WORKING = ['not_started', 'on_track'];

export function canUndo(before: UndoSnap, fields: UndoField[], who: { meId: string; isLead: boolean }, today: string): boolean {
  if (before.readOnly || fields.length === 0) return false;
  const owns = before.ownerId === who.meId;
  for (const f of fields) {
    // Undoing a close is a reopen, which only a lead or admin may do. A plain owner gets no Undo.
    if (f === 'category' && before.statusCategory === 'open' && !who.isLead) return false;
    // Putting a block back is a new block, which only the owner or a lead may make.
    if (f === 'blocked' && before.blocked && !(owns || who.isLead)) return false;
    // Only not started and in progress can be set; any other stored health has no inverse.
    if (f === 'health' && !(before.health && WORKING.includes(before.health))) return false;
    // A date in the past cannot be set again.
    if (f === 'due' && before.dueOn < today) return false;
    // Handing a task back needs the lead right, since the new owner no longer owns it.
    if (f === 'owner' && !who.isLead) return false;
  }
  return true;
}

export function planUndo(before: UndoSnap, current: UndoSnap, fields: UndoField[]): UndoStep[] {
  const has = (f: UndoField) => fields.includes(f);
  const steps: UndoStep[] = [];
  let open = current.statusCategory === 'open';
  let blocked = open ? current.blocked : null; // closing clears a block, and a reopen does not bring it back

  if (has('category') && before.statusCategory !== current.statusCategory) {
    if (before.statusCategory === 'open') {
      steps.push({ path: '/reopen', method: 'POST', body: { reason: UNDO_REASON } });
      open = true; blocked = null;
    } else if (open) {
      steps.push({ path: '/close', method: 'POST', body: { as: before.statusCategory, reason: UNDO_REASON } });
      open = false;
    }
  }
  if (!open) return steps; // nothing else can change on a closed task

  if (has('blocked')) {
    const want = before.blocked;
    if (want && (!blocked || blocked.ask !== want.ask || blocked.onId !== want.onId)) {
      steps.push({ path: '/block', method: 'POST', body: { onId: want.onId, ask: want.ask } });
    } else if (!want && blocked) {
      steps.push({ path: '/unblock', method: 'POST', body: {} });
    }
  }
  if (has('health') && before.health && WORKING.includes(before.health) && before.health !== current.health) {
    steps.push({ path: '/health', method: 'POST', body: { health: before.health, ...(before.health === 'not_started' ? { reason: UNDO_REASON } : {}) } });
  }
  if (has('due') && before.dueOn !== current.dueOn) {
    steps.push({ path: '/renegotiate', method: 'POST', body: { newDueOn: before.dueOn, reason: UNDO_REASON } });
  }
  const patch: Record<string, unknown> = {};
  if (has('title') && before.title !== current.title) patch.title = before.title;
  if (has('description') && before.description !== current.description) patch.description = before.description;
  if (has('note') && before.note !== current.note) patch.note = before.note;
  if (has('workstream') && before.workstream !== current.workstream) patch.workstream = before.workstream;
  if (has('owner') && before.ownerId !== current.ownerId) patch.ownerId = before.ownerId;
  if (Object.keys(patch).length) steps.push({ path: '', method: 'PATCH', body: patch });
  return steps;
}

// The fields a status move touches, so the caller names them once. quickMove clears a block first.
export function statusFields(t: Pick<Task, 'blocked'>, to: 'todo' | 'doing' | 'blocked' | 'done' | 'dropped'): UndoField[] {
  if (to === 'done' || to === 'dropped') return ['category', 'blocked'];
  if (to === 'blocked') return ['blocked'];
  return t.blocked ? ['blocked', 'health'] : ['health'];
}

// The fields an edit body (PATCH /tasks/:id) touches.
export function editFields(body: Record<string, unknown>): UndoField[] {
  const out: UndoField[] = [];
  if ('title' in body) out.push('title');
  if ('description' in body) out.push('description');
  if ('note' in body) out.push('note');
  if ('workstream' in body) out.push('workstream');
  if ('ownerId' in body) out.push('owner');
  return out;
}
