import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fixturesDir, openDb, parsers, type Db } from '../lib/db';
import { openRemote, type RemoteDb } from '../lib/pgRemote';
import { SCHEMA } from '../lib/schema';
import { seed, TEAM_ID } from '../lib/seed';
import * as s from '../lib/service';

// The hosted path (lib/pgRemote.ts, postgres-js) against a PGlite served over a local TCP socket, so
// no Supabase is needed. It runs the same service calls as the local path and compares the results.
// Not covered: TLS, the real transaction pooler (Supavisor), network latency, concurrent connections.
const AS_OF = '2026-10-09';
const LEAD = 'per_ada';

async function start() {
  const pg = new PGlite({ parsers });
  await pg.waitReady;
  await pg.exec(SCHEMA);
  await seed(pg, fixturesDir());
  const server = new PGLiteSocketServer({ db: pg, port: 0, host: '127.0.0.1', maxConnections: 3 });
  await server.start();
  const remote = openRemote(`postgres://postgres:postgres@${server.getServerConn()}/postgres`);
  await remote.query('SELECT 1'); // fails here, not in a test, if postgres-js cannot talk to the socket
  return { server, pg, remote };
}

const ctx = await start().catch((e) => {
  console.warn('pg-adapter tests skipped, socket server could not start:', e instanceof Error ? e.message : e);
  return null;
});

describe.skipIf(!ctx)('postgres-js adapter over a PGlite socket', () => {
  const remote = ctx?.remote as RemoteDb;
  let local: Db;

  beforeAll(async () => {
    process.env.NICO_TODAY = AS_OF;
    local = await openDb(); // the same seed, in-process
  });
  afterAll(async () => {
    await ctx?.remote.end();
    await ctx?.server.stop();
    await ctx?.pg.close();
  });

  it('reads the fixtures exactly as the local path does', async () => {
    expect(await s.teamTasks(remote, TEAM_ID, AS_OF)).toEqual(await s.teamTasks(local, TEAM_ID, AS_OF)); // ANY($1) array param, dates, timestamptz
    expect(await s.ledger(remote, TEAM_ID, '2026-01-05', '2026-12-28', undefined, AS_OF)).toEqual(await s.ledger(local, TEAM_ID, '2026-01-05', '2026-12-28', undefined, AS_OF));
  });

  it('gives the same value shapes as PGlite', async () => {
    const q = `SELECT 1::int8 AS big, 1.5::numeric AS num, 7::int AS small, true AS b, '{"a":[1]}'::jsonb AS j,
                      DATE '2026-10-09' AS d, TIMESTAMPTZ '2026-10-09 12:34:56.789+00' AS ts, 'x'::text AS t, NULL::text AS nul`;
    const [a] = (await remote.query(q)).rows;
    const [b] = (await local.query(q)).rows;
    expect(a).toEqual(b);
    expect(a).toEqual({ big: 1, num: '1.5', small: 7, b: true, j: { a: [1] }, d: '2026-10-09', ts: '2026-10-09T12:34:56.789Z', t: 'x', nul: null });
  });

  it('creates and edits a task, writing the event log', async () => {
    const t = await s.createTask(remote, LEAD, { teamId: TEAM_ID, title: 'Adapter task', ownerId: 'per_bo', dueOn: '2026-10-20' });
    expect([t.firstDueOn, t.dueOn, t.health]).toEqual(['2026-10-20', '2026-10-20', 'not_started']);
    const r = await s.renegotiate(remote, 'per_bo', t.id, { version: t.version, newDueOn: '2026-10-30', reason: 'Waiting on supplier quotes.' });
    expect([r.dueOn, r.firstDueOn, r.version]).toEqual(['2026-10-30', '2026-10-20', t.version + 1]);
    const log = await s.taskLog(remote, t.id);
    expect(log[0]).toMatchObject({ field: 'due_on', after: '2026-10-30', reason: 'Waiting on supplier quotes.' });
    expect(typeof log[0].at).toBe('string');
  });

  it('keeps the database rules: locked first date, stale versions, append-only events', async () => {
    await expect(remote.query(`UPDATE tasks SET first_due_on = '2030-01-01' WHERE id = 'tsk_001'`)).rejects.toThrow(/locked/);
    await expect(remote.query(`DELETE FROM events WHERE entity_id = 'tsk_001'`)).rejects.toThrow(/append-only/);
    const [t] = (await s.teamTasks(remote, TEAM_ID, AS_OF)).filter((x) => x.statusCategory === 'open' && x.origin === 'app');
    await expect(s.setHealth(remote, t.ownerId, t.id, { version: t.version + 1, health: 'on_track' })).rejects.toMatchObject({ status: 409 });
  });

  it('commits a transaction and rolls one back', async () => {
    const before = (await remote.query<{ n: number }>(`SELECT count(*)::int AS n FROM teams`)).rows[0].n;
    await remote.transaction(async (tx) => {
      await tx.query(`INSERT INTO teams VALUES ($1, $2, 'run')`, ['team_tx_ok', 'Committed']);
      await tx.exec(`UPDATE teams SET name = 'Committed twice' WHERE id = 'team_tx_ok'`);
    });
    await expect(
      remote.transaction(async (tx) => {
        await tx.query(`INSERT INTO teams VALUES ($1, $2, 'run')`, ['team_tx_no', 'Rolled back']);
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    const rows = (await remote.query<{ id: string; name: string }>(`SELECT id, name FROM teams WHERE id LIKE 'team_tx_%'`)).rows;
    expect(rows).toEqual([{ id: 'team_tx_ok', name: 'Committed twice' }]);
    expect((await remote.query<{ n: number }>(`SELECT count(*)::int AS n FROM teams`)).rows[0].n).toBe(before + 1);
  });

  it('reports affectedRows for writes, as the notice flow needs', async () => {
    expect(await s.runReminders(remote, AS_OF)).toBeGreaterThan(0); // INSERT ... ON CONFLICT DO NOTHING counts in a transaction
    expect(await s.runReminders(remote, AS_OF)).toBe(0);
    const notices = await s.listNotices(remote, (await remote.query<{ person_id: string }>(`SELECT person_id FROM notices LIMIT 1`)).rows[0].person_id, true);
    expect(notices.length).toBeGreaterThan(0);
    const n = notices[0];
    const owner = (await remote.query<{ person_id: string }>(`SELECT person_id FROM notices WHERE id = $1`, [n.id])).rows[0].person_id;
    await s.markNoticeRead(remote, owner, n.id);
    const again = await remote.query(`UPDATE notices SET read_at = now() WHERE id = $1 AND read_at IS NULL`, [n.id]);
    expect(again.affectedRows).toBe(0);
    const sel = await remote.query(`SELECT * FROM notices WHERE id = $1`, [n.id]);
    expect([sel.rows.length, sel.affectedRows]).toEqual([1, 0]); // PGlite says 0 for a SELECT, so does the adapter
    await expect(s.markNoticeRead(remote, owner, 'ntc_missing')).rejects.toMatchObject({ status: 404 });
  });

  it('passes JSON strings and undefined params through', async () => {
    const { rows } = await remote.query<{ j: unknown; n: string | null }>(`SELECT $1::jsonb AS j, $2::text AS n`, [JSON.stringify({ k: ['v'] }), undefined]);
    expect(rows[0]).toEqual({ j: { k: ['v'] }, n: null });
  });
});
