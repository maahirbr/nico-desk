import { errorResponse, rateLimit } from '@/lib/http';
import { registerClient } from '@/lib/mcpAuth';

// Dynamic client registration (RFC 7591). The client id is sealed, so nothing is stored; only Claude's and
// loopback return addresses are accepted (lib/mcpAuth.ts redirectAllowed).
export async function POST(req: Request) {
  try {
    rateLimit(`mcp-reg:${req.headers.get('x-forwarded-for') ?? 'local'}`, 10);
    const body = await req.json().catch(() => null);
    const out = registerClient(body);
    if ('error' in out) return Response.json({ error: 'invalid_redirect_uri', error_description: out.error }, { status: 400 });
    return Response.json({
      client_id: out.clientId,
      client_name: out.client.name,
      redirect_uris: out.client.redirectUris,
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
    }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return errorResponse(e);
  }
}
