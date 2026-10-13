import { describe, expect, it } from 'vitest';
import { isPlainClick, readUrlState, taskHref, writeUrlState } from '../lib/urlstate';

const click = (o: Partial<Parameters<typeof isPlainClick>[0]> = {}) => ({ button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...o });

describe('isPlainClick', () => {
  it('takes only an unmodified left click', () => {
    expect(isPlainClick(click())).toBe(true);
    expect(isPlainClick(click({ button: 1 }))).toBe(false);
    expect(isPlainClick(click({ button: 2 }))).toBe(false);
    for (const m of ['metaKey', 'ctrlKey', 'shiftKey', 'altKey'] as const) expect(isPlainClick(click({ [m]: true }))).toBe(false);
  });
});

describe('taskHref', () => {
  it('points at the task page', () => expect(taskHref('t_1')).toBe('/tasks/t_1'));
});

describe('readUrlState', () => {
  it('returns only the chosen keys that are present', () => {
    const p = new URLSearchParams('who=p_1&week=2026-10-05&tile=');
    expect(readUrlState(p, ['who', 'tile', 'ws'])).toEqual({ who: 'p_1' });
  });
  it('is null when none is present, so the kept view applies', () => {
    expect(readUrlState(new URLSearchParams('week=2026-10-05'), ['who', 'tile'])).toBeNull();
  });
});

describe('writeUrlState', () => {
  const initial = { tile: null, who: null, ws: 'All', sort: 'recent' };
  const keys = ['tile', 'who', 'ws', 'sort'];
  it('leaves defaults out', () => {
    expect(writeUrlState('', initial, initial, keys)).toBe('');
  });
  it('writes non-default values and keeps other parts of the address', () => {
    const q = new URLSearchParams(writeUrlState('?task=t_9&week=2026-10-05', { ...initial, who: 'p_1', sort: 'due' }, initial, keys));
    expect(q.get('who')).toBe('p_1');
    expect(q.get('sort')).toBe('due');
    expect(q.get('task')).toBe('t_9');
    expect(q.get('week')).toBe('2026-10-05');
  });
  it('removes a key that went back to its default', () => {
    expect(writeUrlState('?who=p_1&task=t_9', initial, initial, ['who'])).toBe('?task=t_9');
  });
  it('does not touch keys it was not given', () => {
    expect(writeUrlState('?view=status', { who: 'p_1' }, { who: null }, ['who'])).toBe('?view=status&who=p_1');
  });
});
