import { protectedResource } from '@/lib/mcpAuth';

// Where Claude learns which server signs it in to /api/mcp (RFC 9728).
export function GET(req: Request) {
  return Response.json(protectedResource(new URL(req.url).origin));
}
