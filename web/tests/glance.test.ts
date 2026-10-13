import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from '../lib/db';
import type { Task } from '../lib/derive';
import { TEAM_ID } from '../lib/seed';
import * as s from '../lib/service';
import {
  barShare, glanceOf, lineY, loadByProject, loadSummary, onTimeTrend, teamLoad, teamSummary, trendRuns, trendSummary, weekSplit, weekSummary,
} from '../lib/glance';

// Home at a glance: the sums behind the four charts. Today is pinned to the fixtures' as-of date, Friday 9 Oct 2026,
// so the week runs Monday 5 Oct to Sunday 11 Oct.
const TODAY = '2026-10-09';
const ME = 'ana';
let n = 0;
const mk = (o: Partial<Task>): Task => ({
  id: `t${++n}`, ownerId: ME, projectId: null, firstDueOn: TODAY, dueOn: TODAY, statusCategory: 'open', outcome: null, closedAt: null, ...o,
} as Task);
const closed = (firstDueOn: string, outcome: 'ahead' | 'on_time' | 'late', o: Partial<Task> = {}) =>
  mk({ firstDueOn, dueOn: firstDueOn, statusCategory: 'done', outcome, closedAt: `${firstDueOn}T06:00:00.000Z`, ...o });

let db: Db;
beforeAll(() => { process.env.NICO_TODAY = TODAY; });
beforeEach(() => { n = 0; });

describe('this week: done, open, late', () => {
  it('counts what closed in the week, what is still due by Sunday, and what is past due', () => {
    const tasks = [
      mk({ statusCategory: 'done', closedAt: '2026-10-06T06:00:00.000Z' }), // done Tuesday
      mk({ statusCategory: 'done', closedAt: '2026-10-04T18:00:00.000Z' }), // done 4 Oct 23:30 IST, last week
      mk({ dueOn: '2026-10-09' }), // open, due today
      mk({ dueOn: '2026-10-11' }), // open, due Sunday
      mk({ dueOn: '2026-10-12' }), // due next Monday, not this week
      mk({ dueOn: '2026-10-07' }), // late
      mk({ dueOn: '2026-09-20' }), // very late
      mk({ statusCategory: 'dropped', dueOn: '2026-10-07' }), // dropped is not work
      mk({ ownerId: 'bo', dueOn: '2026-10-07' }), // someone else's
    ];
    expect(weekSplit(tasks, ME, TODAY)).toEqual({ done: 1, open: 2, late: 2, total: 5 });
  });

  it('reads a close time in Indian time: 00:30 on Monday 12 Oct is next week', () => {
    const t = mk({ statusCategory: 'done', closedAt: '2026-10-11T19:00:00.000Z' });
    expect(weekSplit([t], ME, TODAY).done).toBe(0);
    const u = mk({ statusCategory: 'done', closedAt: '2026-10-04T19:00:00.000Z' }); // 00:30 Monday 5 Oct IST
    expect(weekSplit([u], ME, TODAY).done).toBe(1);
  });

  it('is all zero with no tasks, and says so in words', () => {
    const z = weekSplit([], ME, TODAY);
    expect(z).toEqual({ done: 0, open: 0, late: 0, total: 0 });
    expect(weekSummary(z)).toBe('Nothing due or finished this week.');
    expect(weekSummary({ done: 2, open: 3, late: 1, total: 6 })).toBe('This week: 2 done, 3 open, 1 late.');
  });
});

