import { db } from './db';
import { isLeadOrAdmin } from './roles';
import { cookies } from 'next/headers';
import { listPeople, listProjects, updatesFor } from './service';
import { seenCookieName } from './updates';
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
    isLead: isLeadOrAdmin(me.person.appRoles), // lead or admin: the same rule the service applies
    isAdmin: me.person.appRoles.includes('admin'),
    readOnly: me.viewingAs, // an admin viewing as someone else: no write control shows (lib/http.ts refuses the writes)
  };
}

export type SP = Promise<Record<string, string | string[] | undefined>>;
export const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

// "Updates for you" for the home pages: unseen items, using this device's mark-all-seen cut-off.
export async function homeUpdates(me: Me, d: Awaited<ReturnType<typeof db>>, names: Record<string, string>) {
  const seen = (await cookies()).get(seenCookieName(me.person.id))?.value;
  const now = new Date();
  return { items: await updatesFor(d, me.person.id, me.team.id, names, seen, now), now: now.toISOString() };
}
