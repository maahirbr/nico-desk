import type { Task } from '@/lib/derive';
import type { StatusKey } from './task-ui';

// Which status moves the service allows this person, so the UI never offers one that returns 403.
// Mirrors lib/service.ts: blockTask is owner-only; setHealth, closeTask and the unblock that
// quickMove runs first allow the owner or a lead; reopenTask is lead-only. Keep them in step.
export function canMoveTo(t: Pick<Task, 'ownerId' | 'readOnly' | 'statusCategory'>, s: StatusKey, meId: string, isLead: boolean): boolean {
  if (t.readOnly) return false;
  if (t.statusCategory !== 'open') return isLead;
  if (s === 'blocked') return t.ownerId === meId;
  return t.ownerId === meId || isLead;
}
