// Every job returns the same small result, so /dev/jobs can print it. Jobs are idempotent:
// a second run on the same day (or week) creates nothing new.
export type JobResult = { created: number; skipped: number; lines: string[] };
export const sendId = () => `snd_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36)}`;
