import { beforeEach, describe, expect, it } from 'vitest';
import { sumInteractions, teamAdoption } from '../lib/activity';
import { openDb, type Db } from '../lib/db';
import { TEAM_ID } from '../lib/seed';
import * as s from '../lib/service';

// Interactions on Activity (4 Nov): one count per action in the last 7 days, tasks made together count once, and the
// breakdown names each kind, the biggest first.
const ME = 'per_cy';
let db: Db;
beforeEach(async () => { process.env.NICO_TODAY = '2026-10-09'; db = await openDb(); });

describe('interactions', () => {
  it('counts each action once, and tasks created together once', async () => {
    const before = (await teamAdoption(db, TEAM_ID)).find((r) => r.id === ME)!.interactions.total;
    const made = [];
    for (const title of ['Shoot the flat-lays', 'Write the gifting FAQ', 'Book the studio']) {
      made.push(await s.createTask(db, ME, { teamId: TEAM_ID, title, ownerId: ME, dueOn: '2026-10-20' }));
    }
    await s.addUpdate(db, ME, made[0].id, 'Studio booked for Friday');
    await s.setHealth(db, ME, made[1].id, { version: made[1].version, health: 'on_track' }); // one action, one count
    const row = (await teamAdoption(db, TEAM_ID)).find((r) => r.id === ME)!;
    expect(row.interactions.total - before).toBe(3);
    const words = row.interactions.parts.map(([w]) => w).join(' | ');
    expect(words).toMatch(/update/);
    expect(words).toMatch(/status change/);
  });

  it('words each kind and puts the biggest first', () => {
    expect(sumInteractions({ updates: 6, status: 4, created: 1 })).toEqual({ total: 11, parts: [['updates written', 6], ['status changes', 4], ['task created', 1]] });
    expect(sumInteractions({})).toEqual({ total: 0, parts: [] });
  });
});
