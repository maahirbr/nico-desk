import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openDb, type Db } from '../lib/db';
import { modelOn } from '../lib/model';
import { pendingProposals, planOp } from '../lib/plan';

// The Anthropic model (audit 19 Oct): off against the hosted database unless NICO_MODEL_LIVE=1, and what it is sent
// from minutes is masked, so no roster name leaves the app.
const AS_OF = '2026-10-09';
const ME = 'per_ada';
const KEY = { ANTHROPIC_API_KEY: 'k' };

let db: Db;
beforeEach(async () => { db = await openDb(); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('modelOn', () => {
  it('is on only when keyed, and never against the hosted database without the switch', () => {
    expect(modelOn({})).toBe(false);
    expect(modelOn(KEY)).toBe(true);
    expect(modelOn({ ...KEY, DATABASE_URL: 'postgres://x' })).toBe(false);
    expect(modelOn({ ...KEY, DATABASE_URL: 'postgres://x', NICO_MODEL_LIVE: '0' })).toBe(false);
    expect(modelOn({ ...KEY, DATABASE_URL: 'postgres://x', NICO_MODEL_LIVE: '1' })).toBe(true);
  });
});

describe('minutes sent to the model', () => {
  const text = '(Kabir Sethi) Fix the hero image (Oct 20)';

  it('masks names on the way out and maps the labels back', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
    vi.stubEnv('DATABASE_URL', '');
    let sent = '';
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      sent = String(init.body);
      const label = /\((Person \d+)\) Fix the hero image/.exec(JSON.parse(sent).messages[0].content)?.[1] ?? 'none';
      const reply = [{ owner: label, with: [], task: 'Fix the hero image', due: '2026-10-20', line: null, confidence: 'sure', alt: [], why: `${label} said so` }];
      return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(reply) }] }), { status: 200 });
    }));
    await planOp(db, ME, 'prj_landing', { op: 'importMinutes', title: 'Web sync', date: AS_OF, text }, AS_OF);
    expect(sent).not.toBe('');
    expect(sent).not.toContain('Kabir');
    expect(sent).not.toContain('Sethi');
    const [p] = await pendingProposals(db, 'prj_landing');
    expect(p).toMatchObject({ ownerId: 'per_bo', dueOn: '2026-10-20' });
  });

  it('sends nothing against the hosted database without the switch', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
    vi.stubEnv('DATABASE_URL', 'postgres://example.test/db');
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    await planOp(db, ME, 'prj_landing', { op: 'importMinutes', title: 'Web sync', date: AS_OF, text }, AS_OF);
    expect(f).not.toHaveBeenCalled();
    expect(await pendingProposals(db, 'prj_landing')).toHaveLength(1); // the plain parser read it
  });
});
