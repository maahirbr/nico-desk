import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { currentRealMe } from '@/lib/auth';
import { googleSignInEnabled } from '@/lib/google';
import { checkAuthRequest, sealRequest } from '@/lib/mcpAuth';
import { Wordmark } from '@/components/Wordmark';

export const dynamic = 'force-dynamic';

// Where Claude sends a person to connect nico-desk (the OAuth authorization endpoint, lib/mcpAuth.ts).
// The person sees who is asking and where the answer goes, then says yes or no; app/api/mcp/authorize acts on it.
export default async function Connect({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) if (typeof v === 'string') q.set(k, v);
  const h = await headers();
  const origin = `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('x-forwarded-host') ?? h.get('host')}`;
  const checked = checkAuthRequest(q, origin);
  if ('error' in checked && checked.redirect) redirect(checked.redirect);
  const brand = <div className="signin-brand"><Wordmark className="signin-logo" /><span className="mark-name">NicoDesk</span></div>;
  if ('error' in checked) {
    return <div className="signin">{brand}<h1>Connect Claude</h1><p className="err" role="alert">{checked.error}</p></div>;
  }
  const r = checked.req;
  const me = await currentRealMe();
  const canSignIn = !!me || googleSignInEnabled();
  return (
    <div className="signin">
      {brand}
      <h1>Connect Claude</h1>
      <p className="lede">
        {r.name} wants to read and change tasks as you. It sees only what you can see here, and each change it makes
        shows “via Claude” in the history.
      </p>
      <p className="small dim">Returns to {new URL(r.redirectUri).host}{me ? `. Signed in as ${me.realPerson.displayName}.` : '.'}</p>
      {!canSignIn && <p className="err" role="alert">Sign-in is not set up yet.</p>}
      <form method="post" action="/api/mcp/authorize" style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-lg)' }}>
        <input type="hidden" name="req" value={sealRequest(r)} />
        {canSignIn && <button className="btn" type="submit">{me ? 'Allow' : 'Continue with Google'}</button>}
        <button className="btn ghost" type="submit" name="deny" value="1">Cancel</button>
      </form>
    </div>
  );
}
