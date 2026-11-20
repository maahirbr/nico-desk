import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from '../lib/db';
import { ApiError } from '../lib/errors';
import { assertStillOpen, reminderDrafts } from '../lib/reminders';
import { TEAM_ID } from '../lib/seed';
import { closeTask, teamTasks } from '../lib/service';
import { SEE_ALL } from '../lib/sight';

// Reminders follow live data (20 Nov): an archived project's tasks are out, and a send stops when a task was finished since.
const AS_OF = '2026-10-09';
let db: Db;
beforeEach(async () => { process.env.NICO_TODAY = AS_OF; db = await openDb(); });
const draftKeys = async () => (await reminderDrafts(db, TEAM_ID, { mode: 'window', days: 14, sight: SEE_ALL }, 'x', AS_OF)).drafts.flatMap((d) => d.items.map((i) => i.key));

describe('reminders and live data', () => {
  it('leaves out the tasks of an archived project', async () => {
    const before = await draftKeys();
    const inIt = before.filter((k) => k.startsWith('task:')).map((k) => k.slice(5));
    const pick = (await teamTasks(db, TEAM_ID, AS_OF)).find((x) => x.projectId && inIt.includes(x.id))!;
    expect(pick).toBeTruthy();
    await db.query(`UPDATE projects SET archived_at = now() WHERE id = $1`, [pick.projectId]);
    const after = await draftKeys();
    expect(after).not.toContain(`task:${pick.id}`);
  });
  it('stops a send when a task in it was finished since the page opened', async () => {
    const keys = (await draftKeys()).filter((k) => k.startsWith('task:'));
    await expect(assertStillOpen(db, keys)).resolves.toBeUndefined();
    const t = (await teamTasks(db, TEAM_ID, AS_OF)).find((x) => x.id === keys[0].slice(5))!;
    await closeTask(db, t.ownerId, t.id, { version: t.version, as: 'done' });
    const err = await assertStillOpen(db, keys).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).message).toContain('is done now');
  });
});
