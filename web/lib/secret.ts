import crypto from 'node:crypto';

// Vercel instances share no disk, so the session and job secrets cannot live in files there. They come
// from env, else from this derivation, which every instance computes alike. Acceptable only because the
// data is synthetic and there is no real sign-in: anyone holding DATABASE_URL or the project id can
// recompute it. So with a hosted database (real data) it refuses, and the env var must be set.
export function derivedSecret(purpose: string, envName: string): string {
  if (process.env.DATABASE_URL) throw new Error(`${envName} must be set when DATABASE_URL is set.`);
  const base = process.env.VERCEL_PROJECT_ID ?? 'nico-desk';
  return crypto.createHmac('sha256', base).update(purpose).digest('hex');
}
