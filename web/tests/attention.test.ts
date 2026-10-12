import { describe, expect, it } from 'vitest';
import { derive, type EventRow, type TaskRow } from '../lib/derive';
import { attentionList, NO_REASON, whyOf } from '../lib/attention';

const TODAY = '2026-10-09';
const names = { o: 'Owner One', b: 'Blocker Two' };

const row = (over: Partial<TaskRow> = {}): TaskRow => ({
  id: 't1', team_id: 'tm', title: 'Draft the brief', description: null, owner_id: 'o', project_id: null, workstream: null,
  first_due_on: '2026-10-01', due_on: '2026-10-01', note: null, health: null, status: 'In progress', status_category: 'open',
  priority: null, priority_set_by: null, priority_set_at: null, blocked_on_id: null, blocked_ask: null, blocked_at: null,
  origin: 'app', origin_ref: null, created_by: null, created_at: '2026-09-20T05:00:00Z', closed_at: null, version: 1, ...over,
});
const move = (id: string, at: string, before: string, after: string, reason: string | null = 'r'): EventRow => ({
  id, entity_type: 'task', entity_id: 't1', field: 'due_on', before, after, reason, actor_id: 'o', origin: 'app', at,
});
const list = (r: TaskRow, ev: EventRow[] = []) => attentionList([derive(r, ev, TODAY)], names, TODAY);

describe('needs attention: why and next step', () => {
  it('slipped silently with no reason: ask the owner for a new date and a reason', () => {
    const [a] = list(row());
    expect(a.daysLate).toBe(8);
    expect(a.why).toBe(NO_REASON);
    expect(a.whySource).toBe('none');
    expect(a.step).toEqual({ kind: 'ask_date', text: 'Ask Owner One for a new date and a reason' });
    expect(a.remindPersonId).toBe('o');
  });

  it('blocked on a teammate: unblock, and the why is the block reason', () => {
    const [a] = list(row({ blocked_on_id: 'b', blocked_ask: 'Needs the signed-off copy', blocked_at: '2026-10-02T05:00:00Z' }));
    expect(a.why).toBe('Needs the signed-off copy');
    expect(a.whySource).toBe('block');
    expect(a.step).toEqual({ kind: 'unblock', text: 'Unblock: waiting on Blocker Two' });
    expect(a.remindPersonId).toBeNull();
  });

  it('blocked but not past due still shows, and a block with no teammate is still an unblock', () => {
    const [a] = list(row({ due_on: '2026-10-20', first_due_on: '2026-10-20', blocked_on_id: null, blocked_ask: 'Waiting on a vendor quote', blocked_at: '2026-10-02T05:00:00Z' }));
    expect(a.daysLate).toBe(0);
    expect(a.step.kind).toBe('unblock');
    expect(a.step.text).toContain('no teammate named');
  });

  it('moved more than once: agree a firm date, and the why is the latest move reason', () => {
    const [a] = list(
      row({ due_on: '2026-10-05' }),
      [move('e1', '2026-09-29T05:00:00Z', '2026-10-01', '2026-10-03', 'Waiting on photos'), move('e2', '2026-10-02T05:00:00Z', '2026-10-03', '2026-10-05', 'Photos came late')],
    );
    expect(a.why).toBe('Photos came late');
    expect(a.whySource).toBe('move');
    expect(a.step).toEqual({ kind: 'firm_date', text: 'Agree a firm date with Owner One' });
  });

  it('past due after one move with a reason: close it or move the date with a reason', () => {
    const [a] = list(row({ due_on: '2026-10-05' }), [move('e1', '2026-09-30T05:00:00Z', '2026-10-01', '2026-10-05', 'Scope grew')]);
    expect(a.why).toBe('Scope grew');
    expect(a.step).toEqual({ kind: 'close_or_move', text: 'Close it or move the date with a reason' });
  });

  it('moved late to a future date with a reason: confirm the new date', () => {
    const [a] = list(row({ due_on: '2026-10-14' }), [move('e1', '2026-10-03T05:00:00Z', '2026-10-01', '2026-10-14', 'Scope grew')]);
    expect(a.daysLate).toBe(0);
    expect(a.step.kind).toBe('confirm_date');
  });

  it('links a reminder only for app tasks that are past due', () => {
    expect(list(row())[0].remindPersonId).toBe('o');
    expect(list(row({ origin: 'sheet' }))[0].remindPersonId).toBeNull();
    expect(list(row({ due_on: '2026-10-14' }), [move('e1', '2026-10-03T05:00:00Z', '2026-10-01', '2026-10-14', 'Scope grew')])[0].remindPersonId).toBeNull();
  });

  it('a move with a blank reason does not count as a reason', () => {
    const t = derive(row({ due_on: '2026-10-05' }), [move('e1', '2026-09-30T05:00:00Z', '2026-10-01', '2026-10-05', '  ')], TODAY);
    expect(whyOf(t).source).toBe('none');
  });
});

describe('needs attention: which tasks, in what order', () => {
  it('lists only open tasks that are late, silent or blocked, longest overdue first, once each', () => {
    const mk = (id: string, due: string, over: Partial<TaskRow> = {}) => derive(row({ id, title: id, first_due_on: due, due_on: due, ...over }), [], TODAY);
    const tasks = [
      mk('recent', '2026-10-07'),
      mk('oldest', '2026-09-20'),
      mk('fine', '2026-10-30'),
      mk('done', '2026-09-01', { status_category: 'done', status: 'Done', closed_at: '2026-09-01T05:00:00Z' }),
      mk('blocked', '2026-10-30', { blocked_ask: 'Waiting', blocked_at: '2026-10-02T05:00:00Z' }),
    ];
    const out = attentionList([...tasks, tasks[0]], names, TODAY);
    expect(out.map((a) => a.title)).toEqual(['oldest', 'recent', 'blocked']);
    expect(out[0].daysLate).toBe(19);
  });
});
