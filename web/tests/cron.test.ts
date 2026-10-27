import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

// The daily notice job: Vercel cron calls GET with Bearer CRON_SECRET; anything else is refused.

const state = vi.hoisted(() => ({ testDb: null as unknown }));
vi.mock('../lib/db', async (orig) => ({ ...(await orig<typeof import('../lib/db')>()), db: async () => state.testDb }));

import { openDb } from '../lib/db';
import { GET } from '../app/api/v1/jobs/reminders/route';

const call = (auth?: string) => GET(new Request('http://x/api/v1/jobs/reminders', { headers: auth ? { authorization: auth } : {} }));

describe('reminders cron GET', () => {
  const saved = process.env.CRON_SECRET;
  beforeAll(async () => { state.testDb = await openDb(); });
  afterEach(() => { if (saved === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = saved; });

  it('refuses while CRON_SECRET is unset, even with an empty bearer', async () => {
    delete process.env.CRON_SECRET;
    expect((await call()).status).toBe(401);
    expect((await call('Bearer ')).status).toBe(401);
  });
  it('refuses a wrong secret', async () => {
    process.env.CRON_SECRET = 'right';
    expect((await call('Bearer wrong')).status).toBe(401);
  });
  it('runs with the right secret', async () => {
    process.env.CRON_SECRET = 'right';
    const res = await call('Bearer right');
    expect(res.status).toBe(200);
    expect(typeof (await res.json()).created).toBe('number');
  });
});
