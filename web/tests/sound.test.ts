import { describe, expect, it } from 'vitest';
import { cookieValue, cueFor, newNoticeIds, soundOf } from '../components/sound';

describe('sound switch', () => {
  it('is off unless the cookie says 1', () => {
    expect(soundOf(undefined)).toBe(false);
    expect(soundOf(null)).toBe(false);
    expect(soundOf('')).toBe(false);
    expect(soundOf('0')).toBe(false);
    expect(soundOf('true')).toBe(false);
    expect(soundOf('1')).toBe(true);
  });

  it('reads one cookie from the jar', () => {
    expect(cookieValue('', 'nd_sound')).toBeUndefined();
    expect(cookieValue('nd_skin=W; nd_sound=1; nd_help=0', 'nd_sound')).toBe('1');
    expect(cookieValue('nd_sound=0', 'nd_sound')).toBe('0');
    expect(cookieValue('xnd_sound=1', 'nd_sound')).toBeUndefined();
  });
});

describe('which tone a call earns', () => {
  it('stays silent for reads and for ordinary writes that worked', () => {
    expect(cueFor('GET', '/me/notices', undefined, true)).toBeNull();
    expect(cueFor('GET', '/tasks/t1', undefined, false)).toBeNull(); // a failed read is not a refused action
    expect(cueFor('POST', '/tasks/t1/health', { health: 'on_track' }, true)).toBeNull();
    expect(cueFor('POST', '/tasks/t1/close', { as: 'dropped', reason: 'x' }, true)).toBeNull();
  });

  it('ticks when a task is closed as Done', () => {
    expect(cueFor('POST', '/tasks/t1/close', { version: 2, as: 'done' }, true)).toBe('tick');
  });

  it('plays the low tone when the app refuses a write', () => {
    expect(cueFor('POST', '/tasks/t1/close', { as: 'done' }, false)).toBe('refused');
    expect(cueFor('PATCH', '/tasks/t1', {}, false)).toBe('refused');
    expect(cueFor('DELETE', '/tasks/t1/links/l1', undefined, false)).toBe('refused');
  });
});

describe('new notices', () => {
  it('lists only the ids not seen yet, so one notice pings once', () => {
    const known = new Set(['a', 'b']);
    expect(newNoticeIds(known, [{ id: 'a' }, { id: 'b' }])).toEqual([]);
    expect(newNoticeIds(known, [{ id: 'a' }, { id: 'c' }, { id: 'd' }])).toEqual(['c', 'd']);
    expect(newNoticeIds(new Set(), [])).toEqual([]);
  });
});
