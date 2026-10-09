import { bad } from '@/lib/errors';
import { route } from '@/lib/http';
import { getMeeting, type Provider } from '@/lib/connectors';

export const GET = route<{ provider: string; id: string }>(async ({ params }) => {
  if (params.provider !== 'granola' && params.provider !== 'fireflies') throw bad('invalid_body', 'Unknown source.');
  return getMeeting(params.provider as Provider, params.id);
});
