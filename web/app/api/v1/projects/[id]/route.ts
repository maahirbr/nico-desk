import { z } from 'zod';
import { readBody, route } from '@/lib/http';
import { deleteProject, projectMembers, updateProject } from '@/lib/plan';
import { ProjectBody } from '@/lib/projectBody';
import { projectFor } from '@/lib/visibility';

export const GET = route<{ id: string }>(async ({ params, me, db }) => {
  const p = await projectFor(db, me, params.id);
  return { ...p, members: await projectMembers(db, p.id) };
});

export const PATCH = route<{ id: string }>(async ({ req, params, me, db }) => {
  const b = await readBody(req, ProjectBody);
  await projectFor(db, me, params.id);
  return updateProject(db, me.person.id, params.id, b);
});

// Delete for good: an admin, an archived project, and its name typed to confirm (lib/plan.ts deleteProject).
const DeleteBody = z.object({ name: z.string().max(200) }).strict();

export const DELETE = route<{ id: string }>(async ({ req, params, me, db }) => {
  const b = await readBody(req, DeleteBody);
  await projectFor(db, me, params.id);
  return deleteProject(db, me.person.id, params.id, b.name);
});
