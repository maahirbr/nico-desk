import { authServer } from '@/lib/mcpAuth';

// The OAuth server's own description (RFC 8414): where to register, ask for consent and fetch tokens.
export function GET(req: Request) {
  return Response.json(authServer(new URL(req.url).origin));
}
