import { forbidden } from '@/lib/errors';
import { jevOn } from '@/lib/jev';
import { projectHealth } from '@/lib/jevUses';
import { rateLimit, route } from '@/lib/http';
import { isLeadOrAdmin } from '@/lib/roles';
import { seenTasks, projectFor } from '@/lib/visibility';

// A labelled suggestion of how a project is going, for its owner or lead (and a lead or admin). It reads and answers.
// It stores nothing and never touches the project's own status (on track, at risk, off track), which a person sets.
export const POST = route<{ id: string }>(async ({ params, me, db }) => {
  const p = await projectFor(db, me, params.id);
  if (!(p.ownerId === me.person.id || p.leadId === me.person.id || isLeadOrAdmin(me.person.appRoles))) throw forbidden('Only the project lead can ask for this.');
  if (!jevOn()) return { health: { state: 'off', notes: 0 } };
  try { rateLimit(`jev-h:${me.realPerson.id}`, 10); } catch { return { health: { state: 'unavailable', notes: 0 } }; }
  const tasks = (await seenTasks(db, me)).filter((t) => t.projectId === p.id);
  return { health: await projectHealth(db, me.team.id, p, tasks) };
});
