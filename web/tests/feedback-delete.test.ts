import { beforeEach, describe, expect, it } from 'vitest';
import { resolveMe } from '../lib/auth';
import { openDb, type Db } from '../lib/db';
import { ApiError } from '../lib/errors';
import { deleteFeedback, listFeedback, replyFeedback, sendFeedback, setFeedbackStatus, voteFeedback } from '../lib/feedback';

// Delete a feedback note (19 Nov, the PM's call): the writer or an admin, for good, with its replies and +1s.
let db: Db;
beforeEach(async () => { process.env.NICO_TODAY = '2026-10-09'; db = await openDb(); });
const me = async (id: string) => (await resolveMe(db, id))!;
const code = async (p: Promise<unknown>) => p.then(() => 'ok', (e) => (e instanceof ApiError ? `${e.status}` : (() => { throw e; })()));

describe('deleting a feedback note', () => {
  it('lets the writer delete it, with its replies and +1s, and nobody else but an admin', async () => {
    const writer = await me('per_cy'), other = await me('per_bo'), admin = await me('per_fay');
    const { id } = await sendFeedback(db, writer, { body: 'The date picker is hard to use on a phone.' });
    await replyFeedback(db, other, id, 'Agreed, same here.');
    await voteFeedback(db, other, id, true);
    expect(await code(deleteFeedback(db, other, id))).toBe('403');
    await deleteFeedback(db, writer, id);
    expect((await listFeedback(db, writer)).some((f) => f.id === id)).toBe(false);
    expect((await db.query(`SELECT 1 FROM feedback_replies WHERE feedback_id = $1 UNION ALL SELECT 1 FROM feedback_votes WHERE feedback_id = $1`, [id])).rows).toEqual([]);
    // Not once it is resolved or parked, and never a Working well note.
    const done = await sendFeedback(db, writer, { body: 'Fixed already.' });
    await setFeedbackStatus(db, other, done.id, 'done');
    expect(await code(deleteFeedback(db, writer, done.id))).toBe('400');
    const praise = await sendFeedback(db, writer, { body: 'The board is lovely.', kind: 'praise' });
    expect(await code(deleteFeedback(db, admin, praise.id))).toBe('400');
    const second = await sendFeedback(db, writer, { body: 'Another note.' });
    await deleteFeedback(db, admin, second.id);
    expect((await listFeedback(db, admin)).some((f) => f.id === second.id)).toBe(false);
  });
});
