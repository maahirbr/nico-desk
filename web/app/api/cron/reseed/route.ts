import { db } from '@/lib/db';
import { errorResponse } from '@/lib/http';
import { reseed, reseedDue } from '@/lib/reseed';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Vercel cron, daily. Wipes and reseeds the hosted demo database when it was seeded for an earlier
// IST week, so seeded dates stay current. Needs no secret: a second call in the same week does nothing.
export async function GET() {
  try {
    if (!process.env.DATABASE_URL) return Response.json({ reseeded: false, reason: 'no hosted database' });
    const reseeded = await (await db()).transaction(async (tx) => {
      if (!(await reseedDue(tx))) return false;
      await reseed(tx);
      return true;
    });
    return Response.json({ reseeded });
  } catch (e) {
    return errorResponse(e);
  }
}
