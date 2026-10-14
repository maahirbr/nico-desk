import { z } from 'zod';
import { readBody, route } from '@/lib/http';
import { logReminder, mayRemind, reminderDrafts } from '@/lib/reminders';

// GET: the drafts (leads only). POST: record that a lead opened or copied one to send it themselves.
export const GET = route(async ({ req, me, db }) => {
  mayRemind(me.person.appRoles);
  const u = new URL(req.url);
  const mode = u.searchParams.get('mode') === 'window' ? 'window' : 'overdue';
  const days = Math.min(Math.max(Number(u.searchParams.get('days') ?? 2) || 2, 1), 30);
  return reminderDrafts(db, me.team.id, { mode, days, projectId: u.searchParams.get('project') ?? undefined }, u.origin);
});

const Body = z.object({
  personId: z.string().min(1).max(80), channel: z.enum(['gmail', 'mail_app', 'copy']), subject: z.string().max(200), itemCount: z.number().int().min(0).max(500),
}).strict();

export const POST = route(async ({ req, me, db }) => {
  mayRemind(me.person.appRoles);
  await logReminder(db, me.team.id, me.person.id, await readBody(req, Body));
  return new Response(null, { status: 204 });
});
