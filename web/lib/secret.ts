import crypto from 'node:crypto';

// Vercel instances share no disk, so the session and job secrets cannot live in files there. They come
// from env, else from this derivation, which every instance computes alike. Acceptable only because the
// data is synthetic and there is no real sign-in: anyone holding DATABASE_URL or the project id can
// recompute it. Set NICO_SESSION_SECRET and NICO_JOB_SECRET before any real data goes in.
export function derivedSecret(purpose: string): string {
  const base = process.env.DATABASE_URL ?? process.env.VERCEL_PROJECT_ID ?? 'nico-desk';
  return crypto.createHmac('sha256', base).update(purpose).digest('hex');
}
