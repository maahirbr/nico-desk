import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from '../lib/db';
import { ApiError } from '../lib/errors';
import { assertItemsInProjects, assertMayRemind, assertTeamRecipients, mayRemindAny, reminderDrafts, remindAccess } from '../lib/reminders';
import { TEAM_ID } from '../lib/seed';
import { SEE_ALL, sightOf } from '../lib/sight';

// A project's owner or lead sends reminders for the projects they own or lead, whatever their access level (27 Nov,
// the PM's call). Leadership, leads and admins keep every project; a member who heads nothing still cannot.
const AS_OF = '2026-10-09';
let db: Db;
beforeEach(async () => { process.env.NICO_TODAY = AS_OF; db = await openDb(); });

describe('reminders by project owners and leads', () => {
  it('lets a member who owns or leads a live project remind about that project only', async () => {
    // A plain member (no lead, admin or leadership role) who owns or leads a live project.
    const { rows: [m] } = await db.query<{ person_id: string; project_id: string }>(
      `SELECT t.person_id, p.id AS project_id FROM team_members t JOIN projects p ON p.team_id = t.team_id AND (p.owner_id = t.person_id OR p.lead_id = t.person_id)
        WHERE t.team_id = $1 AND p.archived_at IS NULL AND p.personal_for IS NULL
          AND NOT EXISTS (SELECT 1 FROM team_members a WHERE a.person_id = t.person_id AND a.app_role IN ('lead','admin','leadership')) LIMIT 1`, [TEAM_ID]);
    let memberId = m?.person_id, projectId = m?.project_id;
    if (!m) {
      // No such member in the fixtures: make one the lead of a project.
      const { rows: [x] } = await db.query<{ person_id: string }>(
        `SELECT person_id FROM team_members t WHERE team_id = $1 AND app_role = 'member'
           AND NOT EXISTS (SELECT 1 FROM team_members a WHERE a.person_id = t.person_id AND a.app_role IN ('lead','admin','leadership')) LIMIT 1`, [TEAM_ID]);
      const { rows: [p] } = await db.query<{ id: string }>(`SELECT id FROM projects WHERE team_id = $1 AND archived_at IS NULL AND personal_for IS NULL LIMIT 1`, [TEAM_ID]);
      await db.query(`UPDATE projects SET lead_id = $2 WHERE id = $1`, [p.id, x.person_id]);
      memberId = x.person_id; projectId = p.id;
    }
    const access = await remindAccess(db, TEAM_ID, memberId!, ['member']);
    expect(access.all).toBe(false);
    expect(access.projects.has(projectId!)).toBe(true);
    expect(() => assertMayRemind(access, projectId)).not.toThrow();
    const { rows: [other] } = await db.query<{ id: string }>(
      `SELECT id FROM projects WHERE team_id = $1 AND NOT (id = ANY($2::text[])) LIMIT 1`, [TEAM_ID, [...access.projects]]);
    expect(() => assertMayRemind(access, other.id)).toThrow(ApiError);
    // The drafts cover only the projects they own or lead.
    const sight = await sightOf(db, TEAM_ID, memberId!);
    const { drafts } = await reminderDrafts(db, TEAM_ID, { mode: 'window', days: 30, sight, onlyProjects: access.projects }, 'x', AS_OF);
    const keys = drafts.flatMap((d) => d.items.map((i) => i.key)).filter((k) => k.startsWith('task:'));
    if (keys.length) await expect(assertItemsInProjects(db, keys, access.projects)).resolves.toBeUndefined();
    // A send that sneaks in a task from another project is refused.
    const { rows: [t] } = await db.query<{ id: string }>(`SELECT id FROM tasks WHERE team_id = $1 AND project_id = $2 LIMIT 1`, [TEAM_ID, other.id]);
    if (t) await expect(assertItemsInProjects(db, [`task:${t.id}`], access.projects)).rejects.toThrow(ApiError);
  });

  it('refuses a send with no item or an unknown kind of item, and one that leaves the team', async () => {
    const { rows: [p] } = await db.query<{ id: string }>(`SELECT id FROM projects WHERE team_id = $1 AND archived_at IS NULL AND personal_for IS NULL LIMIT 1`, [TEAM_ID]);
    const mine = new Set([p.id]);
    await expect(assertItemsInProjects(db, [], mine)).rejects.toThrow(ApiError);
    await expect(assertItemsInProjects(db, ['note:anything'], mine)).rejects.toThrow(ApiError);
    const { rows: [a, b] } = await db.query<{ id: string; email: string }>(
      `SELECT p.id, p.email FROM people p WHERE p.id IN (SELECT person_id FROM team_members WHERE team_id = $1) ORDER BY p.id LIMIT 2`, [TEAM_ID]);
    const none: string[] = [];
    await expect(assertTeamRecipients(db, TEAM_ID, a.id, { to: [a.email.toUpperCase()], cc: [b.email], bcc: none })).resolves.toBeUndefined();
    await expect(assertTeamRecipients(db, TEAM_ID, a.id, { to: [b.email], cc: none, bcc: none })).rejects.toThrow(ApiError);
    await expect(assertTeamRecipients(db, TEAM_ID, a.id, { to: ['someone@outside.test'], cc: none, bcc: none })).rejects.toThrow(ApiError);
    await expect(assertTeamRecipients(db, TEAM_ID, a.id, { to: [a.email], cc: none, bcc: ['someone@outside.test'] })).rejects.toThrow(ApiError);
  });

  it('still keeps out a member who owns or leads nothing, and keeps every project for an admin', async () => {
    const none = await remindAccess(db, TEAM_ID, 'per_nobody_heads', ['member']);
    expect(mayRemindAny(none)).toBe(false);
    expect(() => assertMayRemind(none)).toThrow(ApiError);
    const admin = await remindAccess(db, TEAM_ID, 'anyone', ['admin']);
    expect(admin.all).toBe(true);
    expect((await reminderDrafts(db, TEAM_ID, { mode: 'window', days: 30, sight: SEE_ALL }, 'x', AS_OF)).drafts.length).toBeGreaterThan(0);
  });
});
