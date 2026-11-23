import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Me } from '../lib/auth';
import { openDb, type Db } from '../lib/db';
import { ApiError } from '../lib/errors';
import { sendFeedback, addReplyImage, getReplyImage, listFeedback, replyFeedback } from '../lib/feedback';
import { TEAM_ID } from '../lib/seed';
import * as s from '../lib/service';

// Screenshots on a feedback reply (23 Nov): its writer adds up to three; anyone who reads the note sees them.
const WRITER = 'per_ada', REPLIER = 'per_bo';
let db: Db;
beforeAll(() => { process.env.NICO_TODAY = '2026-10-09'; });
beforeEach(async () => { db = await openDb(); });
const meAs = async (id: string): Promise<Me> => {
  const person = (await s.listPeople(db, TEAM_ID)).find((p) => p.id === id)!;
  return { person, realPerson: person, viewingAs: false, team: { id: TEAM_ID, name: 'Team', teamType: 'department' } } as Me;
};
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const code = async (p: Promise<unknown>) => p.then(() => 'ok', (e) => (e instanceof ApiError ? `${e.status}` : (() => { throw e; })()));

describe('screenshots on a feedback reply', () => {
  it('lets the reply writer add them, refuses others, and shows the count in the thread', async () => {
    const note = await sendFeedback(db, await meAs(WRITER), { body: 'The board is slow to load', path: '/team' });
    const { id: rid } = await replyFeedback(db, await meAs(REPLIER), note.id, 'Fixed, here is how it looks');
    expect(await addReplyImage(db, await meAs(REPLIER), note.id, rid, PNG, 'image/png')).toEqual({ n: 1 });
    expect(await code(addReplyImage(db, await meAs(WRITER), note.id, rid, PNG, 'image/png'))).toBe('403');
    expect((await getReplyImage(db, await meAs(WRITER), note.id, rid, 1))?.mime).toBe('image/png');
    const row = (await listFeedback(db, await meAs(WRITER))).find((r) => r.id === note.id)!;
    expect(row.replies[0].images).toBe(1);
  });
});
