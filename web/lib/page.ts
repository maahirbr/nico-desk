import { db } from './db';
import { cookies } from 'next/headers';
import { listPeople, listProjects, seenMarks, updatesView } from './service';
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
    isLead: me.person.appRoles.includes('lead') || me.person.appRoles.includes('admin'), // an admin can do anything a lead can
    isAdmin: me.person.appRoles.includes('admin'),
  };
}

export type SP = Promise<Record<string, string | string[] | undefined>>;
export const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

// What this person has seen, from their account. The old per-browser cookie still counts, so nobody
// gets last week's updates back on the day "seen" moved to the account.
async function seenFor(me: Me, d: Awaited<ReturnType<typeof db>>) {
  const marks = await seenMarks(d, me.person.id);
  const cookie = (await cookies()).get(seenCookieName(me.person.id))?.value;
  const all = [marks.all, cookie && !Number.isNaN(Date.parse(cookie)) ? new Date(cookie).toISOString() : null].filter(Boolean).sort().pop() ?? null;
  return { all, byTask: marks.byTask };
}

// "Updates for you" for the home pages: what this person has not marked seen.
export async function homeUpdates(me: Me, d: Awaited<ReturnType<typeof db>>, names: Record<string, string>, projectNames: Record<string, string>) {
  const seen = await seenFor(me, d);
  const now = new Date();
  const { items, groups } = await updatesView(d, me.person.id, me.team.id, names, projectNames, seen.all, now, seen.byTask);
  return { items, groups, now: now.toISOString() };
}
