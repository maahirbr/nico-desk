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

  // No fixture marker task means a real pilot was loaded (drop_samples): never wipe it.
  it('is not due when the fixture marker task is missing', async () => {
    const db: Db = await openDb();
    await db.exec(`TRUNCATE tasks CASCADE`);
    expect(await reseedDue(db)).toBe(false);
  });
});

// The Supabase Data API path (audit 13 Oct, 4.3). PGlite has no anon role, so the lock skips; with the roles made
// here it takes their rights and adds the deny policy on every table, and running it twice is safe.
describe('public API lock', () => {
  it('skips where the API roles do not exist', async () => {
    const db: Db = await openDb();
    const { rows } = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM pg_policies WHERE policyname = 'deny_public_api'`);
    expect(rows[0].n).toBe(0);
  });

  it('takes every right from anon and authenticated, and denies them on every table', async () => {
    const { upgrade } = await import('../lib/db');
    const db: Db = await openDb();
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
      GRANT USAGE ON SCHEMA public TO anon, authenticated; GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;`);
    await upgrade(db);
    await upgrade(db);
    const tables = await db.query<{ t: string }>(`SELECT tablename AS t FROM pg_tables WHERE schemaname = 'public'`);
    const denied = await db.query<{ t: string }>(`SELECT tablename AS t FROM pg_policies WHERE policyname = 'deny_public_api' AND permissive = 'RESTRICTIVE'`);
    expect(denied.rows.map((r) => r.t).sort()).toEqual(tables.rows.map((r) => r.t).sort());
    const open = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM pg_class c JOIN pg_namespace s ON s.oid = c.relnamespace
      WHERE s.nspname = 'public' AND c.relkind = 'r' AND (has_table_privilege('anon', c.oid, 'SELECT') OR has_table_privilege('authenticated', c.oid, 'INSERT'))`);
    expect(open.rows[0].n).toBe(0);
    // The explicit grant is gone. USAGE through PUBLIC stays (Supabase's own roles need it); it opens no table.
    const acl = await db.query<{ a: string }>(`SELECT coalesce(nspacl::text, '') AS a FROM pg_namespace WHERE nspname = 'public'`);
    expect(acl.rows[0].a).not.toMatch(/anon=|authenticated=/);
    await db.transaction((tx) => reseed(tx)); // reseed recreates the tables and locks them again
    const again = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM pg_policies WHERE policyname = 'deny_public_api'`);
    expect(again.rows[0].n).toBe(tables.rows.length);
  });
});
