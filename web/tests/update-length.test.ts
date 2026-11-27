import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from '../lib/db';
import { ApiError } from '../lib/errors';
import { TEAM_ID } from '../lib/seed';
import * as s from '../lib/service';

// A task update holds up to 400 characters (24 Nov, the PM's call).
let db: Db;
beforeAll(() => { process.env.NICO_TODAY = '2026-10-09'; });
beforeEach(async () => { db = await openDb(); });
const code = async (p: Promise<unknown>) => p.then(() => 'ok', (e) => (e instanceof ApiError ? `${e.status}` : (() => { throw e; })()));

describe('a task update', () => {
  it('takes 400 characters and refuses 401', async () => {
    const t = await s.createTask(db, 'per_ada', { teamId: TEAM_ID, title: 'Write the brief', ownerId: 'per_ada', dueOn: '2026-10-20' });
    expect(await code(s.addUpdate(db, 'per_ada', t.id, 'x'.repeat(400)))).toBe('ok');
    expect(await code(s.addUpdate(db, 'per_ada', t.id, 'x'.repeat(401)))).toBe('400');
  });
});
