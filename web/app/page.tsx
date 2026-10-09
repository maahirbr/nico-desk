import { redirect } from 'next/navigation';
import { currentMe } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Leads and admins open on the team's week, members on their own.
export default async function Home() {
  const me = await currentMe();
  if (!me) redirect('/signin');
  redirect(me.person.appRoles.some((r) => r === 'lead' || r === 'admin') ? '/team' : '/me');
}
