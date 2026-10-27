import crypto from 'node:crypto';
import { db } from '@/lib/db';
import { ApiError } from '@/lib/errors';
import { errorResponse } from '@/lib/http';
import { jobSecret } from '@/lib/jobs';
import { runReminders } from '@/lib/service';

function same(got: string, want: string): boolean {
  const a = Buffer.from(got), b = Buffer.from(want);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function run(ok: boolean) {
  try {
    if (!ok) throw new ApiError(401, 'not_signed_in', 'Bad job secret.');
    return Response.json({ created: await runReminders(await db()) });
  } catch (e) {
    return errorResponse(e);
  }
}

// Called with the job secret (SPEC.md 4.7). Locally: npm run job:reminders.
export async function POST(req: Request) {
  return run(same(req.headers.get('x-job-secret') ?? '', jobSecret()));
}

// Vercel cron at 09:00 Asia/Kolkata (web/vercel.json) sends GET with Bearer CRON_SECRET. Refused while CRON_SECRET is unset.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  return run(!!secret && same(req.headers.get('authorization') ?? '', `Bearer ${secret}`));
}
