import { route } from '@/lib/http';
import { mapQuery, parseFocus, threadMapFor } from '@/lib/threadMap';

// The thread map around one item: GET /api/v1/threads/map?focus=task:<id>&hops=2. The graph is cut by what the reader
// may see before it is built, so a hidden item reads as missing and is never a node.
export const GET = route(async ({ req, me, db }) => {
  const q = mapQuery.parse(Object.fromEntries(new URL(req.url).searchParams));
  const f = parseFocus(q.focus)!; // the pattern in mapQuery has already passed
  return threadMapFor(db, me, f.kind, f.id, { hops: q.hops });
});
