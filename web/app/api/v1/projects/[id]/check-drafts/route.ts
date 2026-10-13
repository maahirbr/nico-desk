import { jevOn } from '@/lib/jev';
import { checkDrafts } from '@/lib/jevUses';
import { rateLimit, route } from '@/lib/http';
import { pendingProposals } from '@/lib/plan';
import { projectFor, seenTasks } from '@/lib/visibility';

// Reads the draft tasks waiting in a project's minutes queue and notes how clear each one is and whether an open task
// may repeat it. The drafts come from the database, never from the caller. Nothing is written: the person still
// approves, edits or drops each draft. Anyone who can see the project's queue can run it. Owner and date are checked by code (readinessOf), not by Jev.
export const POST = route<{ id: string }>(async ({ params, me, db }) => {
  const p = await projectFor(db, me, params.id);
  if (!jevOn()) return { ok: false, reason: 'off' };
  try { rateLimit(`jev-d:${me.realPerson.id}`, 10); } catch { return { ok: false, reason: 'unavailable' }; }
  const drafts = (await pendingProposals(db, p.id)).map((x) => ({ id: x.id, task: x.task, ownerId: x.ownerId, dueOn: x.dueOn }));
  const open = (await seenTasks(db, me)).filter((t) => t.projectId === p.id && t.statusCategory === 'open').map((t) => ({ id: t.id, title: t.title, note: t.note }));
  return checkDrafts(db, me.team.id, drafts, open);
});