describe('on-time trend: your own rate by week of first due date', () => {
  it('gives four weeks, oldest first, the last holding today', () => {
    expect(onTimeTrend([], ME, TODAY).map((w) => w.weekStart)).toEqual(['2026-09-14', '2026-09-21', '2026-09-28', '2026-10-05']);
  });

  it('rates kept over closed per week, rounded, and null for a week with nothing closed', () => {
    const tasks = [
      closed('2026-09-15', 'on_time'), closed('2026-09-16', 'ahead'), closed('2026-09-17', 'late'), // week of 14 Sep: 2 of 3 kept
      closed('2026-09-29', 'late'), // week of 28 Sep: 0 of 1
      closed('2026-10-06', 'on_time'), closed('2026-10-07', 'on_time'), // week of 5 Oct: 2 of 2
    ];
    const t = onTimeTrend(tasks, ME, TODAY);
    expect(t.map((w) => [w.closed, w.kept, w.rate])).toEqual([[3, 2, 67], [0, 0, null], [1, 0, 0], [2, 2, 100]]);
  });

  it('judges a task by its first date: a moved date does not change its week or its outcome', () => {
    const moved = closed('2026-09-15', 'late', { dueOn: '2026-09-30' });
    const t = onTimeTrend([moved], ME, TODAY);
    expect(t[0].closed).toBe(1);
    expect(t[2].closed).toBe(0);
    expect(t[0].rate).toBe(0);
  });

  it('leaves out open tasks, dropped tasks, other people and weeks outside the window', () => {
    const tasks = [
      mk({ firstDueOn: '2026-10-06' }), // open, no outcome
      closed('2026-10-06', 'on_time', { statusCategory: 'dropped' }),
      closed('2026-10-06', 'on_time', { ownerId: 'bo' }),
      closed('2026-09-07', 'on_time'), // five weeks back
      closed('2026-10-13', 'on_time'), // next week
    ];
    expect(onTimeTrend(tasks, ME, TODAY).every((w) => w.rate === null && w.closed === 0)).toBe(true);
  });

  it('breaks the line at a week with nothing closed, and summarises in words', () => {
    const t = onTimeTrend([closed('2026-09-15', 'on_time'), closed('2026-10-06', 'late')], ME, TODAY);
    expect(trendRuns(t)).toEqual([[[0, 100]], [[3, 0]]]);
    expect(trendSummary(t)).toBe('Your on-time rate, week of 14 Sep: 100% of 1 finished task on time; week of 21 Sep: nothing finished; week of 28 Sep: nothing finished; week of 5 Oct: 0% of 1 finished task on time.');
    expect(trendSummary(onTimeTrend([], ME, TODAY))).toBe('No finished tasks in the last four weeks yet, so no on-time rate.');
  });

  it('joins a run of weeks that all have a rate', () => {
    const t = onTimeTrend([closed('2026-09-22', 'on_time'), closed('2026-09-29', 'late'), closed('2026-10-06', 'on_time')], ME, TODAY);
    expect(trendRuns(t)).toEqual([[[1, 100], [2, 0], [3, 100]]]);
  });

  it('agrees with the ledger on the fixtures, person by person and week by week', async () => {
    db = await openDb();
    const tasks = await s.teamTasks(db, TEAM_ID, TODAY);
    const people = [...new Set(tasks.map((t) => t.ownerId))];
    let compared = 0;
    for (const id of people) {
      const trend = onTimeTrend(tasks, id, TODAY);
      const rows = await s.ledger(db, TEAM_ID, trend[0].weekStart, trend[trend.length - 1].weekStart, id, TODAY);
      for (const w of trend) {
        const r = rows.find((x) => x.weekStart === w.weekStart);
        const kept = r ? r.closedAhead + r.closedOnTime : 0;
        const all = r ? kept + r.closedLate : 0;
        expect([w.kept, w.closed]).toEqual([kept, all]);
        compared += w.closed;
      }
    }
    expect(compared).toBeGreaterThan(0);
  });
});

describe('load by project', () => {
  const projects = [{ id: 'p1', name: 'Gift hampers' }, { id: 'p2', name: 'Autumn shoot' }, { id: 'p3', name: 'Quiet one' }];
  const names = { p1: 'Gift hampers', p2: 'Autumn shoot', p3: 'Quiet one', p9: 'Not mine' };

  it('counts open tasks per project with the late part, biggest first, empty projects last', () => {
    const tasks = [
      mk({ projectId: 'p1', dueOn: '2026-10-08' }), mk({ projectId: 'p1', dueOn: '2026-10-20' }),
      mk({ projectId: 'p2', dueOn: '2026-10-01' }), mk({ projectId: 'p2', dueOn: '2026-10-02' }), mk({ projectId: 'p2', dueOn: '2026-10-30' }),
      mk({ projectId: 'p1', statusCategory: 'done' }), mk({ projectId: 'p1', statusCategory: 'dropped' }),
      mk({ projectId: 'p1', ownerId: 'bo' }),
    ];
    expect(loadByProject(tasks, ME, projects, names, TODAY)).toEqual([
      { id: 'p2', name: 'Autumn shoot', open: 3, late: 2 },
      { id: 'p1', name: 'Gift hampers', open: 2, late: 1 },
      { id: 'p3', name: 'Quiet one', open: 0, late: 0 },
    ]);
  });

  it('adds a row for a project you hold tasks in but are not listed on, and one for no project', () => {
    const tasks = [mk({ projectId: 'p9' }), mk({ projectId: null, dueOn: '2026-10-01' }), mk({ projectId: null })];
    expect(loadByProject(tasks, ME, [], names, TODAY)).toEqual([
      { id: 'p9', name: 'Not mine', open: 1, late: 0 },
      { id: null, name: 'No project', open: 2, late: 1 },
    ]);
  });

  it('is empty for someone with no tasks and no projects, and says so in words', () => {
    expect(loadByProject([], ME, [], {}, TODAY)).toEqual([]);
    expect(loadSummary([])).toBe('You have no open tasks in any project.');
    expect(loadSummary(loadByProject([mk({ projectId: 'p1', dueOn: '2026-10-01' })], ME, projects, names, TODAY)))
      .toBe('Your open tasks by project. Gift hampers: 1 open, 1 late.');
  });
});

