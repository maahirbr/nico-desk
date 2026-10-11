import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { authUrl, googleSignInEnabled, readIdToken } from '../lib/google';

const CLIENT = 'client-123.apps.googleusercontent.com';
const now = () => Math.floor(Date.now() / 1000);

function jwt(claims: Record<string, unknown>): string {
  const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${enc({ alg: 'none' })}.${enc(claims)}.sig`;
}
const good = () => ({ iss: 'https://accounts.google.com', aud: CLIENT, exp: now() + 600, email: 'Ada@Example.test', email_verified: true });

describe('readIdToken', () => {
  it('accepts a good payload and lower-cases the email', () => {
    expect(readIdToken(jwt(good()), CLIENT)).toBe('ada@example.test');
    expect(readIdToken(jwt({ ...good(), iss: 'accounts.google.com' }), CLIENT)).toBe('ada@example.test');
  });
  it('rejects wrong aud, wrong iss, expired, unverified and missing email', () => {
    expect(readIdToken(jwt({ ...good(), aud: 'other' }), CLIENT)).toBeNull();
    expect(readIdToken(jwt({ ...good(), iss: 'https://evil.test' }), CLIENT)).toBeNull();
    expect(readIdToken(jwt({ ...good(), exp: now() - 1 }), CLIENT)).toBeNull();
    expect(readIdToken(jwt({ ...good(), email_verified: false }), CLIENT)).toBeNull();
    expect(readIdToken(jwt({ ...good(), email_verified: 'true' }), CLIENT)).toBeNull();
    const { email: _email, ...noEmail } = good();
    expect(readIdToken(jwt(noEmail), CLIENT)).toBeNull();
  });
  it('rejects junk', () => {
    expect(readIdToken('not-a-jwt', CLIENT)).toBeNull();
    expect(readIdToken('a.!!!.c', CLIENT)).toBeNull();
  });
});

describe('authUrl and googleSignInEnabled', () => {
  const saved = { id: process.env.GOOGLE_CLIENT_ID, secret: process.env.GOOGLE_CLIENT_SECRET, domain: process.env.NICO_ALLOWED_DOMAIN };
  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = CLIENT;
    process.env.GOOGLE_CLIENT_SECRET = 'secret';
    process.env.NICO_ALLOWED_DOMAIN = 'example.test';
  });
  afterEach(() => {
    for (const [k, v] of [['GOOGLE_CLIENT_ID', saved.id], ['GOOGLE_CLIENT_SECRET', saved.secret], ['NICO_ALLOWED_DOMAIN', saved.domain]] as const) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  });

  it('carries client, redirect, state, domain hint and scope', () => {
    const u = new URL(authUrl('http://localhost:3100/api/auth/google/callback', 'abc'));
    expect(u.origin + u.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(u.searchParams.get('client_id')).toBe(CLIENT);
    expect(u.searchParams.get('redirect_uri')).toBe('http://localhost:3100/api/auth/google/callback');
    expect(u.searchParams.get('state')).toBe('abc');
    expect(u.searchParams.get('hd')).toBe('example.test');
    expect(u.searchParams.get('scope')).toBe('openid email');
    expect(u.searchParams.get('response_type')).toBe('code');
  });
  it('is enabled only when both id and secret are set', () => {
    expect(googleSignInEnabled()).toBe(true);
    process.env.GOOGLE_CLIENT_SECRET = '  ';
    expect(googleSignInEnabled()).toBe(false);
  });
});
