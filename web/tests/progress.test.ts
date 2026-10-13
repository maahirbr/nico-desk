import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from '../lib/db';
import { projectSplits } from '../lib/plan';
import type { PlanLine } from '../lib/planUtil';
import {
  dueDoneByWeek, dueDoneSummary, emptySplit, lineDates, lineSplit, splitParts, splitSummary, splitText, taskDates, taskSplit, weeksEmpty,
} from '../lib/progress';
import { TEAM_ID } from '../lib/seed';
import * as s from '../lib/service';
import { trendSummary } from '../lib/glance';

// More visual data: the project status bar, the weekly done-against-due chart, and the person page glance.
// Today is pinned to the fixtures' as-of date, Friday 9 Oct 2026 (the week of Monday 5 Oct).
const TODAY = '2026-10-09';
type T = Parameters<typeof taskSplit>[0][number];
const task = (o: Partial<T> = {}): T => ({ statusCategory: 'open', dueOn: '2026-10-20', blocked: null, health: null, ...o } as T);
const line = (o: Partial<PlanLine>): PlanLine => ({ status: 'Not started', dueOn: '2026-10-20', checkpoints: [], ...o } as PlanLine);

beforeAll(() => { process.env.NICO_TODAY = TODAY; });

describe('task status split', () => {
  it('puts each task in one segment, so the segments add up to the total', () => {
    const tasks = [
      task({ statusCategory: 'done', dueOn: '2026-10-01' }), // done, even though its date has passed
      task({ statusCategory: 'done' }),
      task({ health: 'on_track' }), // in progress
      task({ health: 'on_track', dueOn: '2026-10-09' }), // due today is not late
      task({}), // not started
      task({ health: 'not_started' }),
      task({ blocked: { onId: 'x', ask: 'y', at: 'z' } as never }),
      task({ dueOn: '2026-10-08', health: 'on_track' }), // late, counted in late and not in progress
      task({ dueOn: '2026-10-01', blocked: { onId: 'x', ask: 'y', at: 'z' } as never }), // late and blocked: late only
    ];
    const sp = taskSplit(tasks, TODAY);
    expect(sp).toEqual({ done: 2, doing: 2, todo: 2, blocked: 1, late: 2, total: 9 });
    expect(sp.done + sp.doing + sp.todo + sp.blocked + sp.late).toBe(sp.total);
  });

  it('leaves dropped tasks out', () => {
    const sp = taskSplit([task({ statusCategory: 'dropped', dueOn: '2026-09-01' }), task({ statusCategory: 'done' })], TODAY);
    expect(sp).toEqual({ ...emptySplit(), done: 1, total: 1 });
  });

  it('gives an empty split for no tasks', () => {
    expect(taskSplit([], TODAY)).toEqual(emptySplit());
  });
});

describe('plan line status split', () => {
  it('maps the four line words, and counts a line late by its next checkpoint', () => {
    const lines = [
      line({ status: 'Done', dueOn: '2026-09-01' }),
      line({ status: 'In progress' }),
      line({ status: 'Blocked' }),
      line({ status: 'Not started' }),
      line({ status: 'In progress', dueOn: '2026-10-02' }), // past its date: late
      line({ status: 'Not started', dueOn: '2026-12-01', checkpoints: [{ id: 'c', label: 'Draft', dueOn: '2026-10-05', origDueOn: null, pushCount: 0, done: false, doneOn: null }] }), // checkpoint past: late
    ];
    expect(lineSplit(lines, TODAY)).toEqual({ done: 1, doing: 1, todo: 1, blocked: 1, late: 2, total: 6 });
  });
});

describe('status bar words', () => {
  const sp = { done: 5, doing: 2, todo: 0, blocked: 1, late: 1, total: 9 };
  it('writes the counts in bar order and omits zeros', () => {
    expect(splitText(sp)).toBe('5 done · 2 in progress · 1 blocked · 1 late');
    expect(splitParts(sp).map((p) => p.key)).toEqual(['done', 'doing', 'blocked', 'late']);
  });
  it('says there is nothing yet for an empty split', () => {
    expect(splitText(emptySplit())).toBe('No tasks yet');
    expect(splitSummary(emptySplit(), 'plan lines')).toBe('No plan lines yet.');
  });
  it('writes a sentence for screen readers, singular and plural', () => {
    expect(splitSummary(sp)).toBe('9 tasks: 5 done, 2 in progress, 1 blocked, 1 late.');
    expect(splitSummary({ ...emptySplit(), todo: 1, total: 1 })).toBe('1 task: 1 not started.');
    expect(splitSummary({ ...emptySplit(), done: 3, total: 3 }, 'plan lines')).toBe('3 plan lines: 3 done.');
  });
});

