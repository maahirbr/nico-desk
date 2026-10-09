import { redirect } from 'next/navigation';
import { allowedDomain, currentMe, devSignInEnabled, openDemo } from '@/lib/auth';
import { db, rosterFile } from '@/lib/db';
import { localOwnerId, TEAM_ID } from '@/lib/seed';
import { listPeople } from '@/lib/service';
import { SignInList } from '@/components/client';

export const dynamic = 'force-dynamic';

export default async function SignIn() {
  if (!openDemo() && (await currentMe())) redirect('/me');
  if (!devSignInEnabled()) {
    return (
      <div className="signin">
        <div className="signin-brand"><span className="mark-name">nico-desk</span></div>
        <h1>Sign in</h1>
        <p className="lede">Sign-in is not set up yet.</p>
      </div>
    );
  }
  const people = (await listPeople(await db(), TEAM_ID)).filter((p) => p.active && p.email.endsWith(`@${allowedDomain()}`));
  const ownerId = localOwnerId(rosterFile());
  const owner = people.find((p) => p.id === ownerId);
  return (
    <div className="signin">
      <div className="signin-brand"><span className="mark-name">nico-desk</span></div>
      <h1>Choose who you are</h1>
      {owner && (
        <div className="card signin-me">
          <SignInList people={[{ id: owner.id, name: owner.displayName, role: owner.role, roles: 'Continue as you' }]} />
        </div>
      )}
      {owner && <p className="small dim" style={{ margin: 'var(--space-lg) 0 var(--space-xs)' }}>Or see the desk as someone else</p>}
      <div className="card"><SignInList
        people={people.filter((p) => p.id !== owner?.id).map((p) => ({
          id: p.id, name: p.displayName, role: p.role, roles: p.appRoles.filter((r) => r !== 'member').join(', '),
        }))}
      /></div>
    </div>
  );
}
