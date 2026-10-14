import { z } from 'zod';
import { forbidden } from '@/lib/errors';
import { readBody, route } from '@/lib/http';
import { connectionStatus, removeConnection, saveConnection } from '@/lib/connectors';

// Meeting-notes connections for the team. Only leads and admins add or remove keys; the key
// itself never comes back from the server, only whether it is set and its last four characters.
const lead = (roles: string[]) => { if (!roles.includes('lead') && !roles.includes('admin')) throw forbidden('Only a lead can manage connections.'); };

export const GET = route(async () => connectionStatus());

export const POST = route(async ({ req, me }) => {
  lead(me.person.appRoles);
  const b = await readBody(req, z.object({ provider: z.enum(['granola', 'fireflies']), apiKey: z.string().min(1).max(400) }).strict());
  await saveConnection(b.provider, b.apiKey, me.person.id);
  return connectionStatus();
});

export const DELETE = route(async ({ req, me }) => {
  lead(me.person.appRoles);
  const p = new URL(req.url).searchParams.get('provider');
  if (p === 'granola' || p === 'fireflies') removeConnection(p);
  return connectionStatus();
});
