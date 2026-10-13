import type { Tx } from './db';
import type { Task } from './derive';
import { isLeadOrAdmin } from './roles';

// Who sees which projects (13 Oct, docs/VISIBILITY-PLAN.md). A lead, an admin or an unrestricted person sees the
// whole team. A restricted person (people.restricted) sees the projects they own, lead, are on or may view
// (project_viewers), and every task in those. Outside them they see a task only when they own it, it waits on them,
// or, with no project, they created it. Callers pass me.person, so View as shows exactly what that person sees.
export type Sight = { all: true } | { all: false; personId: string; projects: Set<string> };
export const SEE_ALL: Sight = { all: true };

export async function sightOf(db: Tx, teamId: string, personId: string): Promise<Sight> {
  const { rows } = await db.query<{ restricted: boolean; app_role: string }>(
    `SELECT p.restricted, m.app_role FROM people p JOIN team_members m ON m.person_id = p.id
     WHERE m.team_id = $1 AND p.id = $2 AND p.active`, [teamId, personId]);
  // Not an active member of this team: nothing.
  if (rows.length === 0) return { all: false, personId, projects: new Set() };
  if (!rows[0].restricted || isLeadOrAdmin(rows.map((r) => r.app_role))) return SEE_ALL;
  const { rows: ps } = await db.query<{ id: string }>(
    `SELECT id FROM projects WHERE team_id = $1 AND (owner_id = $2 OR lead_id = $2)
     UNION SELECT m.project_id FROM project_members m JOIN projects pr ON pr.id = m.project_id WHERE pr.team_id = $1 AND m.person_id = $2
     UNION SELECT v.project_id FROM project_viewers v JOIN projects pr ON pr.id = v.project_id WHERE pr.team_id = $1 AND v.person_id = $2`,
    [teamId, personId]);
  return { all: false, personId, projects: new Set(ps.map((r) => r.id)) };
}

export const seesProject = (s: Sight, id: string | null | undefined): boolean => s.all || (!!id && s.projects.has(id));

export type TaskSightFields = Pick<Task, 'projectId' | 'ownerId' | 'createdBy'> & { blocked: { onId: string | null } | null };

export function seesTask(s: Sight, t: TaskSightFields): boolean {
  if (s.all || t.ownerId === s.personId || t.blocked?.onId === s.personId) return true;
  return t.projectId ? s.projects.has(t.projectId) : t.createdBy === s.personId;
}

// The same test on a raw tasks row, for queries that join tasks (notices, a person's recent log).
export const seesTaskRow = (s: Sight, r: { project_id: string | null; owner_id: string; created_by: string | null; blocked_on_id: string | null }) =>
  seesTask(s, { projectId: r.project_id, ownerId: r.owner_id, createdBy: r.created_by, blocked: { onId: r.blocked_on_id } });
