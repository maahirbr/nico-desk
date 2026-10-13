import { bad, forbidden } from '@/lib/errors';
import { isLeadOrAdmin } from '@/lib/roles';
import { route } from '@/lib/http';
import { listMeetings, type Provider } from '@/lib/connectors';

// The stored key is a lead's, so only leads and admins browse its meetings (audit 13 Oct). Members paste minutes.
export const GET = route<{ provider: string }>(async ({ req, params, me }) => {
  if (!isLeadOrAdmin(me.person.appRoles)) throw forbidden('Only a lead can browse connected meetings. Paste the minutes instead.');
  if (params.provider !== 'granola' && params.provider !== 'fireflies') throw bad('invalid_body', 'Unknown source.');
  const u = new URL(req.url).searchParams;
  return listMeetings(params.provider as Provider, { days: Number(u.get('days') ?? 14) || 14, q: u.get('q')?.slice(0, 100) || undefined });
});
