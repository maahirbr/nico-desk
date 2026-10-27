import { afterEach, describe, expect, it, vi } from 'vitest';

// Hosted guard (audit 13 Oct): with a hosted database (real data), the picker and open demo stay off and a
// derived secret is refused, so a missing env var fails loudly instead of signing anyone in.

vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }), headers: async () => new Headers() }));

import { devSignInEnabled, openDemo } from '../lib/auth';
import { derivedSecret } from '../lib/secret';

afterEach(() => vi.unstubAllEnvs());

describe('hosted guard', () => {
  it('keeps the picker and open demo on locally', () => {
    vi.stubEnv('DATABASE_URL', '');
    vi.stubEnv('NICO_DEV_SIGNIN', '1');
    vi.stubEnv('NICO_OPEN_DEMO', '1');
    expect(devSignInEnabled()).toBe(true);
    expect(openDemo()).toBe(true);
  });

  it('turns the picker and open demo off with a hosted database', () => {
    vi.stubEnv('DATABASE_URL', 'postgres://example.test/db');
    vi.stubEnv('NICO_DEV_SIGNIN', '1');
    vi.stubEnv('NICO_OPEN_DEMO', '1');
    expect(devSignInEnabled()).toBe(false);
    expect(openDemo()).toBe(false);
    vi.stubEnv('NICO_ALLOW_DEMO_IN_HOSTED', '1');
    expect(devSignInEnabled()).toBe(true);
  });

  it('turns the picker and open demo off on Vercel production, with no override', () => {
    vi.stubEnv('DATABASE_URL', '');
    vi.stubEnv('NICO_DEV_SIGNIN', '1');
    vi.stubEnv('NICO_OPEN_DEMO', '1');
    vi.stubEnv('NICO_ALLOW_DEMO_IN_HOSTED', '1');
    vi.stubEnv('VERCEL_ENV', 'production');
    expect(devSignInEnabled()).toBe(false);
    expect(openDemo()).toBe(false);
    vi.stubEnv('VERCEL_ENV', 'preview');
    expect(openDemo()).toBe(true);
  });

  it('refuses a derived secret with a hosted database', () => {
    vi.stubEnv('DATABASE_URL', '');
    expect(derivedSecret('job', 'NICO_JOB_SECRET')).toMatch(/^[0-9a-f]{64}$/);
    vi.stubEnv('DATABASE_URL', 'postgres://example.test/db');
    expect(() => derivedSecret('job', 'NICO_JOB_SECRET')).toThrow('NICO_JOB_SECRET must be set');
  });
});
