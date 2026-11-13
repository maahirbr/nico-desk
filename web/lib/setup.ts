import type { Me } from './auth';
import type { Tx } from './db';
import { getProject } from './plan';
import { isLeadOrAdmin } from './roles';

// The setup check-list on a project page (19 Oct). Every step is ticked from data the app already holds, so nothing
// is stored to mark one done. Since 13 Nov (the PM's call) the steps are the people, the first work, a date and, on a
// partner project, the partner: bringing in minutes and the meeting rhythm are no longer setup steps.
// The list is for projects made from the day it shipped. Older projects were set up without it, and showing it on
// them would ask every lead to set up work that is already running (the repo owner, 20 Oct). A project's make time is
// its '_created' event, which createProject writes. Seeded and loaded projects made before this never show it.
export const SETUP_SINCE = '2026-10-20T00:00:00+05:30';

export type SetupKey = 'members' | 'work' | 'date' | 'partner';
export type SetupAction = 'settings' | 'add';
export type SetupStep = { key: SetupKey; done: boolean; title: string; hint: string; button: string; action: SetupAction };

export type SetupInput = {
  kind: 'tasks' | 'plan';
  hasMembers: boolean; // someone besides the owner and the lead is on the project
  hasWork: boolean; // a task, or a plan line on a plan board
  hasDate: boolean; // the project's date (due, end, launch…) is set
  partnerName: string | null;
};

// The partner name a new plan board starts with. It counts as "not named yet".
const DEFAULT_PARTNER = 'Partner';

export function setupSteps(i: SetupInput): SetupStep[] {
  const plan = i.kind === 'plan';
  const steps: SetupStep[] = [
    { key: 'members', done: i.hasMembers, title: 'Add the people who work on it', hint: 'Members see the project and get its tasks.', button: 'Add people', action: 'settings' },
    {
      key: 'work', done: i.hasWork, action: 'add',
      title: plan ? 'Add the first lines' : 'Add the first tasks',
      hint: plan ? 'A line is one piece of the plan with a date.' : 'Each task has one owner and a date.',
      button: plan ? 'Add a line' : 'Add a task',
    },
  ];
  steps.push({ key: 'date', done: i.hasDate, action: 'settings', title: 'Set a date', button: 'Set the date',
    hint: 'The date the project is working to. It is what At risk and Late are measured against.' });
  if (plan || i.partnerName) {
    const named = !!i.partnerName?.trim() && i.partnerName.trim() !== DEFAULT_PARTNER;
    steps.push({ key: 'partner', done: named, title: 'Name the partner', hint: "The partner's people show beside yours on the plan.", button: 'Name the partner', action: 'settings' });
  }
  return steps;
}

// Who may see the list: the project's owner or lead, a team lead, an admin. Nobody sees it on an archived project,
// or on a project made before SETUP_SINCE.
// It reads only. Opening a project page never writes a row.
export async function setupState(db: Tx, me: Me, projectId: string): Promise<SetupStep[] | null> {
  const p = await getProject(db, projectId);
  if (p.archivedAt || p.teamId !== me.team.id) return null;
  const mine = p.ownerId === me.person.id || p.leadId === me.person.id || isLeadOrAdmin(me.person.appRoles);
  if (!mine) return null;
  const { rows: made } = await db.query(
    `SELECT 1 FROM events WHERE entity_type = 'project' AND entity_id = $1 AND field = '_created' AND at >= $2::timestamptz LIMIT 1`,
    [projectId, SETUP_SINCE],
  );
  if (!made.length) return null;
  const n = async (sql: string, args: unknown[] = [projectId]): Promise<number> => (await db.query<{ n: number }>(sql, args)).rows[0]?.n ?? 0;
  const plan = p.kind === 'plan';
  const [members, work] = await Promise.all([
    n(`SELECT count(*)::int AS n FROM project_members WHERE project_id = $1 AND person_id <> $2 AND person_id <> $3`, [projectId, p.ownerId ?? '', p.leadId ?? '']),
    n(plan
      ? `SELECT count(*)::int AS n FROM plan_lines WHERE project_id = $1 AND NOT removed`
      : `SELECT count(*)::int AS n FROM tasks WHERE project_id = $1`),
  ]);
  return setupSteps({
    kind: p.kind, hasMembers: members > 0, hasWork: work > 0, hasDate: !!p.launchOn, partnerName: p.partnerName,
  });
}
