import { bad, forbidden } from '@/lib/errors';
import { mayOversee } from '@/lib/roles';
import { route } from '@/lib/http';
import { getMeeting, isProvider, type Provider } from '@/lib/connectors';

export const GET = route<{ provider: string; id: string }>(async ({ params, me }) => {
  if (!mayOversee(me.person.appRoles)) throw forbidden('Only leadership or an admin can read the team’s connected meetings. Paste the minutes instead.');
  if (!isProvider(params.provider)) throw bad('invalid_body', 'Unknown source.');
  return getMeeting(params.provider as Provider, params.id);
});
