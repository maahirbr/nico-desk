import { describe, expect, it } from 'vitest';
import { COUNT_MS, MAX_MS, capMs, countUpValue, countable, easeOut, isFirst, staggerDelay } from '../lib/motionMath';
import { FIELDS, ditherPath, dotOn } from '../lib/dither';

describe('count-up', () => {
  it('starts at the start and ends exactly on the true value', () => {
    expect(countUpValue(42, 0)).toBe(0);
    expect(countUpValue(42, 1)).toBe(42);
    expect(countUpValue(42, 3)).toBe(42);
  });
  it('rises without going back, and never passes the end', () => {
    let last = -1;
    for (let i = 0; i <= 20; i++) {
      const v = countUpValue(57, i / 20);
      expect(v).toBeGreaterThanOrEqual(last);
      expect(v).toBeLessThanOrEqual(57);
      last = v;
    }
  });
  it('counts down as well as up, and keeps whole numbers', () => {
    expect(countUpValue(2, 0.5, 10)).toBeLessThan(10);
    expect(Number.isInteger(countUpValue(9, 0.37))).toBe(true);
  });
  it('is fast first and slows at the end', () => {
    expect(easeOut(0.5)).toBeGreaterThan(0.5);
    expect(easeOut(-1)).toBe(0);
    expect(easeOut(2)).toBe(1);
  });
  it('only counts plain whole numbers', () => {
    expect(countable(' 12 ')).toBe(12);
    expect(countable('12%')).toBeNull();
    expect(countable('1,200')).toBeNull();
    expect(countable('')).toBeNull();
  });
  it('stays inside the 300ms rule', () => {
    expect(COUNT_MS).toBeLessThanOrEqual(MAX_MS);
    expect(capMs(900)).toBe(MAX_MS);
    expect(capMs(-5)).toBe(0);
  });
});

describe('stagger and first-view gate', () => {
  it('steps the delay and caps it', () => {
    expect(staggerDelay(0)).toBe(0);
    expect(staggerDelay(3)).toBe(90);
    expect(staggerDelay(500)).toBe(240);
    expect(staggerDelay(-2)).toBe(0);
  });
  it('is first only until the key has been seen, and does not write', () => {
    const seen = new Set<string>();
    expect(isFirst(seen, 'home')).toBe(true);
    expect(isFirst(seen, 'home')).toBe(true);
    seen.add('home');
    expect(isFirst(seen, 'home')).toBe(false);
    expect(isFirst(seen, 'team')).toBe(true);
  });
});

describe('dither', () => {
  it('gives the same path every time', () => {
    expect(ditherPath('glow', 24, 12)).toBe(ditherPath('glow', 24, 12));
  });
  it('lights some dots but not all', () => {
    const count = (p: string) => (p.match(/M/g) ?? []).length;
    expect(count(ditherPath('glow', 40, 20))).toBeGreaterThan(20);
    expect(count(ditherPath('glow', 40, 20))).toBeLessThan(40 * 20);
  });
  it('lights nothing at 0 and everything at 1', () => {
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      expect(dotOn(0, c, r)).toBe(false);
      expect(dotOn(1, c, r)).toBe(true);
    }
  });
  it('keeps every field between 0 and 1', () => {
    for (const f of Object.values(FIELDS)) for (let i = 0; i <= 10; i++) for (let j = 0; j <= 10; j++) {
      const v = f(i / 10, j / 10);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});
