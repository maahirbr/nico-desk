import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { connectionStatus, fathomNextSteps, getMeeting, listMeetings, removeConnection, saveConnection } from '../lib/connectors';
import { nextStepsOf, plainParse } from '../lib/planUtil';

// The Fathom connection, with fetch faked: nothing leaves this machine in tests. All data is synthetic.

let dir: string;
const envKeys = ['GRANOLA_API_KEY', 'FIREFLIES_API_KEY', 'FATHOM_API_KEY'];
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nd-fathom-'));
  process.env.NICO_DATA_DIR = dir;
  for (const k of envKeys) delete process.env[k];
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NICO_DATA_DIR;
  for (const k of envKeys) delete process.env[k];
  fs.rmSync(dir, { recursive: true, force: true });
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const headersOf = (init: RequestInit) => init.headers as Record<string, string>;
const page = (items: unknown[], next: string | null = null) => ({ limit: 20, next_cursor: next, items });

const meeting = (over: Record<string, unknown> = {}) => ({
  title: 'Sale planning', meeting_title: 'Sale planning (calendar)', recording_id: 4242, url: 'https://fathom.video/calls/4242', share_url: 'https://fathom.video/share/x',
  created_at: '2026-10-08T06:00:00Z', recording_start_time: '2026-10-08T05:30:00Z', scheduled_start_time: '2026-10-08T05:30:00Z',
  calendar_invitees: [{ name: 'Kabir Sethi', email: 'k@example.test', is_external: false }, { name: null, email: 'priya@example.test', is_external: false }],
  action_items: [
    { description: 'Send the column list', completed: false, assignee: { name: 'Kabir Sethi', email: 'k@example.test', team: null } },
    { description: 'Book the courier\nfor Friday', completed: false, assignee: { name: null, email: null, team: null } },
    { description: 'Already finished', completed: true, assignee: { name: 'Priya', email: null, team: null } },
  ],
  default_summary: { template_name: 'general', markdown_formatted: '## Summary\nWe agreed the plan.' },
  ...over,
});

describe('Fathom connection', () => {
  it('checks a key by listing the last 7 days before keeping it, and never shows it back', async () => {
    const calls: { url: string; key: string }[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, key: headersOf(init)['X-Api-Key'] });
      return json(page([meeting()]));
    }));
    await expect(saveConnection('fathom', 'short', 'per_ada')).rejects.toThrow(/API key/);
    expect(calls).toHaveLength(0);
    await saveConnection('fathom', 'fathom_test_key_9876', 'per_ada');
    const u = new URL(calls[0].url);
    expect(u.origin + u.pathname).toBe('https://api.fathom.ai/external/v1/meetings');
    expect(calls[0].key).toBe('fathom_test_key_9876');
    const age = Date.now() - Date.parse(u.searchParams.get('created_after')!);
    expect(Math.abs(age - 7 * 86400000)).toBeLessThan(60_000);
    expect(connectionStatus().fathom).toMatchObject({ connected: true, source: 'file' });
    expect(JSON.stringify(connectionStatus())).not.toContain('fathom_test_key');
    expect(fs.statSync(path.join(dir, 'connections.json')).mode & 0o777).toBe(0o600);
    removeConnection('fathom');
    expect(connectionStatus().fathom).toMatchObject({ connected: false, source: null });
  });

  it('lists meetings as rows and filters by title', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(page([meeting(), meeting({ title: 'Courier call', recording_id: 77 })]))));
    await saveConnection('fathom', 'fathom_test_key_9876', 'per_ada');
    expect(await listMeetings('fathom', { days: 14 })).toEqual([
      { id: '4242', title: 'Sale planning', date: '2026-10-08', attendees: ['Kabir Sethi', 'priya@example.test'] },
      { id: '77', title: 'Courier call', date: '2026-10-08', attendees: ['Kabir Sethi', 'priya@example.test'] },
    ]);
    expect((await listMeetings('fathom', { days: 14, q: 'courier' })).map((r) => r.id)).toEqual(['77']);
  });

  it('follows the cursor to the next page', async () => {
    const seen: (string | null)[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const c = new URL(url).searchParams.get('cursor');
      seen.push(c);
      return c ? json(page([meeting({ recording_id: 2, title: 'Second page' })])) : json(page([meeting({ recording_id: 1 })], 'abc'));
    }));
    expect((await listMeetings('fathom', { days: 14 }, 'k_test_key_12345')).map((r) => r.id)).toEqual(['1', '2']);
    expect(seen).toEqual([null, 'abc']);
  });

  it('maps open action items to owner lines, drops finished ones, and falls back to the summary', () => {
    const m = meeting();
    const t = fathomNextSteps(m.action_items, m.default_summary.markdown_formatted);
    expect(t).toBe('### Next Steps\n(Kabir Sethi) Send the column list\nBook the courier for Friday');
    expect(plainParse(nextStepsOf(t), '2026-10-09').map((x) => [x.owner, x.task])).toEqual([['Kabir Sethi', 'Send the column list'], ['', 'Book the courier for Friday']]);
    expect(fathomNextSteps([], '## Summary\nWe agreed the plan.')).toBe('## Summary\nWe agreed the plan.');
    expect(fathomNextSteps(null, undefined)).toBe('');
  });

  it('reads one meeting by recording id, asking for action items and the summary', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      urls.push(url);
      return json(page([meeting({ recording_id: 1 }), meeting()]));
    }));
    await saveConnection('fathom', 'fathom_test_key_9876', 'per_ada');
    const note = await getMeeting('fathom', '4242');
    expect(note).toEqual({ id: '4242', title: 'Sale planning', date: '2026-10-08', text: '### Next Steps\n(Kabir Sethi) Send the column list\nBook the courier for Friday', link: 'https://fathom.video/calls/4242' });
    const q = new URL(urls[urls.length - 1]).searchParams;
    expect(q.get('include_action_items')).toBe('true');
    expect(q.get('include_summary')).toBe('true');
    await expect(getMeeting('fathom', '999')).rejects.toThrow(/no meeting/);
    await expect(getMeeting('fathom', '../x')).rejects.toThrow(/Bad meeting id/);
  });

  it('refuses a key Fathom rejects, and keeps nothing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ message: 'unauthorized' }, 401)));
    await expect(saveConnection('fathom', 'fathom_bad_key_1234', 'per_ada')).rejects.toThrow(/rejected the API key/);
    expect(connectionStatus().fathom.connected).toBe(false);
    expect(fs.existsSync(path.join(dir, 'connections.json'))).toBe(false);
  });

  it('says how long to wait on a rate limit, and reports other errors and network failures plainly', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 429, headers: { 'retry-after': '37' } })));
    await expect(saveConnection('fathom', 'fathom_test_key_9876', 'per_ada')).rejects.toMatchObject({ status: 429, code: 'rate_limited', message: expect.stringContaining('37 seconds') });
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 429 })));
    await expect(listMeetings('fathom', { days: 7 }, 'k_test_key_12345')).rejects.toMatchObject({ status: 429, message: expect.stringContaining('a minute') });
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: 'boom' }, 500)));
    await expect(listMeetings('fathom', { days: 7 }, 'k_test_key_12345')).rejects.toMatchObject({ status: 502, code: 'source_error' });
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    await expect(listMeetings('fathom', { days: 7 }, 'k_test_key_12345')).rejects.toMatchObject({ status: 502, code: 'source_unreachable' });
    expect(connectionStatus().fathom.connected).toBe(false);
  });
});

