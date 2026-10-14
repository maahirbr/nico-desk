import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from '../lib/db';
import { ApiError } from '../lib/errors';
import { getProject, planOp, planState, projectCounts, teamProjects } from '../lib/plan';
import { countdown, lineLate, nextStepsOf, plainParse, stampRel, totalPushes } from '../lib/planUtil';
import { TEAM_ID } from '../lib/seed';

// Project pages and the plan board, on the synthetic fixtures (fixtures/plan.json).
const AS_OF = '2026-10-09';
const ME = 'per_ada';
const PLAN = 'prj_studio';

let db: Db;
beforeEach(async () => {
  db = await openDb();
});

async function code(p: Promise<unknown>): Promise<string> {
  try { await p; } catch (e) { if (e instanceof ApiError) return `${e.status} ${e.code}`; throw e; }
  return 'ok';
}
const line = async (id: string) => (await planState(db, PLAN)).lines.find((l) => l.id === id)!;

describe('projects', () => {
  it('lists task boards and the partner plan with header details', async () => {
    const ps = await teamProjects(db, TEAM_ID);
    expect(ps.map((p) => p.id).sort()).toEqual(['prj_landing', 'prj_shoot', 'prj_studio', 'prj_tiers']);
    const plan = await getProject(db, PLAN);
    expect(plan.kind).toBe('plan');
    expect(plan.partnerPeople).toEqual(['Leela', 'Rohan', 'Tanvi']);
    expect((await getProject(db, 'prj_landing')).launchOn).toBe('2026-10-30');
    const c = await projectCounts(db, TEAM_ID, AS_OF);
    expect(c[PLAN]).toEqual({ open: 7, overdue: 1, done: 1 });
  });

  it('counts down to a launch in months and days', () => {
    expect(countdown('2026-10-09', '2026-12-31')).toEqual({ months: 2, days: 22, past: false });
    expect(countdown('2026-10-09', '2026-10-01')).toEqual({ months: 0, days: 8, past: true });
  });
});

describe('plan board', () => {
  it('derives overdue lines, pushes and done stamps from the first date', async () => {
    const s = await planState(db, PLAN);
    expect(s.lines).toHaveLength(8);
    expect(s.removed.map((l) => l.num)).toEqual([9]);
    expect(s.lines.filter((l) => lineLate(l, AS_OF)).map((l) => l.num)).toEqual([2]);
    expect(totalPushes(s.lines.find((l) => l.num === 1)!)).toBe(1);
    expect(stampRel('2026-10-07', '2026-10-06')).toEqual({ rel: '1 day late', kind: 'late' });
    expect(stampRel('2026-10-01', '2026-10-02')).toEqual({ rel: '1 day early', kind: 'early' });
  });

  it('needs a reason to mark a line blocked, and logs it', async () => {
    expect(await code(planOp(db, ME, PLAN, { op: 'status', lineId: 'ln_04', status: 'Blocked' }, AS_OF))).toBe('400 reason_required');
    await planOp(db, ME, PLAN, { op: 'status', lineId: 'ln_04', status: 'Blocked', reason: 'Waiting on names' }, AS_OF);
    const l = await line('ln_04');
    expect(l.status).toBe('Blocked');
    expect(l.note).toBe('Blocked: Waiting on names');
    expect((await planState(db, PLAN)).activity[0].summary).toContain('Waiting on names');
  });

  it('stamps a done date and clears it on reopen', async () => {
    await planOp(db, ME, PLAN, { op: 'status', lineId: 'ln_02', status: 'Done' }, AS_OF);
    expect((await line('ln_02')).completedOn).toBe(AS_OF);
    expect((await planState(db, PLAN)).activity[0].summary).toContain('1 day late');
    expect(await code(planOp(db, ME, PLAN, { op: 'status', lineId: 'ln_02', status: 'In progress' }, AS_OF))).toBe('400 reason_required');
    await planOp(db, ME, PLAN, { op: 'status', lineId: 'ln_02', status: 'In progress', reason: 'Studio found a gap in the setup.' }, AS_OF);
    expect((await line('ln_02')).completedOn).toBeNull();
  });

  it('keeps the first date when a date is pushed, and asks why', async () => {
    const l = await line('ln_08');
    const edit = (dueOn: string, dateReason?: string) => planOp(db, ME, PLAN, {
      op: 'editLine', lineId: l.id, what: l.what, doneDef: l.doneDef, note: l.note, ownerId: l.ownerId, ownerWith: l.ownerWith,
      partner: l.partner, partnerRole: l.partnerRole, mode: l.mode, dueOn, byLabel: l.byLabel, checkpoints: [], dateReason,
    }, AS_OF);
    expect(await code(edit('2026-11-16'))).toBe('400 reason_required');
    await edit('2026-11-16', 'Sales data arrives a week later.');
    const after = await line('ln_08');
    expect([after.dueOn, after.origDueOn, after.pushCount]).toEqual(['2026-11-16', '2026-11-09', 1]);
    // Moving it again within ten minutes is a correction: no second push, first date unchanged.
    await edit('2026-11-17');
    const fixed = await line('ln_08');
    expect([fixed.dueOn, fixed.origDueOn, fixed.pushCount]).toEqual(['2026-11-17', '2026-11-09', 1]);
  });

  it('removes a line only with a reason, and restores it', async () => {
    expect(await code(planOp(db, ME, PLAN, { op: 'removeLine', lineId: 'ln_03', reason: 'no' }, AS_OF))).toBe('400 reason_required');
    await planOp(db, ME, PLAN, { op: 'removeLine', lineId: 'ln_03', reason: 'Folded into line 1' }, AS_OF);
    let s = await planState(db, PLAN);
    expect(s.removed.map((l) => l.id)).toContain('ln_03');
    await planOp(db, ME, PLAN, { op: 'restoreLine', lineId: 'ln_03' }, AS_OF);
    s = await planState(db, PLAN);
    expect(s.lines.map((l) => l.id)).toContain('ln_03');
  });

  it('adds the next line number and keeps the activity log append-only', async () => {
    await planOp(db, ME, PLAN, { op: 'addLine', pillar: 'people', what: 'Onboarding guide', doneDef: '', ownerId: null, partner: '', partnerRole: '', dueOn: null }, AS_OF);
    expect((await planState(db, PLAN)).lines.find((l) => l.what === 'Onboarding guide')?.num).toBe(10);
    await expect(db.query(`DELETE FROM plan_activity`)).rejects.toThrow(/append-only/);
  });
});

