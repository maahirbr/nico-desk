'use client';

import { useRouter } from 'next/navigation';
import type { Task } from '@/lib/derive';
import { canUndo, planUndo, type UndoField } from '@/lib/undo';
import { useReadOnly } from './readonly';
import { notify } from './toast';
import { useViewer } from './viewer';

// "Marked done. Undo" for six seconds. An undo is a new change through the same API and rules as any
// other (lib/undo.ts says which fields go back and when no undo is offered). It never deletes: the log
// only grows, and it shows the change back with the reason "Undone".

async function call(path: string, method: string, body?: unknown) {
  const res = await fetch(`/api/v1${path}`, {
    method, headers: body === undefined ? undefined : { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error?.message ?? `Request failed (${res.status}).`);
  return data;
}

// Reads the task as it is now, so a change someone else made meanwhile is not overwritten and the
// version check passes, then puts the touched fields back one step at a time.
export async function undoTask(before: Task, fields: UndoField[]) {
  const current: Task = await call(`/tasks/${before.id}`, 'GET');
  let version = current.version;
  for (const s of planUndo(before, current, fields)) {
    const r = await call(`/tasks/${before.id}${s.path}`, s.method, { version, ...s.body });
    version = r?.version ?? version;
  }
}

// An open side panel holds its own copy of the task; this tells it to read the task again.
export const TASK_CHANGED = 'nd:task-changed';
const changed = (id: string) => window.dispatchEvent(new CustomEvent(TASK_CHANGED, { detail: id }));

export function useUndo() {
  const router = useRouter();
  const readOnly = useReadOnly();
  const { meId, isLead, today } = useViewer();
  // Shows the confirmation. `before` is the task as it was just before the change. If there is no clean
  // inverse, or this person's rights do not allow it, the toast has no Undo.
  return {
    announce(text: string, before: Task, fields: UndoField[]) {
      if (readOnly || !canUndo(before, fields, { meId, isLead }, today)) return notify(text);
      notify(text, async () => { await undoTask(before, fields); changed(before.id); router.refresh(); });
    },
    // For changes that are not a task field (a link). The caller supplies the inverse.
    announceWith(text: string, taskId: string, inverse: () => Promise<unknown>) {
      if (readOnly) return notify(text);
      notify(text, async () => { await inverse(); changed(taskId); router.refresh(); });
    },
  };
}
