import type { Me } from './auth';
import type { Tx } from './db';
import { forbidden, notFound } from './errors';
import { sameTeam } from './http';
import { getProject, teamProjects, type Project } from './plan';
import { getTask, teamTasks } from './service';
import { seesProject, seesTask, sightOf, type Sight } from './sight';
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
