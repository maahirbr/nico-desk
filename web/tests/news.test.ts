import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from '../lib/db';
import { ApiError } from '../lib/errors';
import { markNewsSeen, NEWS, newsFor } from '../lib/news';
import { TEAM_ID } from '../lib/seed';

// What's new (13 Nov): the note shows on Home until Got it, which holds per person; a lead sees how many have pressed it.
let db: Db;
beforeEach(async () => { process.env.NICO_TODAY = '2026-10-09'; db = await openDb(); });

describe("What's new", () => {
  it('shows until Got it, for that person only', async () => {
    expect(NEWS).not.toBeNull();
    expect(await newsFor(db, 'per_cy')).toEqual(NEWS);
    await markNewsSeen(db, 'per_cy', NEWS!.id);
    await markNewsSeen(db, 'per_cy', NEWS!.id); // twice is fine
    expect(await newsFor(db, 'per_cy')).toBeNull();
    expect(await newsFor(db, 'per_ada')).toEqual(NEWS); // someone else still sees it
    await expect(markNewsSeen(db, 'per_cy', 'old-note')).rejects.toBeInstanceOf(ApiError);
  });
});
