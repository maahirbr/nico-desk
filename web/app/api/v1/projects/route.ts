import { readBody, route } from '@/lib/http';
import { ProjectBody } from '@/lib/projectBody';
import { createProject } from '@/lib/plan';

// Start a project (leads). The owner is the project lead; members carry their role on the project.
export const POST = route(async ({ req, me, db }) =>
  Response.json(await createProject(db, me.person.id, me.team.id, await readBody(req, ProjectBody)), { status: 201 }),
);
