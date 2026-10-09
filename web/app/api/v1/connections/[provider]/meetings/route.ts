import { bad } from '@/lib/errors';
import { route } from '@/lib/http';
import { listMeetings, type Provider } from '@/lib/connectors';

export const GET = route<{ provider: string }>(async ({ req, params }) => {
  if (params.provider !== 'granola' && params.provider !== 'fireflies') throw bad('invalid_body', 'Unknown source.');
  const u = new URL(req.url).searchParams;
  return listMeetings(params.provider as Provider, { days: Number(u.get('days') ?? 14) || 14, q: u.get('q')?.slice(0, 100) || undefined });
});