describe('meeting minutes to actions', () => {
  it('reads owners and dates from next steps without a model', () => {
    const text = '# Summary\nTalked.\n### Next Steps\n- (Kabir Sethi) Send the studio the column list (Oct 12, 2026)\n- Rohan: share the board template by 14 Oct\n';
    const steps = plainParse(nextStepsOf(text), '2026-10-09', [{ num: 2, what: 'Shared task tracker', doneDef: 'board template for every team' }]);
    expect(steps.map((x) => [x.owner, x.due])).toEqual([['Kabir Sethi', '2026-10-12'], ['Rohan', '2026-10-14']]);
    expect(steps.map((x) => x.task)).toEqual(['Send the studio the column list', 'Share the board template']);
    expect(steps[1].line).toBe(2);
    expect(steps.every((x) => x.confidence === 'unsure')).toBe(true);
  });

  it('turns minutes into proposals, and only accepting one changes the plan', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    await planOp(db, ME, PLAN, { op: 'importMinutes', title: 'Working session', date: AS_OF, text: '(Rohan) Share the board template (Oct 14)\n(Leela) Draft the case exercise' }, AS_OF);
    let s = await planState(db, PLAN);
    expect(s.proposals).toHaveLength(2);
    const before = s.actions.length;
    const [a, b] = s.proposals;
    await planOp(db, ME, PLAN, { op: 'acceptProposal', proposalId: a.id, lineId: 'ln_02' }, AS_OF);
    await planOp(db, ME, PLAN, { op: 'rejectProposal', proposalId: b.id }, AS_OF);
    s = await planState(db, PLAN);
    expect(s.proposals).toHaveLength(0);
    expect(s.actions).toHaveLength(before + 1);
    expect(s.actions.find((x) => x.task === 'Share the board template')).toMatchObject({ lineId: 'ln_02', ownerName: 'Rohan', dueOn: '2026-10-14' });
    expect(await code(planOp(db, ME, PLAN, { op: 'acceptProposal', proposalId: b.id, lineId: null }, AS_OF))).toBe('404 not_found');
  });
});

