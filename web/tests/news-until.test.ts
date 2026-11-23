import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from '../lib/db';
import { newsFor } from '../lib/news';

// The Personal note closes itself on 1 Dec (24 Nov, the PM's call), Got it or not.
let db: Db;
beforeEach(async () => { db = await openDb(); });
afterEach(() => { process.env.NICO_TODAY = '2026-10-09'; });

describe('a What\'s new note with an end date', () => {
  it('shows until 30 Nov and is gone from 1 Dec', async () => {
    process.env.NICO_TODAY = '2026-11-30';
    expect((await newsFor(db, 'per_bo'))?.id).toBe('personal-13nov');
    process.env.NICO_TODAY = '2026-12-01';
    expect(await newsFor(db, 'per_bo')).toBeNull();
  });
});