describe('done against due, by week', () => {
  it('gives six IST weeks, Monday to Sunday, oldest first, the last holding today', () => {
    const w = dueDoneByWeek([], TODAY);
    expect(w).toHaveLength(6);
    expect(w[5].weekStart).toBe('2026-10-05');
    expect(w[0].weekStart).toBe('2026-08-31');
    expect(weeksEmpty(w)).toBe(true);
  });

  it('counts work due in the week of its date and done in the week it was finished', () => {
    const w = dueDoneByWeek([
      { dueOn: '2026-10-04', doneOn: '2026-10-05' }, // due Sunday, done the next Monday
      { dueOn: '2026-10-09', doneOn: null },
      { dueOn: '2026-10-11', doneOn: '2026-10-07' },
      { dueOn: '2026-08-30', doneOn: '2026-08-30' }, // before the six weeks: not shown
      { dueOn: null, doneOn: '2026-09-15' },
    ], TODAY);
    const by = Object.fromEntries(w.map((x) => [x.weekStart, [x.due, x.done]]));
    expect(by['2026-09-28']).toEqual([1, 0]);
    expect(by['2026-10-05']).toEqual([2, 2]);
    expect(by['2026-09-14']).toEqual([0, 1]);
    expect(weeksEmpty(w)).toBe(false);
  });

  it('reads task and line dates, leaving dropped tasks out and using the close day in IST', () => {
    expect(taskDates([
      { statusCategory: 'done', dueOn: '2026-10-06', closedAt: '2026-10-05T19:00:00.000Z' }, // 6 Oct 00:30 IST
      { statusCategory: 'open', dueOn: '2026-10-07', closedAt: null },
      { statusCategory: 'dropped', dueOn: '2026-10-07', closedAt: null },
    ])).toEqual([{ dueOn: '2026-10-06', doneOn: '2026-10-06' }, { dueOn: '2026-10-07', doneOn: null }]);
    expect(lineDates([
      { status: 'Done', dueOn: '2026-10-02', completedOn: '2026-10-01' },
      { status: 'In progress', dueOn: '2026-10-09', completedOn: null },
    ])).toEqual([{ dueOn: '2026-10-02', doneOn: '2026-10-01' }, { dueOn: '2026-10-09', doneOn: null }]);
  });

  it('writes a sentence for screen readers, with an empty state', () => {
    expect(dueDoneSummary(dueDoneByWeek([], TODAY))).toBe('Nothing was due or finished in the last 6 weeks.');
    expect(dueDoneSummary(dueDoneByWeek([{ dueOn: '2026-10-09', doneOn: '2026-10-08' }], TODAY))).toContain('week of');
  });
});

describe('project splits on the fixtures', () => {
  let db: Db;
  beforeEach(async () => { db = await openDb(); });

  it('gives every project a split, and a plan board agrees with the plan counts', async () => {
    const splits = await projectSplits(db, TEAM_ID, TODAY);
    const projects = await (await import('../lib/plan')).teamProjects(db, TEAM_ID);
    expect(Object.keys(splits).sort()).toEqual(projects.map((p) => p.id).sort());
    for (const sp of Object.values(splits)) expect(sp.done + sp.doing + sp.todo + sp.blocked + sp.late).toBe(sp.total);
    const counts = await (await import('../lib/plan')).projectCounts(db, TEAM_ID, TODAY);
    const plan = splits['prj_studio'];
    expect(plan.total).toBe(counts['prj_studio'].open + counts['prj_studio'].done);
    expect(plan.done).toBe(counts['prj_studio'].done);
  });
});

describe('person page glance', () => {
  let db: Db;
  beforeEach(async () => { db = await openDb(); });

  it('shows the Home cards to the person, a lead and an admin, and to no other member', async () => {
    const people = await s.listPeople(db, TEAM_ID);
    const [a, b] = people.filter((p) => p.active && p.appRoles.length === 1 && p.appRoles[0] === 'member');
    const admin = people.find((p) => p.appRoles.includes('admin'))!;
    const self = await s.personView(db, TEAM_ID, a.id, a.id, TODAY);
    expect(self.glance).not.toBeNull();
    expect(self.glance!.trend).toHaveLength(4);
    expect((await s.personView(db, TEAM_ID, 'per_ada', a.id, TODAY)).glance).not.toBeNull();
    expect((await s.personView(db, TEAM_ID, admin.id, a.id, TODAY)).glance).not.toBeNull();
    expect((await s.personView(db, TEAM_ID, b.id, a.id, TODAY)).glance).toBeNull();
  });

  it('names whose on-time rate it is', () => {
    const empty = [{ weekStart: '2026-10-05', closed: 0, kept: 0, rate: null }];
    expect(trendSummary(empty, "Wren's")).toBe('No finished tasks in the last four weeks yet, so no on-time rate.');
    const some = [{ weekStart: '2026-10-05', closed: 2, kept: 1, rate: 50 }];
    expect(trendSummary(some, "Wren's")).toBe("Wren's on-time rate, week of 5 Oct: 50% of 2 finished tasks on time.");
    expect(trendSummary(some)).toMatch(/^Your on-time rate/);
  });
});
