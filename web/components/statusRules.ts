import type { Task } from '@/lib/derive';
import type { StatusKey } from './task-ui';

// Which status moves the service allows this person, so the UI never offers one that returns 403.
// Mirrors lib/service.ts: blockTask, setHealth, closeTask and the unblock that
// quickMove runs first allow the owner or a lead; reopenTask is lead-only. Keep them in step.
// head (15 Nov): the owner or lead of the task's project may also drop it, and reopen it.
export function canMoveTo(t: Pick<Task, 'ownerId' | 'readOnly' | 'statusCategory'>, s: StatusKey, meId: string, isLead: boolean, head = false): boolean {
  if (t.readOnly) return false;
  if (t.statusCategory !== 'open') return isLead || head || t.ownerId === meId; // reopen: also the task's own owner (17 Nov)
  return t.ownerId === meId || isLead || (head && s === 'dropped');
}
