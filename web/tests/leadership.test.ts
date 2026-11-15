import { beforeEach, describe, expect, it } from 'vitest';
import { mayReadActivity } from '../lib/activity';
import { openDb, type Db } from '../lib/db';
import { ApiError } from '../lib/errors';
import { mayRemind } from '../lib/reminders';
import { isLeadOrAdmin, mayOversee } from '../lib/roles';
import { TEAM_ID } from '../lib/seed';
import * as s from '../lib/service';
import { seesProject, sightOf } from '../lib/sight';

// Leadership (15 Nov): oversight and follow-up. Reminders to anyone, Activity, the team's meeting keys; no extra power
// over tasks and no wider view of projects. The team Lead role is retired: it can no longer be given.
let db: Db;
beforeEach(async () => { process.env.NICO_TODAY = '2026-10-09'; db = await openDb(); });

describe('Leadership', () => {
  it('may remind and read Activity, but has no lead power over tasks', () => {
    expect(mayOversee(['member', 'leadership'])).toBe(true);
    expect(mayOversee(['member'])).toBe(false);
    expect(isLeadOrAdmin(['member', 'leadership'])).toBe(false);
    expect(() => mayRemind(['member', 'leadership'])).not.toThrow();
    expect(() => mayRemind(['member'])).toThrow(ApiError);
    const me = (roles: string[]) => ({ person: { appRoles: roles, email: 'x@example.test' } }) as never;
    expect(mayReadActivity(me(['member', 'leadership']))).toBe(true);
    expect(mayReadActivity(me(['member']))).toBe(false);
  });

  it('is stored as a role, and does not open projects they are not on', async () => {
    const { rows: [m] } = await db.query<{ person_id: string }>(
      `SELECT person_id FROM team_members t WHERE team_id = $1 AND app_role = 'member'
         AND NOT EXISTS (SELECT 1 FROM team_members a WHERE a.person_id = t.person_id AND a.app_role IN ('lead','admin')) LIMIT 1`, [TEAM_ID]);
    const admin = (await db.query<{ person_id: string }>(`SELECT person_id FROM team_members WHERE team_id = $1 AND app_role = 'admin' LIMIT 1`, [TEAM_ID])).rows[0].person_id;
    await s.patchPerson(db, admin, TEAM_ID, m.person_id, { appRoles: ['leadership'] });
    const p = (await s.listPeople(db, TEAM_ID)).find((x) => x.id === m.person_id)!;
    expect(p.appRoles).toContain('leadership');
    const sight = await sightOf(db, TEAM_ID, m.person_id);
    expect(sight.all).toBe(false);
    const { rows: all } = await db.query<{ id: string }>(`SELECT id FROM projects WHERE team_id = $1 AND personal_for IS NULL`, [TEAM_ID]);
    expect(all.every((x) => seesProject(sight, x.id))).toBe(false);
  });
});

describe('Leadership on a person page (15 Nov)', () => {
  it('sees all of that person’s open work, even on projects they are not on; a member does not', async () => {
    const { rows: [t] } = await db.query<{ owner_id: string; project_id: string }>(
      `SELECT owner_id, project_id FROM tasks WHERE team_id = $1 AND status_category = 'open' AND project_id IS NOT NULL AND owner_id IS NOT NULL LIMIT 1`, [TEAM_ID]);
    const { rows: [out] } = await db.query<{ id: string }>(
      `SELECT p.id FROM people p JOIN team_members m ON m.person_id = p.id AND m.team_id = $1
        WHERE p.active AND m.app_role = 'member' AND p.id <> $2
          AND NOT EXISTS (SELECT 1 FROM team_members a WHERE a.person_id = p.id AND a.app_role IN ('lead','admin','leadership'))
          AND NOT EXISTS (SELECT 1 FROM project_members x WHERE x.project_id = $3 AND x.person_id = p.id)
          AND NOT EXISTS (SELECT 1 FROM project_viewers v WHERE v.project_id = $3 AND v.person_id = p.id)
          AND NOT EXISTS (SELECT 1 FROM projects pr WHERE pr.id = $3 AND (pr.owner_id = p.id OR pr.lead_id = p.id)) LIMIT 1`, [TEAM_ID, t.owner_id, t.project_id]);
    if (!out) return; // the fixtures have no one outside that project
    const asMember = await s.personView(db, TEAM_ID, out.id, t.owner_id);
    expect(asMember.open.some((x) => x.projectId === t.project_id)).toBe(false);
    expect(asMember.record).toBeNull();
    const admin = (await db.query<{ person_id: string }>(`SELECT person_id FROM team_members WHERE team_id = $1 AND app_role = 'admin' LIMIT 1`, [TEAM_ID])).rows[0].person_id;
    await s.patchPerson(db, admin, TEAM_ID, out.id, { appRoles: ['leadership'] });
    const asLeadership = await s.personView(db, TEAM_ID, out.id, t.owner_id);
    expect(asLeadership.open.some((x) => x.projectId === t.project_id)).toBe(true);
    expect(asLeadership.record).not.toBeNull();
  });
});
