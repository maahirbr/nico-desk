import { readBody, route, sameTeam } from '@/lib/http';
import { getProject, projectMembers, updateProject } from '@/lib/plan';
import { ProjectBody } from '@/lib/projectBody';

export const GET = route<{ id: string }>(async ({ params, me, db }) => {
  const p = await getProject(db, params.id);
  sameTeam(me, p.teamId);
  return { ...p, members: await projectMembers(db, p.id) };
});

export const PATCH = route<{ id: string }>(async ({ req, params, me, db }) => {
  const b = await readBody(req, ProjectBody);
  sameTeam(me, (await getProject(db, params.id)).teamId);
  return updateProject(db, me.person.id, params.id, b);
});
