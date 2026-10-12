import { db } from './db';
import { isLeadOrAdmin } from './roles';
import { cookies } from 'next/headers';
import { listNotices, listPeople, listProjects, seenMarks, updatesFor, updatesView } from './service';
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

// "Since you last looked": the tasks with something new for this person, newest change per task. It reuses
// what already tracks "seen": the updates feed (cut off by what the person marked seen on their account) and the unread
// "assigned" notices. A small rename stays out, as it does in the Updates card.
export async function freshFor(me: Me, d: Awaited<ReturnType<typeof db>>): Promise<Record<string, { at: string; notice?: string }>> {
  const seen = await seenFor(me, d);
  const [items, notices] = await Promise.all([updatesFor(d, me.person.id, me.team.id, {}, seen.all, new Date(), seen.byTask), listNotices(d, me.person.id, true)]);
  const out: Record<string, { at: string; notice?: string }> = {};
  const latest = (id: string, at: string, notice?: string) => {
    const cur = out[id];
    out[id] = { at: cur && cur.at > at ? cur.at : at, ...((notice ?? cur?.notice) ? { notice: notice ?? cur?.notice } : {}) };
  };
  for (const i of items) if (!i.fold) latest(i.taskId, i.at);
  for (const n of notices) if (n.kind === 'assigned') latest(n.taskId, new Date(n.createdAt).toISOString(), n.id);
  return out;
}
