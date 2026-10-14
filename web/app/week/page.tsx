import { redirect } from 'next/navigation';
import { one, type SP } from '@/lib/page';

// The week now lives on Team.
export default async function Week({ searchParams }: { searchParams: SP }) {
  const w = one((await searchParams).week);
  redirect(`/team${w ? `?week=${w}` : ''}`);
}
