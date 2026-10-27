import { z } from 'zod';
import { jevOn } from '@/lib/jev';
import { guessProject } from '@/lib/jevUses';
import { rateLimit, readBody, route } from '@/lib/http';
import { projectsMayAddTo } from '@/lib/plan';
import { isLeadOrAdmin } from '@/lib/roles';
import { seenProjects } from '@/lib/visibility';

// Which of the projects the caller may add to does a new task's title fit? Picked from that fixed list only.
// It reads and answers; the form fills the project only while the person has left it empty.
// Off, slow or unsure: { projectId: null }.
export const POST = route(async ({ req, me, db }) => {
  const { title } = await readBody(req, z.object({ title: z.string().max(280) }).strict());
  if (!jevOn()) return { projectId: null };
  try { rateLimit(`jev-p:${me.realPerson.id}`, 20); } catch { return { projectId: null }; }
  const may = new Set(await projectsMayAddTo(db, me.team.id, me.person.id, isLeadOrAdmin(me.person.appRoles)));
  const list = (await seenProjects(db, me)).filter((p) => p.kind === 'tasks' && !p.archivedAt && may.has(p.id))
    .map((p) => ({ id: p.id, department: p.department, intro: p.intro, workstreams: p.workstreams }));
  return { projectId: await guessProject(db, me.team.id, title, list) };
});
