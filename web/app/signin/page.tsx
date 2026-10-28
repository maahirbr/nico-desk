import { redirect } from 'next/navigation';
import { allowedDomain, currentMe, devSignInEnabled, emailAllowed, openDemo } from '@/lib/auth';
import { db, rosterFile } from '@/lib/db';
import { googleSignInEnabled } from '@/lib/google';
import { localOwnerId, TEAM_ID } from '@/lib/seed';
import { listPeople } from '@/lib/service';
import { SignInList } from '@/components/client';
import { DitherArt } from '@/components/DitherArt';
import { Wordmark } from '@/components/Wordmark';

export const dynamic = 'force-dynamic';

const ERRORS: Record<string, string> = {
  not_allowed: 'That account is not on the team roster. Ask the team admin to add you.',
  not_domain: 'That is not a company Google account. Choose your company account and try again.',
  state: 'Sign-in did not finish. Try again.',
  google: 'Sign-in did not finish. Try again.',
  cancelled: 'Sign-in did not finish. Try again.',
  not_configured: 'Google sign-in is not set up yet.',
};

export default async function SignIn({ searchParams }: { searchParams: Promise<{ error?: string; switch?: string }> }) {
  const { error, switch: switching } = await searchParams;
  const me = await currentMe();
  // An admin may come here from the account menu to see the desk as someone else.
  if (!openDemo() && me && !(switching && me.person.appRoles.includes('admin'))) redirect('/');
  const message = error && Object.hasOwn(ERRORS, error) ? ERRORS[error] : null;
  const google = googleSignInEnabled();
  const dev = devSignInEnabled();
  const art = <DitherArt field="glow" cols={56} rows={14} className="dither-signin" />;
  const brand = <div className="signin-brand"><Wordmark className="signin-logo" /><span className="mark-name">Nico Desk</span></div>;
  const notice = message && <p className="err" role="alert" style={{ marginBottom: 'var(--space-sm)' }}>{message}</p>;

  if (!google && !dev) {
    return (
      <div className="signin">
        {art}
        {brand}
        <h1>Sign in</h1>
        <p className="lede">Sign-in is not set up yet.</p>
        {notice}
      </div>
    );
  }

  const people = dev
    ? (await listPeople(await db(), TEAM_ID)).filter((p) => p.active && emailAllowed(p.email))
    : [];
  const ownerId = localOwnerId(rosterFile());
  const owner = people.find((p) => p.id === ownerId);
  return (
    <div className="signin">
      {art}
      {brand}
      {google && (
        <>
          <h1>Sign in</h1>
          <p className="lede">Use your {allowedDomain()} Google account.</p>
          {notice}
          <a className="btn" href="/api/auth/google" style={{ textDecoration: 'none' }}>Continue with Google</a>
        </>
      )}
      {dev && (
        <div style={google ? { marginTop: 'var(--space-xl)' } : undefined}>
          {!google && <h1>Choose who you are</h1>}
          {!google && notice}
          {google && <p className="small dim" style={{ margin: '0 0 var(--space-xs)' }}>Or see the desk as someone else</p>}
          {owner && !google && (
            <div className="card signin-me">
              <SignInList people={[{ id: owner.id, name: owner.displayName, role: owner.role, roles: 'Continue as you' }]} />
            </div>
          )}
          {owner && !google && <p className="small dim" style={{ margin: 'var(--space-lg) 0 var(--space-xs)' }}>Or see the desk as someone else</p>}
          <div className="card"><SignInList
            people={people.filter((p) => google || p.id !== owner?.id).map((p) => ({
              id: p.id, name: p.displayName, role: p.role, roles: p.appRoles.filter((r) => r !== 'member').join(', '),
            }))}
          /></div>
        </div>
      )}
    </div>
  );
}
