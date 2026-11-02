import type { Metadata } from 'next';
import { requireMe } from '@/lib/auth';
import { GuideView } from '@/components/GuideView';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Guide · NicoDesk' };

// A short guide for the pilot team. Signed in only, like every other page: requireMe sends anyone else to sign-in.
export default async function Guide() {
  await requireMe();
  return <GuideView />;
}
