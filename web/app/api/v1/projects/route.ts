import { readBody, route } from '@/lib/http';
import { ProjectBody } from '@/lib/projectBody';
import { createProject, moveTargets } from '@/lib/plan';
import { isLeadOrAdmin } from '@/lib/roles';

// Start a project (leads). The owner is the project lead; members carry their role on the project.
export const POST = route(async ({ req, me, db }) =>
  Response.json(await createProject(db, me.person.id, me.team.id, await readBody(req, ProjectBody)), { status: 201 }),
);

// The projects a task can be moved into (23 Nov): see lib/plan.ts moveTargets. A partner never moves a task.
export const GET = route(async ({ me, db }) =>
  me.person.appRoles.includes('partner') ? [] : moveTargets(db, me.team.id, me.person.id, isLeadOrAdmin(me.person.appRoles)),
);
