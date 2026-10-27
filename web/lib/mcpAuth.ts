import crypto from 'node:crypto';
import { seal, unseal } from './auth';

// OAuth 2.1 for the MCP server (app/api/mcp/). nico-desk is its own authorization server: Claude registers itself
// (RFC 7591), sends the person to /connect, and they prove who they are with the app session or Google. Every
// client id, code and token is a sealed value (lib/auth.ts seal), so nothing is stored. A token names a person and
// the MCP address it was issued for (RFC 8707); the MCP route still checks that the person is active and allowed on
// every call, so deactivating someone ends their Claude access within the hour. Rotating NICO_SESSION_SECRET ends all of it.

export const SCOPE = 'tasks';
const CLIENT_TTL = 60 * 60 * 24 * 365;
const REQ_TTL = 600;
const CODE_TTL = 60;
const ACCESS_TTL = 60 * 60;
const REFRESH_TTL = 60 * 60 * 24 * 30;

export const REQ_COOKIE = 'nd_mcp_req';

export const resourceOf = (origin: string) => `${origin}/api/mcp`;

// Claude's own callback pages, and loopback for desktop and command-line clients (RFC 8252 7.3). Nothing else may
// receive a code, so a stranger who registers a client cannot send a person's code to their own site.
export function redirectAllowed(uri: string): boolean {
  let u: URL;
  try { u = new URL(uri); } catch { return false; }
  if (u.hash || u.username || u.password) return false;
  if (u.protocol === 'https:') return u.hostname === 'claude.ai' || u.hostname === 'claude.com';
  return u.protocol === 'http:' && (u.hostname === '127.0.0.1' || u.hostname === 'localhost' || u.hostname === '[::1]');
}

// Loopback redirects may use any port (RFC 8252 7.3); everything else must match exactly.
function sameRedirect(registered: string, given: string): boolean {
  if (registered === given) return true;
  try {
    const a = new URL(registered);
    const b = new URL(given);
    return a.protocol === 'http:' && redirectAllowed(registered) && a.hostname === b.hostname && a.pathname === b.pathname && a.search === b.search;
  } catch {
    return false;
  }
}

export type Client = { redirectUris: string[]; name: string };

export function registerClient(body: unknown): { clientId: string; client: Client } | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const uris = b.redirect_uris;
  if (!Array.isArray(uris) || uris.length < 1 || uris.length > 5 || !uris.every((u) => typeof u === 'string' && u.length <= 500 && redirectAllowed(u))) {
    return { error: 'Only Claude and loopback redirect addresses are allowed.' };
  }
  if (b.token_endpoint_auth_method !== undefined && b.token_endpoint_auth_method !== 'none') return { error: 'Only public clients (token_endpoint_auth_method none) are supported.' };
  const name = typeof b.client_name === 'string' ? b.client_name.trim().slice(0, 80) : '';
  const client = { redirectUris: uris as string[], name: name || 'Claude' };
  return { clientId: seal('mcp-client', client, CLIENT_TTL), client };
}

export const readClient = (clientId: string | null | undefined) => unseal<Client>('mcp-client', clientId);

// What the person is asked to approve, checked once at /connect and carried through Google in the REQ_COOKIE.
export type AuthRequest = { clientId: string; redirectUri: string; state: string; challenge: string; resource: string; name: string };

export function checkAuthRequest(q: URLSearchParams, origin: string): { req: AuthRequest } | { error: string; redirect?: string } {
  const clientId = q.get('client_id') ?? '';
  const client = readClient(clientId);
  if (!client) return { error: 'This connection request is not from a registered client. Start again from Claude.' };
  const redirectUri = q.get('redirect_uri') ?? client.redirectUris[0];
  if (!client.redirectUris.some((r) => sameRedirect(r, redirectUri))) return { error: 'The return address does not match the client.' };
  // From here on, errors go back to the client (RFC 6749 4.1.2.1).
  const state = (q.get('state') ?? '').slice(0, 500);
  const fail = (code: string) => ({ error: code, redirect: withParams(redirectUri, { error: code, state, iss: origin }) });
  if (q.get('response_type') !== 'code') return fail('unsupported_response_type');
  const challenge = q.get('code_challenge') ?? '';
  if (q.get('code_challenge_method') !== 'S256' || !/^[A-Za-z0-9_-]{43,128}$/.test(challenge)) return fail('invalid_request');
  const resource = q.get('resource') ?? resourceOf(origin);
  if (resource !== resourceOf(origin)) return fail('invalid_target');
  return { req: { clientId, redirectUri, state, challenge, resource, name: client.name } };
}

