import { describe, expect, it } from 'vitest';
import { plainParse, relativeDue } from '../lib/planUtil';

// Pasted minutes (20 Nov, the PM's ask): a short task heading, the lines under it as its description, and a due date
// worked out from the meeting date when the minutes say it in words.
const MEETING = '2026-11-20'; // a Friday

describe('due dates said in words', () => {
  it('counts from the meeting date', () => {
    expect(relativeDue('send it in 18 days', MEETING)).toBe('2026-12-08');
    expect(relativeDue('eighteen days later', MEETING)).toBe('2026-12-08');
    expect(relativeDue('within 2 weeks', MEETING)).toBe('2026-12-04');
    expect(relativeDue('by Monday', MEETING)).toBe('2026-11-23');
    expect(relativeDue('for Friday', MEETING)).toBe('2026-11-27');
    expect(relativeDue('next week', MEETING)).toBe('2026-11-23');
    expect(relativeDue('by end of the month', MEETING)).toBe('2026-11-30');
    expect(relativeDue('soon', MEETING)).toBe('');
  });
});

describe('heading, description and date', () => {
  it('splits a step into its heading and description, and drops the date words from the heading', () => {
    const [s] = plainParse('- Aashi to send the revised deck in 18 days\n  - include the new prices\n  - share with the founder', MEETING);
    expect([s.owner, s.task, s.due, s.details]).toEqual(['Aashi', 'Send the revised deck', '2026-12-08', 'Include the new prices\nShare with the founder']);
  });
});
