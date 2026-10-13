import { z } from 'zod';
import { bad, forbidden } from '@/lib/errors';
import { isLeadOrAdmin } from '@/lib/roles';
import { readBody, route } from '@/lib/http';
import { connectionStatus, isProvider, PROVIDERS, removeConnection, saveConnection } from '@/lib/connectors';

// Meeting-notes connections for the team. Only leads and admins add or remove keys; the key
// itself never comes back from the server, only whether it is set and its last four characters.
const lead = (roles: string[]) => { if (!isLeadOrAdmin(roles)) throw forbidden('Only a lead can manage connections.'); };

export const GET = route(async () => connectionStatus());

export const POST = route(async ({ req, me }) => {
  lead(me.person.appRoles);
  const b = await readBody(req, z.object({ provider: z.enum(PROVIDERS as [string, ...string[]]), apiKey: z.string().min(1).max(400) }).strict());
  if (!isProvider(b.provider)) throw bad('invalid_body', 'Unknown source.', 'provider');
  await saveConnection(b.provider, b.apiKey, me.person.id);
  return connectionStatus();
});

export const DELETE = route(async ({ req, me }) => {
  lead(me.person.appRoles);
  const p = new URL(req.url).searchParams.get('provider');
  if (isProvider(p)) removeConnection(p);
  return connectionStatus();
});
