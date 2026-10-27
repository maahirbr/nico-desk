import { allowedDomain } from './auth';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

function clientId(): string { return (process.env.GOOGLE_CLIENT_ID ?? '').trim(); }
function clientSecret(): string { return (process.env.GOOGLE_CLIENT_SECRET ?? '').trim(); }

export function googleSignInEnabled(): boolean {
  // On Vercel an unset session secret is derived from DATABASE_URL (lib/secret.ts), so anyone holding that URL
  // could forge a session. Real sign-in stays off until NICO_SESSION_SECRET is set.
  if (process.env.VERCEL && !(process.env.NICO_SESSION_SECRET ?? '').trim()) return false;
  return clientId() !== '' && clientSecret() !== '';
}

export function authUrl(redirectUri: string, state: string): string {
  const q = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile', // profile adds the photo address (the picture claim)
    state,
    prompt: 'select_account',
    hd: allowedDomain(),
  });
  return `${AUTH_URL}?${q}`;
}

// The ID token comes straight from Google's token endpoint over TLS, so its signature is not
// checked (OpenID Connect Core 3.1.3.7). Every claim that names who and for whom still is.
export function readIdToken(idToken: string, id: string): string | null {
  try {
    const part = idToken.split('.')[1];
    if (!part) return null;
    const c = JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as Record<string, unknown>;
    if (c.iss !== 'accounts.google.com' && c.iss !== 'https://accounts.google.com') return null;
    if (!id || c.aud !== id) return null;
    if (typeof c.exp !== 'number' || c.exp * 1000 <= Date.now()) return null;
    if (c.email_verified !== true) return null;
    if (typeof c.email !== 'string' || !c.email) return null;
    return c.email.toLowerCase();
  } catch {
    return null;
  }
}

// The profile photo address from a token readIdToken accepted. Only an https address counts; anything else is dropped.
export function readPicture(idToken: string): string | null {
  try {
    const c = JSON.parse(Buffer.from(idToken.split('.')[1] ?? '', 'base64url').toString('utf8')) as Record<string, unknown>;
    if (typeof c.picture !== 'string' || c.picture.length > 500) return null;
    const u = new URL(c.picture);
    return u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}

export async function exchangeCode(code: string, redirectUri: string): Promise<{ email: string; picture: string | null } | null> {
  try {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, client_id: clientId(), client_secret: clientSecret(), redirect_uri: redirectUri, grant_type: 'authorization_code',
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { id_token?: unknown };
    if (typeof json.id_token !== 'string') return null;
    const email = readIdToken(json.id_token, clientId());
    return email ? { email, picture: readPicture(json.id_token) } : null;
  } catch {
    return null;
  }
}
