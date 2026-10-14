import { db } from './db';
import { listPeople, listProjects } from './service';
import type { Me } from './auth';

// Lookups every page needs: names by id and project names by id.
export async function lookups(me: Me) {
  const d = await db();
  const [people, projects] = await Promise.all([listPeople(d, me.team.id), listProjects(d, me.team.id)]);
  return {
    d,
    people,
    projects,
    names: Object.fromEntries(people.map((p) => [p.id, p.displayName])) as Record<string, string>,
    projectNames: Object.fromEntries(projects.map((p) => [p.id, p.name])) as Record<string, string>,
    activeOpts: people.filter((p) => p.active).map((p) => ({ id: p.id, name: p.displayName })),
    isLead: me.person.appRoles.includes('lead'),
    isAdmin: me.person.appRoles.includes('admin'),
  };
}

export type SP = Promise<Record<string, string | string[] | undefined>>;
export const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