export const sealRequest = (r: AuthRequest) => seal('mcp-req', r, REQ_TTL);
export const readRequest = (v: string | null | undefined) => unseal<AuthRequest>('mcp-req', v);

export function withParams(uri: string, params: Record<string, string>): string {
  const u = new URL(uri);
  for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v);
  return u.toString();
}

// The page Claude gets back after the person said yes: a one-minute code bound to the client, the return address,
// the PKCE challenge and the resource.
export function issueCode(r: AuthRequest, personId: string, origin: string): string {
  const code = seal('mcp-code', { personId, clientId: r.clientId, redirectUri: r.redirectUri, challenge: r.challenge, resource: r.resource }, CODE_TTL);
  return withParams(r.redirectUri, { code, state: r.state, iss: origin });
}

type Code = { personId: string; clientId: string; redirectUri: string; challenge: string; resource: string };
type Refresh = { personId: string; clientId: string; aud: string };
export type Access = { personId: string; aud: string };

export type TokenOut = { access_token: string; token_type: 'Bearer'; expires_in: number; refresh_token: string; scope: string };
export type TokenError = { error: string; error_description: string };

const s256 = (v: string) => crypto.createHash('sha256').update(v).digest('base64url');

function tokensFor(personId: string, clientId: string, aud: string): TokenOut {
  return {
    access_token: seal('mcp-at', { personId, aud }, ACCESS_TTL),
    token_type: 'Bearer',
    expires_in: ACCESS_TTL,
    refresh_token: seal('mcp-rt', { personId, clientId, aud }, REFRESH_TTL),
    scope: SCOPE,
  };
}

// The token endpoint (RFC 6749 4.1.3 and 6), for public clients: the client id stands in for client authentication,
// and PKCE proves the code is being redeemed by the one who asked for it.
export function exchange(f: URLSearchParams, origin: string): TokenOut | TokenError {
  const no = (error: string, error_description: string): TokenError => ({ error, error_description });
  const clientId = f.get('client_id') ?? '';
  if (!readClient(clientId)) return no('invalid_client', 'Unknown client.');
  const resource = f.get('resource');
  if (resource && resource !== resourceOf(origin)) return no('invalid_target', 'This server issues tokens for its own MCP address only.');
  const grant = f.get('grant_type');
  if (grant === 'authorization_code') {
    const c = unseal<Code>('mcp-code', f.get('code'));
    if (!c || c.clientId !== clientId) return no('invalid_grant', 'The code is not valid or has expired.');
    if (f.get('redirect_uri') !== c.redirectUri) return no('invalid_grant', 'The return address does not match.');
    const verifier = f.get('code_verifier') ?? '';
    if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier) || s256(verifier) !== c.challenge) return no('invalid_grant', 'The PKCE check failed.');
    return tokensFor(c.personId, clientId, c.resource);
  }
  if (grant === 'refresh_token') {
    const r = unseal<Refresh>('mcp-rt', f.get('refresh_token'));
    if (!r || r.clientId !== clientId || r.aud !== resourceOf(origin)) return no('invalid_grant', 'The refresh token is not valid or has expired.');
    return tokensFor(r.personId, clientId, r.aud);
  }
  return no('unsupported_grant_type', 'Use authorization_code or refresh_token.');
}

// The person a bearer token speaks for, or null.
export function readAccess(header: string | null, origin: string): Access | null {
  const m = /^Bearer\s+(\S+)$/i.exec(header ?? '');
  const a = unseal<Access>('mcp-at', m?.[1]);
  return a && a.aud === resourceOf(origin) && typeof a.personId === 'string' ? a : null;
}

export function protectedResource(origin: string) {
  return {
    resource: resourceOf(origin),
    authorization_servers: [origin],
    scopes_supported: [SCOPE],
    bearer_methods_supported: ['header'],
    resource_name: 'nico-desk',
  };
}

export function authServer(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/connect`,
    token_endpoint: `${origin}/api/mcp/token`,
    registration_endpoint: `${origin}/api/mcp/register`,
    scopes_supported: [SCOPE],
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_methods_supported: ['none'],
    code_challenge_methods_supported: ['S256'],
    authorization_response_iss_parameter_supported: true,
  };
}

export const challengeHeader = (origin: string) =>
  `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource/api/mcp", scope="${SCOPE}"`;
