import { describe, expect, it } from 'vitest';
import { dayLabel, firstUnread, mergeLatest, rowsOf } from '../components/chatLogic';
import type { MessageView } from '../lib/teamchat';

// The plain parts of the chat room: how a poll folds into the screen, and how the list is grouped by day.

let n = 0;
const msg = (over: Partial<MessageView> = {}): MessageView => ({
  id: `m${String(++n).padStart(3, '0')}`, roomKind: 'team', roomId: 'team', authorId: 'per_a', authorName: 'A', createdAt: '2026-10-09T05:00:00.000Z',
  editedAt: null, deleted: false, mine: false, parts: [{ t: 'text', text: 'hi' }], body: null, tasks: [], ...over,
});

describe('mergeLatest', () => {
  it('shows the poll when nothing is on screen yet', () => {
    const a = msg();
    expect(mergeLatest([], [a], false)).toEqual([a]);
  });

  it('adds new messages at the end and replaces ones already shown (an edit or a removal)', () => {
    const a = msg(); const b = msg(); const c = msg();
    const edited = { ...b, editedAt: '2026-10-09T06:00:00.000Z' };
    const out = mergeLatest([a, b], [edited, c], false);
    expect(out.map((m) => m.id)).toEqual([a.id, b.id, c.id]);
    expect(out[1].editedAt).toBe('2026-10-09T06:00:00.000Z');
  });

  it('keeps earlier messages that the poll page does not reach', () => {
    const old = msg(); const a = msg(); const b = msg();
    expect(mergeLatest([old, a], [a, b], true).map((m) => m.id)).toEqual([old.id, a.id, b.id]);
  });

  it('starts again from the newest page when a whole page arrived since the last poll', () => {
    const a = msg(); const x = msg(); const y = msg();
    expect(mergeLatest([a], [x, y], true)).toEqual([x, y]);
  });
});

describe('dayLabel', () => {
  it('says Today and Yesterday, then the date', () => {
    expect(dayLabel('2026-10-09', '2026-10-09')).toBe('Today');
    expect(dayLabel('2026-10-08', '2026-10-09')).toBe('Yesterday');
    expect(dayLabel('2026-09-30', '2026-10-09')).toBe('30 Sep');
    expect(dayLabel('2026-09-30', '2026-10-01')).toBe('Yesterday'); // across a month edge
  });
});

describe('rowsOf', () => {
  it('puts a day line where the day changes, in IST', () => {
    const a = msg({ createdAt: '2026-10-08T05:00:00.000Z' });
    const b = msg({ createdAt: '2026-10-08T19:00:00.000Z' }); // 00:30 on the 9th in IST
    const rows = rowsOf([a, b], '2026-10-09', null);
    expect(rows.map((r) => (r.kind === 'day' ? r.label : r.kind))).toEqual(['Yesterday', 'msg', 'Today', 'msg']);
  });

  it('drops the header on a message from the same person within five minutes, not after that or from someone else', () => {
    const a = msg({ createdAt: '2026-10-09T05:00:00.000Z' });
    const b = msg({ createdAt: '2026-10-09T05:03:00.000Z' });
    const c = msg({ createdAt: '2026-10-09T05:09:00.000Z' });
    const d = msg({ createdAt: '2026-10-09T05:10:00.000Z', authorId: 'per_b' });
    const heads = rowsOf([a, b, c, d], '2026-10-09', null).flatMap((r) => (r.kind === 'msg' ? [r.head] : []));
    expect(heads).toEqual([true, false, true, true]);
  });

  it('puts the New line before the first unread message and gives that message a header', () => {
    const a = msg(); const b = msg({ createdAt: '2026-10-09T05:01:00.000Z' });
    const rows = rowsOf([a, b], '2026-10-09', b.id);
    expect(rows.map((r) => r.kind)).toEqual(['day', 'msg', 'new', 'msg']);
    const last = rows[3];
    expect(last.kind === 'msg' && last.head).toBe(true);
  });
});

describe('firstUnread', () => {
  it('is the first message from someone else after the read mark', () => {
    const mine = msg({ mine: true, createdAt: '2026-10-09T05:00:00.000Z' });
    const seen = msg({ createdAt: '2026-10-09T05:01:00.000Z' });
    const fresh = msg({ createdAt: '2026-10-09T05:03:00.000Z' });
    expect(firstUnread([mine, seen, fresh], '2026-10-09T05:02:00.000Z')).toBe(fresh.id);
  });

  it('counts every message from others when nothing was read, and skips removed ones', () => {
    const gone = msg({ deleted: true });
    const a = msg();
    expect(firstUnread([gone, a], null)).toBe(a.id);
  });

  it('is null when nothing is new', () => {
    const a = msg({ createdAt: '2026-10-09T05:00:00.000Z' });
    expect(firstUnread([a], '2026-10-09T05:00:00.000Z')).toBeNull();
    expect(firstUnread([msg({ mine: true })], null)).toBeNull();
  });
});
