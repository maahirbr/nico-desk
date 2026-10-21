import type { Metadata } from 'next';
import { requireMe } from '@/lib/auth';
import { lookups } from '@/lib/page';
import { myProfile } from '@/lib/service';
import { ProfileForm } from '@/components/EditProfile';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Your profile · Nico Desk' };

// Your own name, nickname, phone and photo, reached from the account menu and from Edit profile on your page.
export default async function Profile() {
  const me = await requireMe();
  const { d } = await lookups(me);
  const profile = await myProfile(d, me.person.id);
  return (
    <div className="calm narrow">
      <h1>Your profile</h1>
      <ProfileForm personId={me.person.id} profile={profile} />
    </div>
  );
}
