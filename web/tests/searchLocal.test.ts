import { describe, expect, it } from 'vitest';
import { commandsFor } from '../components/commands';
import { RECENT_MAX, clearRecent, pushRecent, readRecent, writeRecent } from '../components/recent';
import { allowedEdits, editDistance, fold, matchWord, scoreText } from '../lib/fuzzy';
import { SKINS } from '../components/skins';
import { parseQuery, resolveFilters } from '../lib/searchQuery';

// Pure parts of the stronger local search (workstream 9, 13 Oct): typos, the filter words, commands, recent searches.

describe('fuzzy matching', () => {
  it('counts a swap, a dropped letter and an added letter as one edit', () => {
    expect(editDistance('lnading', 'landing', 2)).toBe(1);
    expect(editDistance('photograper', 'photographer', 2)).toBe(1);
    expect(editDistance('landdding', 'landing', 1)).toBeGreaterThan(1);
    expect(editDistance('abc', 'abcdefgh', 1)).toBe(2); // gives up above the limit
  });

  it('allows no edit in short words, one in middle words, two in long ones', () => {
    expect([1, 3, 4, 7, 8, 12].map(allowedEdits)).toEqual([0, 0, 1, 1, 2, 2]);
  });

  it('folds case and accents', () => {
    expect(fold('Café ÉCLAIR')).toBe('cafe eclair');
    expect(scoreText(['cafe'], 'Open the Café').matched).toBe(1);
  });

  it('marks a typo match as fuzzy and an exact match as exact', () => {
    expect(scoreText(['landing'], 'Autumn landing page')).toEqual({ matched: 1, fuzzy: 0 });
    expect(scoreText(['lnading'], 'Autumn landing page')).toEqual({ matched: 1, fuzzy: 1 });
    expect(scoreText(['landin'], 'Autumn landing page')).toEqual({ matched: 1, fuzzy: 0 }); // a prefix is exact
  });

  it('matches a word that is still being typed against the start of a longer word', () => {
    expect(scoreText(['photgraph'], 'Book the photographer')).toMatchObject({ matched: 1, fuzzy: 1 });
  });

  it('gives short words no typo tolerance', () => {
    expect(matchWord('tir', fold('Agree tier names'), ['agree', 'tier', 'names'])).toBe(0);
    expect(matchWord('teir', fold('Agree tier names'), ['agree', 'tier', 'names'])).toBe(2);
  });

  it('counts only the words that match', () => {
    expect(scoreText(['landing', 'zzzzzz'], 'Autumn landing page').matched).toBe(1);
  });
});

describe('query parsing', () => {
  it('splits words from filters', () => {
    expect(parseQuery('is:late @sam #plan deck')).toEqual({ words: ['deck'], is: ['late'], due: null, owners: ['sam'], projects: ['plan'] });
    expect(parseQuery('due:today')).toMatchObject({ due: 'today', words: [] });
  });

  it('reads a half-typed value when only one value fits', () => {
    expect(parseQuery('is:bl').is).toEqual(['blocked']);
    expect(parseQuery('is:la').is).toEqual(['late']);
    expect(parseQuery('due:w').due).toBe('week');
  });

  it('waits when a half-typed value could be two', () => {
    const p = parseQuery('is:d');
    expect(p.is).toEqual([]);
    expect(p.words).toEqual([]);
    expect(parseQuery('is:').words).toEqual([]);
  });

  it('accepts other ways to write a value, and a small typo in one', () => {
    expect(parseQuery('is:overdue').is).toEqual(['late']);
    expect(parseQuery('is:at-risk').is).toEqual(['atrisk']);
    expect(parseQuery('is:blokced').is).toEqual(['blocked']);
  });

  it('keeps an unknown value as a plain word', () => {
    expect(parseQuery('is:banana')).toMatchObject({ is: [], words: ['is:banana'] });
  });

  it('folds case and accents, and caps the words', () => {
    expect(parseQuery('IS:Late CAFÉ').is).toEqual(['late']);
    expect(parseQuery('CAFÉ').words).toEqual(['cafe']);
    expect(parseQuery('a1 b2 c3 d4 e5 f6 g7 h8 i9 j0').words).toHaveLength(8);
  });

  it('turns @ and # into ids, with a typo allowed, only among the lists it is given', () => {
    const people = [{ id: 'p1', name: 'Rowan Ames' }, { id: 'p2', name: 'Tess Quill' }];
    const projects = [{ id: 'j1', name: 'Autumn landing page' }];
    const f = resolveFilters(parseQuery('@rowan #landing'), people, projects);
    expect([...f.owners!]).toEqual(['p1']);
    expect([...f.projects!]).toEqual(['j1']);
    expect([...resolveFilters(parseQuery('@qiull'), people, projects).owners!]).toEqual(['p2']);
    // a project that is not in the list (hidden from the reader) names nobody, so nothing passes
    expect(resolveFilters(parseQuery('#loyalty'), people, projects).projects!.size).toBe(0);
    expect(resolveFilters(parseQuery('deck'), people, projects).any).toBe(false);
  });
});

