import { beforeEach, describe, expect, it } from 'vitest';
import { resolveMe } from '../lib/auth';
import { openDb, type Db } from '../lib/db';
import { ApiError } from '../lib/errors';
import { TEAM_ID } from '../lib/seed';
import * as s from '../lib/service';

// Priority and order in Personal (20 Nov, from a teammate's ask): P1/P2/P3 on your own Personal tasks, optional, and the
// order you set within them. Only you.
let db: Db;
beforeEach(async () => { process.env.NICO_TODAY = '2026-10-09'; db = await openDb(); });
const ME = 'per_bo', OTHER = 'per_cy';
const code = async (p: Promise<unknown>) => p.then(() => 'ok', (e) => (e instanceof ApiError ? `${e.status}` : (() => { throw e; })()));

describe('priority in Personal', () => {
  it('takes P1 when added, changes and clears, and only for its person', async () => {
    const pid = await s.ensurePersonalProject(db, TEAM_ID, ME);
    const t = await s.createTask(db, ME, { teamId: TEAM_ID, title: 'Call the bank', ownerId: ME, dueOn: '2026-10-12', projectId: pid, priority: 'high' });
    expect(t.priority?.value).toBe('high');
    const none = await s.createTask(db, ME, { teamId: TEAM_ID, title: 'Read the brief', ownerId: ME, dueOn: '2026-10-12', projectId: pid });
    expect(none.priority).toBeNull(); // nothing by default
    const p2 = await s.setPriority(db, ME, t.id, { version: t.version, value: 'normal' });
    expect(p2.priority?.value).toBe('normal');
    const cleared = await s.setPriority(db, ME, t.id, { version: p2.version, value: null });
    expect(cleared.priority).toBeNull();
    expect(await code(s.setPriority(db, OTHER, t.id, { version: cleared.version, value: 'high' }))).toBe('403');
  });
  it('keeps the order its person sets, and refuses anyone else', async () => {
    const pid = await s.ensurePersonalProject(db, TEAM_ID, ME);
    const a = await s.createTask(db, ME, { teamId: TEAM_ID, title: 'First thing', ownerId: ME, dueOn: '2026-10-12', projectId: pid });
    const b = await s.createTask(db, ME, { teamId: TEAM_ID, title: 'Second thing', ownerId: ME, dueOn: '2026-10-12', projectId: pid });
    await s.orderPersonal(db, ME, pid, [b.id, a.id]);
    expect([(await s.getTask(db, b.id)).personalOrder, (await s.getTask(db, a.id)).personalOrder]).toEqual([0, 1]);
    expect(await code(s.orderPersonal(db, OTHER, pid, [a.id, b.id]))).toBe('403');
    expect((await resolveMe(db, ME))?.person.id).toBe(ME);
  });
});
