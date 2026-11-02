import { beforeAll, describe, expect, it, vi } from 'vitest';

// "Added since" on the Team page (28 Oct): a meeting closes by reading back the tasks made since a time. The cutoff is
// India time, every source counts, dropped ones are left out, and a person sees only the tasks they may see.

vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }), headers: async () => new Headers() }));

import type { Me } from '../lib/auth';
import { openDb, type Db } from '../lib/db';
import { addedSince, type Task } from '../lib/derive';
import { TEAM_ID } from '../lib/seed';
import * as s from '../lib/service';
import { seenTasks } from '../lib/visibility';
import { istInstant, istLocal } from '../lib/time';

const ADMIN = 'per_fay';
const DEE = 'per_dee'; // fixtures: a member with no tie to the loyalty tiers project
const HIDDEN = 'prj_tiers';
let db: Db;

beforeAll(async () => { process.env.NICO_TODAY = '2026-10-09'; db = await openDb(); });

async function meAs(id: string): Promise<Me> {
  const person = (await s.listPeople(db, TEAM_ID)).find((p) => p.id === id)!;
  return { person, realPerson: person, viewingAs: false, team: { id: TEAM_ID, name: 'Team', teamType: 'department' } };
}

describe('the cutoff, in India time', () => {
  it('reads a datetime-local value as +05:30, across the UTC day line', () => {
    expect(istInstant('2026-10-28T00:30')!.toISOString()).toBe('2026-10-27T19:00:00.000Z');
    expect(istInstant('2026-10-28T15:00')!.toISOString()).toBe('2026-10-28T09:30:00.000Z');
    expect(istLocal(new Date('2026-10-27T19:00:00Z'))).toBe('2026-10-28T00:30');
    expect(istLocal(istInstant('2026-12-31T23:59')!)).toBe('2026-12-31T23:59');
  });

  it('refuses anything else', () => {
    for (const bad of [undefined, '', '2026-10-28', '2026-10-28T15:00:00', '2026-13-01T10:00', '28/10/2026 10:00', 'x']) {
      expect(istInstant(bad)).toBeNull();
    }
  });
});

describe('addedSince', () => {
  const t = (id: string, createdAt: string, statusCategory: Task['statusCategory'] = 'open') => ({ id, createdAt, statusCategory }) as Task;
  const list = [t('late', '2026-10-28T10:00:00Z'), t('edge', '2026-10-28T09:30:00Z'), t('before', '2026-10-28T09:29:59Z'),
    t('gone', '2026-10-28T09:45:00Z', 'dropped'), t('closed', '2026-10-28T09:40:00Z', 'done')];

  it('keeps tasks made at or after the cutoff, oldest first, done included and dropped left out', () => {
    expect(addedSince(list, istInstant('2026-10-28T15:00')!).map((x) => x.id)).toEqual(['edge', 'closed', 'late']);
  });
});

describe('who sees what', () => {
  it('shows a task added on a hidden project to an admin, not to a member', async () => {
    const before = new Date(Date.now() - 1000);
    const ada = await meAs(ADMIN);
    const all = await s.teamTasks(db, TEAM_ID);
    const hidden = all.find((x) => x.projectId === HIDDEN)!;
    const open = all.find((x) => x.projectId !== HIDDEN && x.statusCategory === 'open')!;
    await db.query(`UPDATE tasks SET created_at = now() WHERE id = ANY($1)`, [[hidden.id, open.id]]);
    const ids = async (me: Me) => addedSince(await seenTasks(db, me), before).map((x) => x.id);
    expect(await ids(ada)).toEqual(expect.arrayContaining([hidden.id, open.id]));
    expect(await ids(await meAs(DEE))).not.toContain(hidden.id);
  });
});

describe('"Added since" on a project', () => {
  it('names the day the way the pill reads it, Monday first and in the calendar day', async () => {
    const { sinceWords } = await import('../components/AddedSince');
    expect(sinceWords('2026-10-30', '2026-10-30')).toBe('today');
    expect(sinceWords('2026-10-05', '2026-10-30')).toBe('Mon 5 Oct');
    expect(sinceWords('2026-10-04', '2026-10-30')).toBe('Sun 4 Oct');
    // 12 am India time on the day picked is the cutoff, the same rule the Team menu used.
    expect(istInstant('2026-10-05T00:00')!.toISOString()).toBe('2026-10-04T18:30:00.000Z');
  });
});