describe('task boards: sub-projects and minutes', () => {
  it('keeps a sub-project on a task and edits it', async () => {
    const { createTask, editTask, getTask } = await import('../lib/service');
    const t = await createTask(db, ME, { teamId: TEAM_ID, title: 'Print the brand book', ownerId: ME, dueOn: '2026-12-01', projectId: 'prj_landing', workstream: 'Brand Book' });
    expect(t.workstream).toBe('Brand Book');
    const e = await editTask(db, ME, t.id, { version: t.version, workstream: null });
    expect((await getTask(db, e.id)).workstream).toBeNull();
  });

  it('turns minutes into proposed tasks that need an owner and a date', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const { teamTasks } = await import('../lib/service');
    const { pendingProposals } = await import('../lib/plan');
    await planOp(db, ME, 'prj_landing', { op: 'importMinutes', title: 'Web sync', date: AS_OF, text: '(Kabir Sethi) Fix the hero image (Oct 20)\n(Someone) Look into fonts' }, AS_OF);
    const ps = await pendingProposals(db, 'prj_landing');
    expect(ps.map((p) => [p.ownerId, p.dueOn, p.confidence])).toEqual([['per_bo', '2026-10-20', 'sure'], [null, null, 'unsure']]);
    expect(await code(planOp(db, ME, 'prj_landing', { op: 'acceptProposal', proposalId: ps[1].id, lineId: null }, AS_OF))).toBe('400 owner_required');
    await planOp(db, ME, 'prj_landing', { op: 'acceptProposal', proposalId: ps[0].id, lineId: null }, AS_OF);
    const made = (await teamTasks(db, TEAM_ID, AS_OF)).find((t) => t.title === 'Fix the hero image');
    expect(made).toMatchObject({ ownerId: 'per_bo', dueOn: '2026-10-20', firstDueOn: '2026-10-20', projectId: 'prj_landing' });
    expect(await code(planOp(db, ME, 'prj_landing', { op: 'removeLine', lineId: 'x', reason: 'nope nope' }, AS_OF))).toBe('400 not_a_plan');
  });
});

describe('reminders', () => {
  it('drafts one email per person with overdue items, and never sends', async () => {
    const { reminderDrafts, logReminder } = await import('../lib/reminders');
    const r = await reminderDrafts(db, TEAM_ID, { mode: 'overdue', days: 2 }, 'http://localhost:3100/me', AS_OF);
    expect(r.drafts.length).toBeGreaterThan(0);
    const d = r.drafts.find((x) => x.personId === 'per_bo')!;
    expect(d.items.every((i) => i.days < 0)).toBe(true);
    expect(d.subject).toMatch(/^Reminder: \d+ overdue/);
    expect(d.body).toContain('http://localhost:3100/me');
    expect(d.to).toBeNull(); // synthetic addresses are never offered as a recipient
    const wide = await reminderDrafts(db, TEAM_ID, { mode: 'window', days: 7 }, 'x', AS_OF);
    expect(wide.drafts.reduce((n, x) => n + x.items.length, 0)).toBeGreaterThan(r.drafts.reduce((n, x) => n + x.items.length, 0));
    await logReminder(db, TEAM_ID, ME, { personId: 'per_bo', channel: 'gmail', subject: d.subject, itemCount: d.items.length });
    const again = await reminderDrafts(db, TEAM_ID, { mode: 'overdue', days: 2 }, 'x', AS_OF);
    expect(again.drafts.find((x) => x.personId === 'per_bo')!.lastAt).not.toBeNull();
  });

  it('leaves out people marked never remind', async () => {
    const { reminderDrafts } = await import('../lib/reminders');
    await db.query(`UPDATE people SET never_remind = true WHERE id = 'per_bo'`);
    const r = await reminderDrafts(db, TEAM_ID, { mode: 'overdue', days: 2 }, 'x', AS_OF);
    expect(r.drafts.some((x) => x.personId === 'per_bo')).toBe(false);
    expect(r.skipped.length).toBe(1);
  });
});

describe('starting a project', () => {
  const base = { name: 'Diwali hampers', kind: 'tasks' as const, ownerId: ME, goal: 'Hampers in every store by 25 Oct.', launchOn: '2026-10-25',
    targetLabel: 'Launch', phase: 'Sampling', workstreams: ['Hampers', 'Packaging'], members: [{ personId: 'per_bo', role: 'Packaging POC' }] };

  it('lets a lead start one with roles, a date and sub-projects', async () => {
    const { createProject, projectMembers } = await import('../lib/plan');
    const p = await createProject(db, ME, TEAM_ID, base);
    expect(p).toMatchObject({ kind: 'tasks', launchOn: '2026-10-25', targetLabel: 'Launch', workstreams: ['Hampers', 'Packaging'] });
    expect(p.pills.map((x) => x.label)).toEqual(['Launch', 'Phase']);
    expect(await projectMembers(db, p.id)).toEqual([{ personId: 'per_bo', role: 'Packaging POC' }]);
    expect(await code(createProject(db, ME, TEAM_ID, base))).toBe('400 invalid_body'); // same name
    expect(await code(createProject(db, 'per_bo', TEAM_ID, { ...base, name: 'Other' }))).toBe('403 not_allowed');
  });

  it('needs pillars for a partner plan, and keeps pillar keys on rename', async () => {
    const { createProject, updateProject } = await import('../lib/plan');
    expect(await code(createProject(db, ME, TEAM_ID, { ...base, name: 'Studio', kind: 'plan', workstreams: [] }))).toBe('400 invalid_body');
    const p = await createProject(db, ME, TEAM_ID, { ...base, name: 'Studio', kind: 'plan', workstreams: ['Foundations'], partnerName: 'Loom', partnerPeople: ['Tanvi'] });
    const key = p.pillars[0].key;
    const u = await updateProject(db, ME, p.id, { ...base, name: 'Studio', kind: 'plan', workstreams: ['Groundwork'], partnerName: 'Loom', partnerPeople: ['Tanvi'] });
    expect(u.pillars).toEqual([{ key, label: 'Groundwork' }]);
    expect(await code(updateProject(db, ME, p.id, { ...base, name: 'Studio', kind: 'tasks' }))).toBe('400 invalid_body');
  });
});

