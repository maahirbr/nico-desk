import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireMe } from '@/lib/auth';
import { db } from '@/lib/db';
import { ApiError } from '@/lib/errors';
import { one, type SP } from '@/lib/page';
import { hrefOf, mapQuery, parseFocus, threadMapFor } from '@/lib/threadMap';
import { ThreadMapView } from '@/components/ThreadMapView';

export const dynamic = 'force-dynamic';

// The thread map (13 Oct): /map?focus=task:<id>&hops=2&view=list. The address holds the whole view, so it can be shared.
// A bad address, a hidden item and a missing item all read as "not found", the same as the item pages.
export default async function MapPage({ searchParams }: { searchParams: SP }) {
  const me = await requireMe();
  const sp = await searchParams;
  const q = mapQuery.safeParse({ focus: one(sp.focus), hops: one(sp.hops) });
  const f = q.success ? parseFocus(q.data.focus) : null;
  if (!q.success || !f) notFound();
  let map;
  try {
    map = await threadMapFor(await db(), me, f.kind, f.id, { hops: q.data.hops });
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) notFound();
    throw e;
  }
  const start = map.nodes.find((n) => n.id === map.focus)!;
  const itemHref = hrefOf(map.focus);
  return (
    <>
      <Link className="crumb" href={itemHref}>← {start.label}</Link>
      <h1>Thread map</h1>
      <ThreadMapView map={map} view={one(sp.view) === 'list' ? 'list' : 'map'} itemHref={itemHref} />
    </>
  );
}
