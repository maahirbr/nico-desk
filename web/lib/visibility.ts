import type { Me } from './auth';
import type { Tx } from './db';
import { forbidden, notFound } from './errors';
import { sameTeam } from './http';
import { getProject, teamProjects, type Project } from './plan';
import { isLeadOrAdmin } from './roles';
import { getTask, ledgerOf, ledgerTasksOf, teamTasks, type LedgerRow } from './service';
import { seesProject, seesTask, sightOf, workingWith, type Sight } from './sight';
import type { Task } from './derive';

// What pages and routes read through: the team's tasks and projects as this viewer may see them (lib/sight.ts).
// Pages never import teamTasks or teamProjects directly; tests/visibility.test.ts holds that line.

export const sightFor = (db: Tx, me: Me): Promise<Sight> => sightOf(db, me.team.id, me.person.id);

export async function seenTasks(db: Tx, me: Me, today?: string, sight?: Sight): Promise<Task[]> {
  const [s, ts] = await Promise.all([sight ?? sightFor(db, me), teamTasks(db, me.team.id, today)]);
  return ts.filter((t) => seesTask(s, t));
}

export async function seenProjects(db: Tx, me: Me, sight?: Sight): Promise<Project[]> {
  const [s, ps] = await Promise.all([sight ?? sightFor(db, me), teamProjects(db, me.team.id)]);
  return ps.filter((p) => seesProject(s, p.id));
}

// One task or project for this viewer. Hidden reads as missing: the same 404 as an id that does not exist.
export async function taskFor(db: Tx, me: Me, id: string, today?: string): Promise<Task> {
  const t = await getTask(db, id, today);
  sameTeam(me, t.teamId);
  if (!seesTask(await sightFor(db, me), t)) throw notFound('No such task.');
  return t;
}

export async function projectFor(db: Tx, me: Me, id: string): Promise<Project> {
  const p = await getProject(db, id);
  sameTeam(me, p.teamId);
  if (!seesProject(await sightFor(db, me), p.id)) throw notFound('No such project.');
  return p;
}

// A project id a task is being put into: refused as missing when the viewer may not see it.
export async function assertSeesProject(db: Tx, me: Me, id: string | null | undefined): Promise<void> {
  if (id && !seesProject(await sightFor(db, me), id)) throw notFound('No such project.');
}

// The team-wide API views (week, by status, ledger) count every task, so a restricted person is refused them.
// Their pages filter instead.
export async function assertSeesAll(db: Tx, me: Me): Promise<void> {
  if (!(await sightFor(db, me)).all) throw forbidden('You see only your own projects.');
}

// ---------- the ledger (15 Oct, the PM's call; docs/DECISIONS.md) ----------
// A lead or an admin reads everyone's record in full, whatever the project. A member reads their own and that of the
// people they work with now. Every task of those people counts, so the numbers are whole; a task the member may not
// see arrives stripped (no title, words, project or reasons) and is counted, never opened.

// A task kept for its numbers only: dates, outcome and flags stay; what it is and why it moved go.
export const countOnly = (t: Task): Task => ({
  ...t, title: '', description: null, note: null, projectId: null, workstream: null, health: null, priority: null, links: [],
  renegotiations: t.renegotiations.map((r) => ({ ...r, reason: null })),
  blocked: t.blocked && { ...t.blocked, ask: '' },
});

export type LedgerData = {
  all: boolean; people: Set<string> | null; rows: LedgerRow[]; tasks: Task[]; prev: Task[]; openNow: Task[]; waitingOn: Task[];
  countOnly: string[]; // stripped: a member may not open these
  noLink: string[];    // shown in full to a lead or admin, but outside the projects they may open
};

export async function ledgerFor(db: Tx, me: Me, w: { from: string; to: string; prevFrom: string; prevTo: string; personId?: string; today?: string }): Promise<LedgerData> {
  const [sight, team] = await Promise.all([sightFor(db, me), teamTasks(db, me.team.id, w.today)]);
  const all = isLeadOrAdmin(me.person.appRoles);
  const people = all ? null : await workingWith(db, me.team.id, me.person.id);
  const inScope = (id: string | null | undefined) => !!id && (!people || people.has(id));
  const personId = w.personId && inScope(w.personId) ? w.personId : undefined;
  const scoped = team.filter((t) => inScope(t.ownerId));
  const unseen = new Set<string>();
  const shape = (ts: Task[]) => ts.map((t) => {
    if (seesTask(sight, t)) return t;
    unseen.add(t.id);
    return all ? t : countOnly(t);
  });
  const data = {
    rows: ledgerOf(scoped, w.from, w.to, personId),
    tasks: shape(ledgerTasksOf(scoped, w.from, w.to, personId)),
    prev: shape(ledgerTasksOf(scoped, w.prevFrom, w.prevTo, personId)),
    openNow: shape(scoped.filter((t) => t.statusCategory === 'open' && (!personId || t.ownerId === personId))),
    // Open tasks waiting on someone in view, for their "others waiting on them" count.
    waitingOn: shape(team.filter((t) => t.statusCategory === 'open' && inScope(t.blocked?.onId))),
  };
  return { all, people, ...data, countOnly: all ? [] : [...unseen], noLink: all ? [...unseen] : [] };
}
