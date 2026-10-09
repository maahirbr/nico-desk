import { afterEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from '../lib/db';
import { reseed, reseedDue } from '../lib/reseed';

const pinned = process.env.NICO_TODAY;
afterEach(() => {
  process.env.NICO_TODAY = pinned;
});

describe('reseedDue', () => {
  it('follows the week the data was seeded for', async () => {
    const db: Db = await openDb();
    expect(await reseedDue(db)).toBe(false);

    process.env.NICO_TODAY = '2026-10-11'; // same Mon-Sun week
    expect(await reseedDue(db)).toBe(false);

    process.env.NICO_TODAY = '2026-10-16'; // next week
    expect(await reseedDue(db)).toBe(true);
    await db.transaction((tx) => reseed(tx));
    expect(await reseedDue(db)).toBe(false);

    process.env.NICO_TODAY = '2026-10-18'; // still that week
    expect(await reseedDue(db)).toBe(false);
  });

  it('is due when the task row is missing', async () => {
    const db: Db = await openDb();
    await db.exec(`TRUNCATE tasks CASCADE`);
    expect(await reseedDue(db)).toBe(true);
  });
});