describe('commands', () => {
  const lead = { isLead: true, readOnly: false };
  const ids = (q: string, ctx = lead) => commandsFor(q, ctx).map((c) => c.id);

  it('shows a short default list on an empty box', () => {
    expect(ids('')).toEqual(['new-task', 'go-home', 'go-team', 'go-projects', 'help']);
  });

  it('finds a command by its words, with a typo', () => {
    expect(ids('team')[0]).toBe('go-team');
    expect(ids('new taks')[0]).toBe('new-task');
    expect(ids('toggle help')[0]).toBe('help');
    expect(ids('keyboard')).toContain('shortcuts');
  });

  it('lists every skin that the account menu lists', () => {
    expect(ids('appearance').filter((i) => i.startsWith('skin-'))).toEqual(SKINS.map((s) => `skin-${s.id}`));
  });

  it('hides New task in View as, and Reminders from a plain member', () => {
    expect(ids('new task', { isLead: true, readOnly: true })).not.toContain('new-task');
    expect(ids('reminders', { isLead: false, readOnly: false })).not.toContain('go-reminders');
    expect(ids('reminders')).toContain('go-reminders');
  });

  it('stays quiet for a filter query or a single letter', () => {
    expect(ids('is:late')).toEqual([]);
    expect(ids('@team')).toEqual([]);
    expect(ids('t')).toEqual([]);
  });

  it('only offers actions that go to a page, send an app event, or toggle help', () => {
    for (const c of commandsFor('', lead).concat(commandsFor('appearance', lead), commandsFor('go', lead))) {
      expect(['go', 'event', 'help']).toContain(c.run.kind);
      if (c.run.kind === 'go') expect(c.run.href.startsWith('/')).toBe(true);
    }
  });
});

describe('recent searches', () => {
  const fake = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); }, m };
  };
  const broken = {
    getItem: () => { throw new Error('blocked'); },
    setItem: () => { throw new Error('blocked'); },
    removeItem: () => { throw new Error('blocked'); },
  };

  it('puts the newest first, drops repeats and keeps a fixed number', () => {
    let l: string[] = [];
    for (const q of ['a1', 'b2', 'c3', 'd4', 'e5', 'f6', 'g7']) l = pushRecent(l, q);
    expect(l).toHaveLength(RECENT_MAX);
    expect(l[0]).toBe('g7');
    expect(pushRecent(['x1', 'y2'], 'X1')).toEqual(['X1', 'y2']);
    expect(pushRecent(['x1'], '  ')).toEqual(['x1']);
    expect(pushRecent(['x1'], 'a')).toEqual(['x1']);
  });

  it('keeps one list for each person', () => {
    const s = fake();
    writeRecent('per_a', ['one'], s);
    writeRecent('per_b', ['two'], s);
    expect(readRecent('per_a', s)).toEqual(['one']);
    expect(readRecent('per_b', s)).toEqual(['two']);
    clearRecent('per_a', s);
    expect(readRecent('per_a', s)).toEqual([]);
    expect(readRecent('per_b', s)).toEqual(['two']);
  });

  it('survives bad data, no storage, and storage that throws', () => {
    const s = fake();
    s.setItem('nd_recent_per_a', '{not json');
    expect(readRecent('per_a', s)).toEqual([]);
    s.setItem('nd_recent_per_a', '[1,"ok"]');
    expect(readRecent('per_a', s)).toEqual(['ok']);
    expect(readRecent('per_a', null)).toEqual([]);
    expect(readRecent('per_a', broken)).toEqual([]);
    expect(() => writeRecent('per_a', ['x'], broken)).not.toThrow();
    expect(() => clearRecent('per_a', broken)).not.toThrow();
    expect(() => writeRecent('per_a', ['x'], null)).not.toThrow();
  });
});
