import { describe, expect, it } from 'vitest';
import { quickDates } from '../lib/time';

// 2026-10-05 is a Monday, so 09 is the Friday and 11 the Sunday.
describe('quickDates', () => {
  it('on a Monday: Friday is this week, Next Monday is a week on', () => {
    expect(quickDates('2026-10-05')).toEqual({ today: '2026-10-05', tomorrow: '2026-10-06', friday: '2026-10-09', nextMonday: '2026-10-12' });
  });

  it('on a Thursday: Friday is tomorrow', () => {
    const q = quickDates('2026-10-08');
    expect(q.friday).toBe('2026-10-09');
    expect(q.tomorrow).toBe('2026-10-09');
    expect(q.nextMonday).toBe('2026-10-12');
  });

  it('on a Friday: Friday is next week, since this one is today', () => {
    const q = quickDates('2026-10-09');
    expect(q.friday).toBe('2026-10-16');
    expect(q.nextMonday).toBe('2026-10-12');
  });

  it('on a Saturday and a Sunday: Friday is next week', () => {
    expect(quickDates('2026-10-10').friday).toBe('2026-10-16');
    expect(quickDates('2026-10-11').friday).toBe('2026-10-16');
  });

  it('Next Monday is always after today, even on a Sunday or a Monday', () => {
    expect(quickDates('2026-10-11').nextMonday).toBe('2026-10-12');
    expect(quickDates('2026-10-12').nextMonday).toBe('2026-10-19');
  });

  it('crosses a month and a year end', () => {
    expect(quickDates('2026-12-31')).toEqual({ today: '2026-12-31', tomorrow: '2027-01-01', friday: '2027-01-01', nextMonday: '2027-01-04' });
  });
});
