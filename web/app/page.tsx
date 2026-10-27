import { redirect } from 'next/navigation';
import { currentMe } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Everyone opens on Home (/me), at the repo owner's call. Leads and admins reach the team's week from the nav.
export default async function Home() {
  const me = await currentMe();
  if (!me) redirect('/signin');
  redirect('/me');
}
