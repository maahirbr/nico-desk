import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { openDb, type Db } from '../lib/db';
import { jevAsk, jevCacheClear, jevOn, type JevQuestion } from '../lib/jev';
import { maskDictFor, type MaskDict } from '../lib/redact';
import { currentStatus, decide, readPick, statusQuestion, suggestStatus, THRESHOLD, WORD } from '../lib/jevStatus';
import { mergeRank, searchByMeaning } from '../lib/jevSearch';
import { search, searchCandidates, type SearchHit } from '../lib/search';
import { TEAM_ID } from '../lib/seed';
import { SEE_ALL } from '../lib/sight';
import { getTask } from '../lib/service';

// Jev with the network mocked. No test here calls the real API.
const ON = { NICO_JEV: '1', TYPESAFE_API_KEY: 'test-key-not-real' };
const DICT: MaskDict = { people: [{ names: ['Meera Iyer', 'Meera', 'Iyer'], emails: ['meera@example.test'] }], projects: ['Autumn landing page'] };
const Q: Record<string, JevQuestion> = { status: statusQuestion() };

const ok = (answers: unknown, status = 200) => new Response(JSON.stringify({ answers, usage: { input_tokens: 11, output_tokens: 3 } }), { status });
const blocked = (p = 0.9) => ({ status: { choice: 'Blocked', probabilities: { Blocked: p, 'In progress': 1 - p }, confidence: p } });

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  jevCacheClear();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('guard', () => {
  it('is off unless NICO_JEV=1 and a key are set', () => {
    expect(jevOn({})).toBe(false);
    expect(jevOn({ NICO_JEV: '1' })).toBe(false);
    expect(jevOn({ TYPESAFE_API_KEY: 'k' })).toBe(false);
    expect(jevOn({ NICO_JEV: '0', TYPESAFE_API_KEY: 'k' })).toBe(false);
    expect(jevOn(ON)).toBe(true);
  });

  it('stays off against a hosted database unless NICO_JEV_LIVE=1', () => {
    expect(jevOn({ ...ON, DATABASE_URL: 'postgres://x' })).toBe(false);
    expect(jevOn({ ...ON, DATABASE_URL: 'postgres://x', NICO_JEV_LIVE: '1' })).toBe(true);
    expect(jevOn({ ...ON, DATABASE_URL: 'postgres://x', NICO_JEV_LIVE: '0' })).toBe(false);
  });

  it('sends nothing when off', async () => {
    const r = await jevAsk({ note: 'x' }, Q, { dict: DICT, env: {} });
    expect(r).toEqual({ ok: false, reason: 'off' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('fallbacks', () => {
  it('returns answers, usage and unmasks the reply', async () => {
    fetchMock.mockResolvedValueOnce(ok(blocked()));
    const r = await jevAsk({ note: 'x' }, Q, { dict: DICT, env: ON });
    expect(r.ok && r.answers.status.choice).toBe('Blocked');
    expect(r.ok && r.usage).toEqual({ input: 11, output: 3 });
  });

  it('maps a placeholder in a returned choice key back to the real value', async () => {
    const q: Record<string, JevQuestion> = { who: { type: 'choice', instructions: 'Who owns it?', criteria: { 'Meera Iyer': 'The lead.', Nobody: null } } };
    fetchMock.mockImplementationOnce(async (_u: string, init: { body: string }) => {
      const keys = Object.keys((JSON.parse(init.body).questions.who as { criteria: Record<string, unknown> }).criteria);
      expect(keys.join(' ')).not.toMatch(/Meera/); // masked on the way out
      return ok({ who: { choice: keys[0], probabilities: { [keys[0]]: 0.9, [keys[1]]: 0.1 }, confidence: 0.9 } });
    });
    const r = await jevAsk({ note: 'x' }, q, { dict: DICT, env: ON });
    expect(r.ok && r.answers.who.choice).toBe('Meera Iyer');
  });

  it.each([[500], [401], [400]])('falls back on HTTP %i', async (code) => {
    fetchMock.mockResolvedValueOnce(new Response('no', { status: code }));
    expect(await jevAsk({ note: 'x' }, Q, { dict: DICT, env: ON })).toEqual({ ok: false, reason: 'error' });
  });

  it('falls back on a network error and on a bad body', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    expect(await jevAsk({ note: 'a' }, Q, { dict: DICT, env: ON })).toEqual({ ok: false, reason: 'error' });
    fetchMock.mockResolvedValueOnce(new Response('not json', { status: 200 }));
    expect(await jevAsk({ note: 'b' }, Q, { dict: DICT, env: ON })).toEqual({ ok: false, reason: 'error' });
  });

  it('falls back on a timeout', async () => {
    fetchMock.mockRejectedValueOnce(Object.assign(new Error('t'), { name: 'TimeoutError' }));
    expect(await jevAsk({ note: 'x' }, Q, { dict: DICT, env: ON })).toEqual({ ok: false, reason: 'timeout' });
  });

  it('retries once on 429 and on 529, then gives up', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 429 })).mockResolvedValueOnce(ok(blocked()));
    expect((await jevAsk({ note: 'a' }, Q, { dict: DICT, env: ON, backoffMs: 1 })).ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response('', { status: 529 }));
    expect(await jevAsk({ note: 'b' }, Q, { dict: DICT, env: ON, backoffMs: 1 })).toEqual({ ok: false, reason: 'rate' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('answers a repeat request from the cache', async () => {
    fetchMock.mockResolvedValue(ok(blocked()));
    const a = await jevAsk({ note: 'same' }, Q, { dict: DICT, env: ON });
    const b = await jevAsk({ note: 'same' }, Q, { dict: DICT, env: ON });
    expect(a.ok && !a.cached).toBe(true);
    expect(b.ok && b.cached).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('never puts the key in the body and sends it only as a bearer header', async () => {
    fetchMock.mockResolvedValueOnce(ok(blocked()));
    await jevAsk({ note: 'x' }, Q, { dict: DICT, env: ON });
    const [, init] = fetchMock.mock.calls[0] as [string, { body: string; headers: Record<string, string> }];
    expect(init.body).not.toContain(ON.TYPESAFE_API_KEY);
    expect(init.headers.authorization).toBe(`Bearer ${ON.TYPESAFE_API_KEY}`);
  });
});

describe('masking is required', () => {
  const live = { ...ON, DATABASE_URL: 'postgres://placeholder', NICO_JEV_LIVE: '1' };

  it('sends nothing when the masker throws', async () => {
    const broken = { people: [{ names: null, emails: [] }], projects: [] } as unknown as MaskDict;
    expect(await jevAsk({ note: 'Meera Iyer' }, Q, { dict: broken, env: ON })).toEqual({ ok: false, reason: 'error' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends nothing on a live run when the roster did not load', async () => {
    expect(await jevAsk({ note: 'Meera Iyer' }, Q, { dict: { people: [], projects: [] }, env: live })).toEqual({ ok: false, reason: 'error' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('builds a live request body with no roster name, email, phone, link or amount', async () => {
    const db = await openDb();
    const dict = await maskDictFor(db, TEAM_ID);
    expect(dict.people.length).toBeGreaterThan(3);
    fetchMock.mockResolvedValueOnce(ok(blocked()));
    const note = 'Meera Iyer and Kabir Sethi wait on Ananya. Mail ishaan@example.test or +91 90000 00001, see https://docs.example.test/a, Rs 45,000 for Autumn landing page and Campaign shoot plan. Priya Menon, Arjun Nair.';
    await jevAsk({ task_title: 'Book studio for Kabir', status_now: 'In progress', note }, Q, { dict, env: live });
    const body = (fetchMock.mock.calls[0] as [string, { body: string }])[1].body.toLowerCase();
    const bad = dict.people.flatMap((p) => [...p.names, ...p.emails]).concat(dict.projects, ['90000', 'example.test', '45,000']);
    for (const word of bad) expect(body, word).not.toContain(word.toLowerCase());
  });
});

describe('merge of reranked and local order', () => {
  const hit = (id: string): SearchHit => ({ kind: 'task', id, title: id, sub: '', href: '/', dueOn: '2026-10-09', open: true, overdue: false });
  const c = (id: string, strict: boolean) => ({ hit: hit(id), strict });
  const ids = (hs: SearchHit[]) => hs.map((h) => h.id);

  it('orders by score, with a small lead for a strict match', () => {
    const local = [c('a', false), c('b', false), c('c', true)];
    const out = mergeRank(local, new Map([['task-a', 0.5], ['task-b', 0.9], ['task-c', 0.5]]));
    expect(ids(out)).toEqual(['b', 'c', 'a']);
  });

  it('keeps local order for equal scores', () => {
    const out = mergeRank([c('a', false), c('b', false), c('c', false)], new Map([['task-a', 0.6], ['task-b', 0.6], ['task-c', 0.6]]));
    expect(ids(out)).toEqual(['a', 'b', 'c']);
  });

  it('drops a loose candidate scored below the floor, never a strict one', () => {
    const out = mergeRank([c('a', false), c('b', true)], new Map([['task-a', 0.1], ['task-b', 0]]));
    expect(ids(out)).toEqual(['b']);
  });

  it('caps the list at 20', () => {
    const many = Array.from({ length: 30 }, (_, i) => c(`t${i}`, true));
    expect(mergeRank(many, new Map()).length).toBe(20);
  });
});

describe('status suggestion', () => {
  it('offers a status only when it differs and Jev is sure enough', () => {
    const blockedPick = { choice: 'blocked' as const, p: THRESHOLD };
    expect(decide(blockedPick, 'doing')).toBe('blocked');
    expect(decide({ choice: 'blocked', p: THRESHOLD - 0.01 }, 'doing')).toBeNull();
    expect(decide(blockedPick, 'blocked')).toBeNull(); // already there
    expect(decide({ choice: null, p: 0.99 }, 'doing')).toBeNull(); // No change
    expect(decide(null, 'doing')).toBeNull();
    expect(decide({ choice: 'done', p: 0.7 }, 'doing', 0.65)).toBe('done');
  });

  it('reads the five words and No change from a Choice answer', () => {
    for (const [k, w] of Object.entries(WORD)) expect(readPick({ choice: w, probabilities: { [w]: 0.8 } })).toEqual({ choice: k, p: 0.8 });
    expect(readPick({ choice: 'No change', probabilities: { 'No change': 0.7 } })).toEqual({ choice: null, p: 0.7 });
    expect(readPick({ choice: 'Something else', probabilities: { 'Something else': 1 } })).toBeNull();
    expect(readPick({ choice: 'Blocked' })).toBeNull();
    expect(readPick(undefined)).toBeNull();
  });

  describe('against the seeded database', () => {
    let db: Db;
    beforeAll(async () => { db = await openDb(); });

    const snapshot = async () => {
      const out: number[] = [];
      for (const t of ['tasks', 'events', 'notices', 'people', 'projects']) out.push((await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${t}`)).rows[0].n);
      return out;
    };

    it('suggests Blocked for a blocking note and writes nothing', async () => {
      vi.stubEnv('NICO_JEV', '1');
      vi.stubEnv('TYPESAFE_API_KEY', 'test-key-not-real');
      vi.stubEnv('DATABASE_URL', '');
      fetchMock.mockResolvedValue(ok(blocked(0.93)));
      const t = await getTask(db, 'tsk_036');
      expect(t.statusCategory).toBe('open');
      const before = await snapshot();
      const s = await suggestStatus(db, TEAM_ID, t, 'Cannot go on until Meera Iyer sends the report.');
      expect(s).toMatchObject({ status: 'blocked', word: 'Blocked' });
      expect(await snapshot()).toEqual(before); // nothing writes without a click
      expect(currentStatus(await getTask(db, 'tsk_036'))).toBe(currentStatus(t));
      const sent = (fetchMock.mock.calls[0] as [string, { body: string }])[1].body;
      expect(sent).not.toContain('Meera'); // masked on the way out
    });

    it('offers nothing below the threshold, for No change, for a closed task, for an empty note, when Jev fails', async () => {
      vi.stubEnv('NICO_JEV', '1');
      vi.stubEnv('TYPESAFE_API_KEY', 'test-key-not-real');
      vi.stubEnv('DATABASE_URL', '');
      const t = await getTask(db, 'tsk_036');
      fetchMock.mockResolvedValueOnce(ok(blocked(THRESHOLD - 0.1)));
      expect(await suggestStatus(db, TEAM_ID, t, 'maybe stuck, not sure')).toBeNull();
      fetchMock.mockResolvedValueOnce(ok({ status: { choice: 'No change', probabilities: { 'No change': 0.95 }, confidence: 0.95 } }));
      expect(await suggestStatus(db, TEAM_ID, t, 'link to the sheet')).toBeNull();
      expect(await suggestStatus(db, TEAM_ID, t, '   ')).toBeNull();
      const done = await getTask(db, 'tsk_001');
      expect(done.statusCategory).toBe('done');
      fetchMock.mockClear();
      expect(await suggestStatus(db, TEAM_ID, done, 'blocked again')).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
      fetchMock.mockRejectedValueOnce(new Error('offline'));
      expect(await suggestStatus(db, TEAM_ID, t, 'stuck waiting on legal')).toBeNull();
    });

    it('does not call Jev at all when it is off', async () => {
      vi.stubEnv('NICO_JEV', '');
      const t = await getTask(db, 'tsk_036');
      expect(await suggestStatus(db, TEAM_ID, t, 'stuck waiting on legal')).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});

describe('search by meaning', () => {
  let db: Db;
  beforeAll(async () => { db = await openDb(); });
  const q = 'hiring someone to take the photos';
  const idOf = (h: SearchHit) => `${h.kind}-${h.id}`;

  it('keeps the local result when Jev is off', async () => {
    vi.stubEnv('NICO_JEV', '');
    const r = await searchByMeaning(db, TEAM_ID, SEE_ALL, q);
    expect(r.ranked).toBe(false);
    expect(r.hits).toEqual(await search(db, TEAM_ID, SEE_ALL, q));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('puts the best-scored candidate first, and falls back to the local result when Jev fails', async () => {
    vi.stubEnv('NICO_JEV', '1');
    vi.stubEnv('TYPESAFE_API_KEY', 'test-key-not-real');
    vi.stubEnv('DATABASE_URL', '');
    const cands = await searchCandidates(db, TEAM_ID, SEE_ALL, q, '2026-10-09');
    expect(cands.length).toBeGreaterThan(5);
    const pick = cands[cands.length - 1];
    fetchMock.mockImplementationOnce(async (_u: string, init: { body: string }) => {
      const qs = JSON.parse(init.body).questions as Record<string, unknown>;
      expect(Object.keys(qs).length).toBe(cands.length); // one Noul per candidate
      return ok(Object.fromEntries(cands.map((c, i) => [`c${i}`, { noul: c === pick ? 0.95 : 0.1 }])));
    });
    const ranked = await searchByMeaning(db, TEAM_ID, SEE_ALL, q);
    expect(ranked.ranked).toBe(true);
    expect(idOf(ranked.hits[0])).toBe(idOf(pick.hit));

    jevCacheClear();
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    const fell = await searchByMeaning(db, TEAM_ID, SEE_ALL, q);
    expect(fell.ranked).toBe(false);
    expect(fell.hits).toEqual(await search(db, TEAM_ID, SEE_ALL, q));
  });
});