describe('team load', () => {
  const people = [{ id: 'ana', name: 'Ana' }, { id: 'bo', name: 'Bo' }, { id: 'cy', name: 'Cy' }];

  it('counts open and late per person, drops people with no open task, biggest first', () => {
    const tasks = [
      mk({ ownerId: 'bo' }), mk({ ownerId: 'bo', dueOn: '2026-10-01' }), mk({ ownerId: 'bo', dueOn: '2026-10-02' }),
      mk({ ownerId: 'ana' }), mk({ ownerId: 'ana', statusCategory: 'done' }), mk({ ownerId: 'cy', statusCategory: 'dropped' }),
      mk({ ownerId: 'someone_else' }),
    ];
    expect(teamLoad(tasks, people, TODAY)).toEqual([{ id: 'bo', name: 'Bo', open: 3, late: 2 }, { id: 'ana', name: 'Ana', open: 1, late: 0 }]);
    expect(teamSummary(teamLoad(tasks, people, TODAY))).toBe('Open tasks by person. Bo: 3 open, 2 late; Ana: 1 open.');
  });

  it('is empty when no one has open work', () => {
    expect(teamLoad([], people, TODAY)).toEqual([]);
    expect(teamSummary([])).toBe('No one on the team has an open task.');
  });
});

describe('glanceOf', () => {
  const tasks = [mk({ projectId: 'p1' }), mk({ ownerId: 'bo' }), closed('2026-10-06', 'on_time')];
  const base = { personId: ME, today: TODAY, projects: [{ id: 'p1', name: 'Gift hampers' }], projectNames: {}, people: [{ id: 'ana', name: 'Ana' }, { id: 'bo', name: 'Bo' }] };

  it('gives the team table only to a lead or an admin', () => {
    expect(glanceOf(tasks, { ...base, showTeam: false }).team).toBeNull();
    expect(glanceOf(tasks, { ...base, showTeam: true }).team?.map((r) => r.id)).toEqual(['ana', 'bo']);
  });

  it('shows a person only their own week, trend and load', () => {
    const g = glanceOf(tasks, { ...base, personId: 'bo', showTeam: false });
    expect(g.week).toEqual({ done: 0, open: 1, late: 0, total: 1 });
    expect(g.trend.every((w) => w.rate === null)).toBe(true);
    expect(g.load).toEqual([{ id: 'p1', name: 'Gift hampers', open: 0, late: 0 }, { id: null, name: 'No project', open: 1, late: 0 }]);
  });
});

describe('bar and line geometry', () => {
  it('sizes a bar as a share of the longest, with a sliver for a small non-zero count', () => {
    expect(barShare(4, 4)).toBe(1);
    expect(barShare(2, 4)).toBe(0.5);
    expect(barShare(1, 100)).toBe(0.04);
    expect(barShare(0, 4)).toBe(0);
    expect(barShare(3, 0)).toBe(0);
  });

  it('puts 100% at the top pad and 0% at the bottom pad', () => {
    expect(lineY(100, 64, 8)).toBe(8);
    expect(lineY(0, 64, 8)).toBe(56);
    expect(lineY(50, 64, 8)).toBe(32);
  });
});
