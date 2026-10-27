import { errorResponse, rateLimit } from '@/lib/http';
import { exchange } from '@/lib/mcpAuth';

// The OAuth token endpoint: a code (with its PKCE verifier) or a refresh token in, a one-hour access token out.
export async function POST(req: Request) {
  try {
    rateLimit(`mcp-token:${req.headers.get('x-forwarded-for') ?? 'local'}`, 30);
    const form = new URLSearchParams(await req.text());
    const out = exchange(form, new URL(req.url).origin);
    const status = !('error' in out) ? 200 : out.error === 'invalid_client' ? 401 : 400;
    return Response.json(out, { status, headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } });
  } catch (e) {
    return errorResponse(e);
  }
}
