import { describe, expect, it } from 'vitest';
import { parseCommit, parseDate } from '../lib/commit';

// v2 commit field. 2026-10-09 is a Friday.
const TODAY = '2026-10-09';
const PEOPLE = [
  { id: 'p_dana', name: 'Dana Fox' },
  { id: 'p_eli', name: 'Eli Stone' },
  { id: 'p_sam1', name: 'Sam Reed' },
  { id: 'p_sam2', name: 'Sam Park' },
  { id: 'p_me', name: 'Mo Lane' },
];
const parse = (t: string) => parseCommit(t, TODAY, PEOPLE, 'p_me');

describe('dates', () => {
  it('reads today and tomorrow', () => {
    expect(parseDate('today', TODAY)).toBe('2026-10-09');
    expect(parseDate('Tomorrow', TODAY)).toBe('2026-10-10');
  });

  it('reads a weekday as the next one after today, and "this" may be today', () => {
    expect(parseDate('friday', TODAY)).toBe('2026-10-16');
    expect(parseDate('this friday', TODAY)).toBe('2026-10-09');
    expect(parseDate('monday', TODAY)).toBe('2026-10-12');
    expect(parseDate('Wed', TODAY)).toBe('2026-10-14');
    expect(parseDate('sunday', TODAY)).toBe('2026-10-11');
    expect(parseDate('this monday', TODAY)).toBe('2026-10-12');
  });

  it('reads "next <weekday>" as that day in the week that starts on the coming Monday', () => {
    expect(parseDate('next monday', TODAY)).toBe('2026-10-12');
    expect(parseDate('next friday', TODAY)).toBe('2026-10-16');
    expect(parseDate('next sunday', TODAY)).toBe('2026-10-18');
    expect(parseDate('next friday', '2026-10-05')).toBe('2026-10-16'); // from a Monday, next week is still the coming one
  });

  it('reads "next week" as the Friday of next week', () => {
    expect(parseDate('next week', TODAY)).toBe('2026-10-16');
    expect(parseDate('next week', '2026-10-12')).toBe('2026-10-23');
  });

  it('reads a day and month in the usual ways, and rolls to next year when it has passed', () => {
    expect(parseDate('12 oct', TODAY)).toBe('2026-10-12');
    expect(parseDate('12th October', TODAY)).toBe('2026-10-12');
    expect(parseDate('oct 12', TODAY)).toBe('2026-10-12');
    expect(parseDate('October 3rd', TODAY)).toBe('2027-10-03');
    expect(parseDate('9 oct', TODAY)).toBe('2026-10-09');
    expect(parseDate('8 oct', TODAY)).toBe('2027-10-08');
    expect(parseDate('3 Jan', TODAY)).toBe('2027-01-03');
    expect(parseDate('12/10', TODAY)).toBe('2026-10-12');
    expect(parseDate('2026-11-02', TODAY)).toBe('2026-11-02');
  });

  it('refuses what is not a date', () => {
    for (const s of ['', 'soon', 'the festival', '31 feb', '32 oct', '0 oct', 'next', 'someday', 'friday night']) {
      expect(parseDate(s, TODAY)).toBeNull();
    }
  });
});

describe('ask <person> to <thing> by <date>', () => {
  it('matches the roster by first name, any case', () => {
    expect(parse('ask Dana to send the proofs by friday')).toEqual({ kind: 'ask', toId: 'p_dana', toName: 'Dana Fox', title: 'Send the proofs', dueOn: '2026-10-16' });
    expect(parse('Ask eli to book the studio by 12 oct')).toMatchObject({ toId: 'p_eli', title: 'Book the studio', dueOn: '2026-10-12' });
    expect(parse('  ask   DANA   to   print   the labels   by   tomorrow  ')).toMatchObject({ toId: 'p_dana', title: 'Print the labels', dueOn: '2026-10-10' });
  });

  it('takes a full name too, and the last "by" that leaves a date', () => {
    expect(parse('ask Dana Fox to review the plan by next week')).toMatchObject({ toId: 'p_dana', dueOn: '2026-10-16' });
    expect(parse('ask Eli to get a quote by the printer by monday')).toMatchObject({ title: 'Get a quote by the printer', dueOn: '2026-10-12' });
  });

  it('keeps a "to" inside the thing', () => {
    expect(parse('ask Dana to talk to the printer by friday')).toMatchObject({ toId: 'p_dana', title: 'Talk to the printer' });
  });

  it('falls through to search when the person, the date or the thing is missing', () => {
    expect(parse('ask Zed to send the proofs by friday')).toBeNull(); // not on the roster
    expect(parse('ask Dana to send the proofs')).toBeNull(); // no date
    expect(parse('ask Dana to send the proofs by soon')).toBeNull();
    expect(parse('ask Dana to by friday')).toBeNull(); // no thing
    expect(parse('ask Dana to x by friday')).toBeNull(); // too short to be a thing
    expect(parse('ask')).toBeNull();
  });

  it('says so when a first name is shared, or the person is you', () => {
    expect(parse('ask Sam to send the proofs by friday')).toMatchObject({ kind: 'ask', toId: '', problem: expect.stringContaining('full name') });
    expect(parse('ask Sam Park to send the proofs by friday')).toMatchObject({ toId: 'p_sam2' });
    expect(parse('ask Sam Park to send the proofs by friday')).not.toHaveProperty('problem');
    expect(parse('ask Mo to send the proofs by friday')).toMatchObject({ toId: 'p_me', problem: expect.stringContaining('I’ll') });
  });
});

describe('I’ll <thing> by <date>', () => {
  it('makes a task for yourself, with a straight or curly apostrophe, or "I will"', () => {
    expect(parse("I'll send the deck by friday")).toEqual({ kind: 'mine', title: 'Send the deck', dueOn: '2026-10-16' });
    expect(parse('i’ll send the deck by today')).toMatchObject({ kind: 'mine', dueOn: '2026-10-09' });
    expect(parse('I will send the deck by 20 oct.')).toMatchObject({ kind: 'mine', title: 'Send the deck', dueOn: '2026-10-20' });
  });

  it('falls through when there is no date or no thing', () => {
    expect(parse("I'll send the deck")).toBeNull();
    expect(parse("I'll by friday")).toBeNull();
    expect(parse("I'll send the deck by whenever")).toBeNull();
  });
});

describe('everything else stays a search', () => {
  it('returns null for ordinary words', () => {
    for (const q of ['festival launch', 'dana', 'asked by dana', 'ask for help by friday', 'send the deck by friday', 'Ill send it by friday', '']) {
      expect(parse(q)).toBeNull();
    }
  });
});
