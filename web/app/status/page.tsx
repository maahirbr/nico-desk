import { redirect } from 'next/navigation';
import { one, type SP } from '@/lib/page';

// By status now lives on Team.
export default async function Status({ searchParams }: { searchParams: SP }) {
  const w = one((await searchParams).week);
  redirect(`/team?view=status${w ? `&week=${w}` : ''}`);
}