describe('search', () => {
  it('finds projects, tasks, plan lines and people, title matches first', async () => {
    const { search } = await import('../lib/search');
    const hits = await search(db, TEAM_ID, 'shoot', AS_OF);
    expect(hits[0]).toMatchObject({ kind: 'project', title: 'Campaign shoot plan' });
    expect(hits.some((h) => h.kind === 'task')).toBe(true);
    expect((await search(db, TEAM_ID, 'champions', AS_OF)).map((h) => h.kind)).toContain('line');
    expect((await search(db, TEAM_ID, 'web producer', AS_OF))[0]).toMatchObject({ kind: 'person', id: 'per_bo' });
    expect(await search(db, TEAM_ID, '   ', AS_OF)).toEqual([]);
  });
});

describe('blocked and dropped say why; starting and finishing are one click', () => {
  it('blocks only with a reason (a person is optional), drops only with a reason', async () => {
    const s = await import('../lib/service');
    const t = (await s.teamTasks(db, TEAM_ID, AS_OF)).find((x) => x.statusCategory === 'open' && x.origin === 'app' && x.ownerId === 'per_bo')!;
    expect(await code(s.blockTask(db, 'per_bo', t.id, { version: t.version, ask: 'please' }))).toBe('400 reason_required');
    const solo = await s.blockTask(db, 'per_bo', t.id, { version: t.version, ask: 'Printer is shut until Monday.' });
    expect(solo.blocked).toMatchObject({ onId: null, ask: 'Printer is shut until Monday.' });
    const free = await s.unblockTask(db, 'per_bo', t.id, { version: solo.version }); // clearing a block needs no note
    const b = await s.blockTask(db, 'per_bo', t.id, { version: free.version, onId: ME, ask: 'Need the final price list please.' });
    expect(b.blocked?.onId).toBe(ME);
    const c = await s.unblockTask(db, ME, t.id, { version: b.version });
    expect(c.blocked).toBeNull();
    expect(await code(s.closeTask(db, 'per_bo', t.id, { version: c.version, as: 'dropped' }))).toBe('400 reason_required');
    const done = await s.closeTask(db, 'per_bo', t.id, { version: c.version, as: 'done' });
    expect(done.statusCategory).toBe('done'); // marking done needs no reason
  });

  it('plan lines: blocked, back to not started and reopening need a reason; starting and done do not', async () => {
    expect(await code(planOp(db, ME, PLAN, { op: 'status', lineId: 'ln_08', status: 'Blocked', reason: 'short' }, AS_OF))).toBe('400 reason_required');
    const from = (await line('ln_08')).status;
    if (from !== 'In progress') await planOp(db, ME, PLAN, { op: 'status', lineId: 'ln_08', status: 'In progress' }, AS_OF);
    expect((await line('ln_08')).status).toBe('In progress');
    expect(await code(planOp(db, ME, PLAN, { op: 'status', lineId: 'ln_08', status: 'Not started' }, AS_OF))).toBe('400 reason_required');
    await planOp(db, ME, PLAN, { op: 'status', lineId: 'ln_08', status: 'Done' }, AS_OF);
    expect((await line('ln_08')).status).toBe('Done');
    expect(await code(planOp(db, ME, PLAN, { op: 'status', lineId: 'ln_08', status: 'In progress' }, AS_OF))).toBe('400 reason_required');
  });
});

describe('ledger drill-down', () => {
  it('lists exactly the tasks the ledger counts', async () => {
    const s = await import('../lib/service');
    const rows = await s.ledger(db, TEAM_ID, '2026-01-05', '2026-12-28', undefined, AS_OF);
    const tasks = await s.ledgerTasks(db, TEAM_ID, '2026-01-05', '2026-12-28', undefined, AS_OF);
    const sum = (k: keyof (typeof rows)[number]) => rows.reduce((n, r) => n + (r[k] as number), 0);
    expect(tasks.filter((t) => t.outcome === 'ahead' || t.outcome === 'on_time').length).toBe(sum('closedAhead') + sum('closedOnTime'));
    expect(tasks.filter((t) => t.outcome === 'late').length).toBe(sum('closedLate'));
    expect(tasks.filter((t) => t.overdue).length).toBe(sum('openPastDue'));
    expect(tasks.filter((t) => t.slippedSilently).length).toBe(sum('silentSlips'));
  });
});
