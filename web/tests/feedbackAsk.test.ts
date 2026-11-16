import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from '../lib/db';
import { FEEDBACK_ASK, feedbackAskFor } from '../lib/feedbackAsk';
import { TEAM_ID } from '../lib/seed';

// The feedback ask (15 Nov): shown until the person shares one note in the window; an admin sees the count.
let db: Db;
beforeEach(async () => { db = await openDb(); });
const day = FEEDBACK_ASK.since;

describe('the feedback ask', () => {
  it('shows in its window only, and goes once the person has shared', async () => {
    expect(await feedbackAskFor(db, 'per_cy', TEAM_ID, '2026-11-01', false)).toBeNull();
    expect(await feedbackAskFor(db, 'per_cy', TEAM_ID, FEEDBACK_ASK.until.replace(/\d\d$/, (d) => String(Number(d) + 1).padStart(2, '0')), false)).toBeNull();
    expect((await feedbackAskFor(db, 'per_cy', TEAM_ID, day, false))?.open).toBe(true);
    await db.query(`INSERT INTO feedback (id, person_id, body, created_at) VALUES ('fb_t1', 'per_cy', 'Love the Personal page', $1::timestamptz)`, [`${day}T10:00:00+05:30`]);
    const after = await feedbackAskFor(db, 'per_cy', TEAM_ID, day, false);
    expect(after?.open).toBe(false); // answered: the card turns into the count only
    expect(after?.shared).toBe(1); // everyone sees the count
    expect(after?.notYet).toEqual([]); // only an admin sees who has not
    const admin = await feedbackAskFor(db, 'per_fay', TEAM_ID, day, true);
    expect(admin?.shared).toBe(1);
    expect(admin!.of).toBeGreaterThan(1);
    expect(admin!.notYet.length).toBe(admin!.of! - 1);
  });
});
