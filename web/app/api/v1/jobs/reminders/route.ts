import crypto from 'node:crypto';
import { db } from '@/lib/db';
import { ApiError } from '@/lib/errors';
import { errorResponse } from '@/lib/http';
import { jobSecret } from '@/lib/jobs';
import { runReminders } from '@/lib/service';

// Called by cron at 09:00 Asia/Kolkata with the job secret (SPEC.md 4.7). Locally: npm run job:reminders.
export async function POST(req: Request) {
  try {
    const got = Buffer.from(req.headers.get('x-job-secret') ?? '');
    const want = Buffer.from(jobSecret());
    if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) throw new ApiError(401, 'not_signed_in', 'Bad job secret.');
    return Response.json({ created: await runReminders(await db()) });
  } catch (e) {
    return errorResponse(e);
  }
}
