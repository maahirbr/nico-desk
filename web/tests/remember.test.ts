import { describe, expect, it } from 'vitest';
import { oneOf, parseStored, viewKey } from '../lib/remember';

// "Remember my view": what was kept is checked before the page uses it.

describe('parseStored', () => {
  it('reads a stored object', () => {
    expect(parseStored('{"tile":"open","who":null}')).toEqual({ tile: 'open', who: null });
  });
  it('gives null for nothing, broken text, an array or a bare value', () => {
    expect(parseStored(null)).toBeNull();
    expect(parseStored('')).toBeNull();
    expect(parseStored('{oops')).toBeNull();
    expect(parseStored('[1,2]')).toBeNull();
    expect(parseStored('"open"')).toBeNull();
    expect(parseStored('null')).toBeNull();
  });
});

describe('oneOf', () => {
  it('keeps a value the page still offers', () => {
    expect(oneOf('open', ['open', 'done'], null)).toBe('open');
  });
  it('falls back for a value that is gone, of the wrong kind or missing', () => {
    expect(oneOf('late', ['open', 'done'], null)).toBeNull();
    expect(oneOf(3, ['open', '3'], 'All')).toBe('All');
    expect(oneOf(undefined, ['open'], 'All')).toBe('All');
  });
});

describe('viewKey', () => {
  it('is per person and per page', () => {
    expect(viewKey('p1', 'team')).not.toBe(viewKey('p2', 'team'));
    expect(viewKey('p1', 'team')).not.toBe(viewKey('p1', 'project:j1'));
  });
  it('strips characters that do not belong in a key', () => {
    expect(viewKey('a b/c', 'x y')).toBe('nd_view_abc_xy');
  });
});
