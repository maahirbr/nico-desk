import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from '../lib/db';
import { TEAM_ID } from '../lib/seed';
import * as s from '../lib/service';
import { FIXTURE_ANCHOR, shiftDays, shiftJson } from '../lib/shift';

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`../../fixtures/${name}.json`, import.meta.url), 'utf8'));

describe('shiftDays', () => {
  it('is 0 in the anchor week, any weekday', () => {
    expect(shiftDays('2026-10-09')).toBe(0);
    expect(shiftDays('2026-10-05')).toBe(0);
    expect(shiftDays('2026-10-11')).toBe(0);
  });
  it('moves by whole weeks from the Monday of the week', () => {
    expect(shiftDays('2026-10-12')).toBe(7);
    expect(shiftDays('2026-10-23')).toBe(14);
    expect(shiftDays('2026-10-02')).toBe(-7);
  });
});

describe('shiftJson', () => {
  it('shifts dates, timestamps and dates inside text, and leaves the rest', () => {
    const v = {
      due_on: '2026-10-09',
      at: '2026-10-07T09:35:00Z',
      pill: 'Launch 30 Oct 2026',
      note: 'pushed 10 Oct to 14 Oct',
      id: 'tsk_001',
      n: 3,
      list: [{ d: '2026-09-30' }],
    };
    expect(shiftJson(v, 14)).toEqual({
      due_on: '2026-10-23',
      at: '2026-10-21T09:35:00Z',
      pill: 'Launch 13 Nov 2026',
      note: 'pushed 24 Oct to 28 Oct',
      id: 'tsk_001',
      n: 3,
      list: [{ d: '2026-10-14' }],
    });
  });
  it('returns the input untouched for a zero shift', () => {
    const v = { due_on: '2026-10-09' };
    expect(shiftJson(v, 0)).toBe(v);
  });
  it('keeps each date on its weekday', () => {
    const d = (s: string) => new Date(`${s}T00:00:00Z`).getUTCDay();
    expect(d(shiftJson('2026-10-09', 21))).toBe(d('2026-10-09'));
  });
});

describe('fixtures replay', () => {
  it('events.json rebuilds tasks.json and projects.json exactly', () => {
    const tasks: Record<string, Record<string, unknown>> = {};
    const projects: Record<string, Record<string, unknown>> = {};
    for (const e of fixture('events')) {
      const a = e.after;
      if (e.entity_type === 'project') {
        if (e.field === '_created') projects[e.entity_id] = { id: e.entity_id, ...a, status_at: e.at };
        else {
          projects[e.entity_id][e.field] = a;
          if (e.field === 'status' || e.field === 'status_note') projects[e.entity_id].status_at = e.at;
        }
      } else if (e.field === '_created') {
        const r: Record<string, unknown> = {
          id: e.entity_id, title: a.title, owner_id: a.owner_id, project_id: a.project_id, due_on: a.due_on,
          status: a.status, status_category: a.status_category, origin: e.origin, origin_ref: a.origin_ref ?? null,
          created_at: e.at, closed_at: null,
        };
        for (const k of ['description', 'note']) if (a[k] != null) r[k] = a[k];
        tasks[e.entity_id] = r;
      } else if (['status', 'status_category', 'closed_at', 'due_on'].includes(e.field)) tasks[e.entity_id][e.field] = a;
      else if (e.field === 'blocked_on_id' || e.field === 'blocked_ask') {
        tasks[e.entity_id][e.field] = a;
        if (e.field === 'blocked_ask') tasks[e.entity_id].blocked_at = e.at;
      } else if (e.field === 'priority') Object.assign(tasks[e.entity_id], { priority: a, priority_set_by: e.actor_id, priority_set_at: e.at });
    }
    const strip = (r: Record<string, unknown>) => Object.fromEntries(Object.entries(r).filter(([, v]) => v != null));
    const norm = (rows: Record<string, unknown>[]) => rows.map(strip).sort((x, y) => String(x.id).localeCompare(String(y.id)));
    expect(norm(Object.values(tasks))).toEqual(norm(fixture('tasks')));
    expect(norm(Object.values(projects))).toEqual(norm(fixture('projects')));
  });
});

describe('the demo week', () => {
  let db: Db;
  const LEAD = 'per_ada';

  afterEach(() => {
    process.env.NICO_TODAY = FIXTURE_ANCHOR;
  });

  async function openAt(today: string) {
    process.env.NICO_TODAY = today;
    db = await openDb();
    return today;
  }

  it('gives the lead a late task, a task due this week and something waiting on them', async () => {
    const today = await openAt(FIXTURE_ANCHOR);
    const mine = await s.myTasks(db, LEAD, TEAM_ID, today);
    const open = [...mine.assigned, ...mine.tasks];
    expect(open.some((t) => t.overdue)).toBe(true);
    expect(open.some((t) => t.dueOn >= today && t.dueOn <= '2026-10-11')).toBe(true);
    expect(mine.blockedOnMe.length).toBeGreaterThanOrEqual(1);
    expect(mine.blockedOnMe.every((t) => t.blocked?.ask)).toBe(true);
  });

  it('seeds the same week shape when today is two weeks on', async () => {
    const today = await openAt('2026-10-23');
    const mine = await s.myTasks(db, LEAD, TEAM_ID, today);
    const open = [...mine.assigned, ...mine.tasks];
    expect(open.some((t) => t.overdue)).toBe(true);
    expect(open.some((t) => t.dueOn >= today && t.dueOn <= '2026-10-25')).toBe(true);
    expect(mine.blockedOnMe.length).toBeGreaterThanOrEqual(1);
    const t = await s.getTask(db, 'tsk_030', today);
    expect(t.firstDueOn).toBe('2026-10-21');
    expect(t.dateMoves).toBe(1);
  });
});
