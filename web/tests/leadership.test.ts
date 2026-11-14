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
