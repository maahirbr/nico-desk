import { describe, expect, it } from 'vitest';
import { inviteText } from '../lib/invite';

// The copied invite names the address the admin has open, the Google sign-in and the email added.
describe('inviteText', () => {
  it('holds the site address, the Google work account and the email', () => {
    const t = inviteText('https://desk.example.test', ' New.Person@Example.Test ');
    expect(t).toContain('https://desk.example.test');
    expect(t).toContain('Google work account');
    expect(t).toContain('new.person@example.test');
  });
  it('uses the origin it is given, never a fixed one', () => {
    expect(inviteText('http://localhost:3100', 'a@b.test')).toContain('http://localhost:3100');
    expect(inviteText('http://localhost:3100', 'a@b.test')).not.toContain('vercel.app');
  });
});

describe('inviteEmail', () => {
  it('greets them by first name, gives the two steps and signs off with the admin', async () => {
    const { inviteEmail } = await import('../lib/invite');
    const m = inviteEmail('https://desk.example.test', ' Ravi@Example.Test ', 'Ravi Rai', 'Sam Lee');
    expect(m.subject).toBe('Join NicoDesk');
    expect(m.body).toContain('Hi Ravi,');
    expect(m.body).toContain('1. Open https://desk.example.test');
    expect(m.body).toContain('using this email: ravi@example.test');
    expect(m.body.trim().endsWith('Sam')).toBe(true);
  });
});
