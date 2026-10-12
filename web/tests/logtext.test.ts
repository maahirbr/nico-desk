import { describe, expect, it } from 'vitest';
import { groupLog } from '../components/logText';
import type { LogLine } from '../lib/service';

const names = { a: 'Ananya Rao', b: 'Kabir Sethi' };
let n = 0;
const ev = (field: string, before: unknown, after: unknown, o: Partial<LogLine> = {}): LogLine => ({
  id: `e${++n}`, entity_type: 'task', entity_id: 't1', field, before, after, reason: null, actor_id: 'a', origin: 'app',
  at: '2026-10-12T06:23:00.000Z', actorName: 'Ananya Rao', ...o,
});
// Newest first, like taskLog. Events of one action share actor and timestamp.
const texts = (events: LogLine[]) => groupLog(events, names, {}).map((e) => e.text);

describe('update log reads as one sentence per action', () => {
  it('block, unblock, done is three lines, not ten', () => {
    const t3 = '2026-10-12T06:30:00.000Z', t2 = '2026-10-12T06:25:00.000Z', t1 = '2026-10-12T06:20:00.000Z';
    const events = [
      ev('closed_at', null, t3, { at: t3 }), ev('status_category', 'open', 'done', { at: t3 }), ev('status', 'open', 'done', { at: t3 }),
      ev('blocked_ask', 'Waiting on copy deck', null, { at: t2 }), ev('blocked_on_id', 'b', null, { at: t2 }),
      ev('blocked_ask', null, 'Waiting on copy deck', { at: t1 }), ev('blocked_on_id', null, 'b', { at: t1 }),
    ];
    expect(texts(events)).toEqual(['Marked done', 'Unblocked', 'Blocked: Waiting on copy deck (waiting on Kabir Sethi)']);
  });

  it('block with no named person has no waiting-on part', () => {
    expect(texts([ev('blocked_ask', null, 'Supplier has not replied')])).toEqual(['Blocked: Supplier has not replied']);
  });

  it('done and dropped carry their reason; closing hides the block clears', () => {
    expect(texts([ev('blocked_ask', 'x y z', null), ev('closed_at', null, 'z'), ev('status_category', 'open', 'done', { reason: 'Shipped it' }), ev('status', 'open', 'done')]))
      .toEqual(['Marked done: Shipped it']);
    expect(texts([ev('status_category', 'open', 'dropped', { reason: 'Not needed any more' }), ev('status', 'open', 'dropped')]))
      .toEqual(['Dropped: Not needed any more']);
  });

  it('start, move back, date move, rename, reassign', () => {
    expect(texts([ev('health', 'not_started', 'on_track')])).toEqual(['Started']);
    expect(texts([ev('health', 'on_track', 'not_started', { reason: 'Waiting on a brief' })])).toEqual(['Moved back to Not started: Waiting on a brief']);
    expect(texts([ev('due_on', '2026-10-13', '2026-10-16', { reason: 'Printer delay' })])).toEqual(['Due date moved 13 Oct → 16 Oct: Printer delay']);
    expect(texts([ev('title', 'Old', 'New title'), ev('owner_id', 'a', 'b')])).toEqual(['Renamed to “New title”. Reassigned to Kabir Sethi']);
  });

  it('reopen is one line', () => {
    expect(texts([
      ev('closed_at', 'z', null), ev('status_category', 'done', 'open'), ev('status', 'done', 'open'), ev('_reopened', 'done', 'open', { reason: 'Review found a gap' }),
    ])).toEqual(['Reopened: Review found a gap']);
  });

  it('keeps separate actions apart (different actor) and unknown fields literal', () => {
    const out = texts([ev('health', 'not_started', 'on_track', { actor_id: 'b' }), ev('health', 'not_started', 'on_track')]);
    expect(out).toEqual(['Started', 'Started']);
    expect(texts([ev('mystery', 1, 2)])).toEqual(['mystery: 1 → 2']);
  });
});