describe('keys from the environment', () => {
  it('reads the Fathom key from FATHOM_API_KEY when nothing is saved, and says so', async () => {
    process.env.FATHOM_API_KEY = 'env_fathom_key_4321';
    expect(connectionStatus().fathom).toEqual({ connected: true, savedAt: null, source: 'env', envVar: 'FATHOM_API_KEY' });
    const sent: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_u: string, init: RequestInit) => { sent.push(headersOf(init)['X-Api-Key']); return json(page([meeting()])); }));
    await listMeetings('fathom', { days: 7 });
    expect(sent).toEqual(['env_fathom_key_4321']);
  });

  it('lets the environment key win over a saved key, and refuses to save a key that would be ignored', async () => {
    const sent: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_u: string, init: RequestInit) => { sent.push(headersOf(init)['X-Api-Key']); return json(page([meeting()])); }));
    await saveConnection('fathom', 'file_fathom_key_1111', 'per_ada');
    expect(connectionStatus().fathom).toMatchObject({ source: 'file' });
    process.env.FATHOM_API_KEY = 'env_fathom_key_4321';
    expect(connectionStatus().fathom).toMatchObject({ source: 'env' });
    sent.length = 0;
    await listMeetings('fathom', { days: 7 });
    expect(sent).toEqual(['env_fathom_key_4321']);
    await expect(saveConnection('fathom', 'another_fathom_key_2222', 'per_ada')).rejects.toMatchObject({ status: 409, code: 'key_from_env' });
    expect(sent).toHaveLength(1);
  });

  it('applies the same rule to Granola and Fireflies', async () => {
    process.env.GRANOLA_API_KEY = 'grn_envkey12345';
    process.env.FIREFLIES_API_KEY = 'ff_env_key_6789';
    expect(connectionStatus()).toMatchObject({ granola: { source: 'env' }, fireflies: { source: 'env' }, fathom: { connected: false, source: null } });
    const sent: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_u: string, init: RequestInit) => { sent.push(headersOf(init).Authorization); return json({ notes: [], data: { transcripts: [] } }); }));
    await expect(saveConnection('granola', 'grn_unused_key_1', 'per_ada')).rejects.toMatchObject({ code: 'key_from_env' });
    await listMeetings('granola', { days: 7 });
    await listMeetings('fireflies', { days: 7 });
    expect(sent).toEqual(['Bearer grn_envkey12345', 'Bearer ff_env_key_6789']);
  });
});
