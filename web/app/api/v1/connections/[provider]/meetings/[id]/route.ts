import { bad, forbidden } from '@/lib/errors';
import { isLeadOrAdmin } from '@/lib/roles';
import { route } from '@/lib/http';
import { getMeeting, type Provider } from '@/lib/connectors';

export const GET = route<{ provider: string; id: string }>(async ({ params, me }) => {
  if (!isLeadOrAdmin(me.person.appRoles)) throw forbidden('Only a lead can read connected meetings. Paste the minutes instead.');
  if (params.provider !== 'granola' && params.provider !== 'fireflies') throw bad('invalid_body', 'Unknown source.');
  return getMeeting(params.provider as Provider, params.id);
});
