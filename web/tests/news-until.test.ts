import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from '../lib/db';
import { newsFor } from '../lib/news';

// What's new dates (24 Nov, the PM's call): Personal shows through Friday 27 Nov; Key documents from Monday 30 Nov to
// Friday 4 Dec. One note at a time, so they never stack.
let db: Db;
beforeEach(async () => { db = await openDb(); });
afterEach(() => { process.env.NICO_TODAY = '2026-10-09'; });
const on = async (day: string) => { process.env.NICO_TODAY = day; return (await newsFor(db, 'per_bo'))?.id ?? null; };

describe("What's new by date", () => {
  it('shows Personal through Friday, nothing over the weekend, Key documents Monday to Friday', async () => {
    expect(await on('2026-11-27')).toBe('personal-13nov');
    expect(await on('2026-11-28')).toBeNull();
    expect(await on('2026-11-29')).toBeNull();
    expect(await on('2026-11-30')).toBe('keydocs-24nov');
    expect(await on('2026-12-04')).toBe('keydocs-24nov');
    expect(await on('2026-12-05')).toBeNull();
  });
});
