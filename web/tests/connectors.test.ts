import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { connectionStatus, firefliesNextSteps, getMeeting, listMeetings, removeConnection, saveConnection } from '../lib/connectors';
import { nextStepsOf, plainParse } from '../lib/planUtil';

// Meeting-notes connections, with the outside APIs faked: nothing leaves this machine in tests.

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nd-conn-'));
  process.env.NICO_DATA_DIR = dir;
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NICO_DATA_DIR;
  fs.rmSync(dir, { recursive: true, force: true });
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('reading action items', () => {
  it('turns Fireflies action items grouped by person into owner lines', () => {
    const t = firefliesNextSteps('**Kabir Sethi**\nSend the column list (12:30)\nBook the courier\n\n**Priya**\n- Share the board template by 14 Oct');
    expect(t).toBe('### Next Steps\n(Kabir Sethi) Send the column list\n(Kabir Sethi) Book the courier\n(Priya) Share the board template by 14 Oct');
    expect(plainParse(nextStepsOf(t), '2026-10-09').map((s) => [s.owner, s.task, s.due])).toEqual([
      ['Kabir Sethi', 'Send the column list', ''], ['Kabir Sethi', 'Book the courier', ''], ['Priya', 'Share the board template', '2026-10-14'],
    ]);
  });

  it('finds an "Action items" section in a Granola summary, with bold names as owners', () => {
    const md = '## Summary\nWe agreed the plan.\n\n### Action items\n**Ananya Rao**\n- Draft the craft story (Oct 15)\n- Ishaan: lay out the issue\n\n### Decisions\nShip on 20 Oct';
    const steps = plainParse(nextStepsOf(md), '2026-10-09');
    expect(steps.map((s) => [s.owner, s.task, s.due])).toEqual([['Ananya Rao', 'Draft the craft story', '2026-10-15'], ['Ishaan', 'Lay out the issue', '']]);
  });
});

describe('connections', () => {
  it('checks a Granola key before keeping it, and never shows it back', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      calls.push(`${url} ${(init.headers as Record<string, string>).Authorization}`);
      return json({ notes: [{ id: 'not_abcdefghijklmn', title: 'Web sync', created_at: '2026-10-08T05:00:00Z', attendees: [{ name: 'Kabir Sethi' }] }], hasMore: false });
    }));
    await expect(saveConnection('granola', 'nope', 'per_ada')).rejects.toThrow(/grn_/);
    await saveConnection('granola', 'grn_testkey12345', 'per_ada');
    expect(calls[0]).toMatch(/^https:\/\/public-api\.granola\.ai\/v1\/notes\?created_after=.*page_size=30 Bearer grn_testkey12345$/);
    expect(connectionStatus().granola).toMatchObject({ connected: true, hint: '…2345' });
    expect(JSON.stringify(connectionStatus())).not.toContain('grn_testkey');
    expect(fs.statSync(path.join(dir, 'connections.json')).mode & 0o777).toBe(0o600);
    expect(await listMeetings('granola', { days: 14 })).toEqual([{ id: 'not_abcdefghijklmn', title: 'Web sync', date: '2026-10-08', attendees: ['Kabir Sethi'] }]);
    removeConnection('granola');
    expect(connectionStatus().granola.connected).toBe(false);
  });

  it('refuses a key the tool rejects', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ errors: [{ message: 'Invalid API key' }] })));
    await expect(saveConnection('fireflies', 'ff_bad_key_123', 'per_ada')).rejects.toThrow(/rejected the API key/);
    expect(connectionStatus().fireflies.connected).toBe(false);
  });

  it('reads one Fireflies meeting into next steps', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_u: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      if (body.query.includes('transcripts(')) return json({ data: { transcripts: [] } });
      return json({ data: { transcript: { id: 'ff1', title: 'Sale sync', date: Date.parse('2026-10-07T06:00:00Z'), transcript_url: 'https://app.fireflies.ai/view/ff1',
        summary: { action_items: '**Arjun Nair**\nWrite the sale email (05:10)' } } } });
    }));
    await saveConnection('fireflies', 'ff_good_key_123', 'per_ada');
    const m = await getMeeting('fireflies', 'ff1');
    expect(m).toEqual({ id: 'ff1', title: 'Sale sync', date: '2026-10-07', text: '### Next Steps\n(Arjun Nair) Write the sale email', link: 'https://app.fireflies.ai/view/ff1' });
  });
});
