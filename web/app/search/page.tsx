import { requireStaff } from '@/lib/auth';
import { one, type SP } from '@/lib/page';
import { SearchView } from '@/components/SearchView';

export const dynamic = 'force-dynamic';

export default async function SearchPage({ searchParams }: { searchParams: SP }) {
  await requireStaff();
  return <SearchView initial={one((await searchParams).q) ?? ''} />;
}
