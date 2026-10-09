import { route } from '@/lib/http';
import { markNoticeRead } from '@/lib/service';

export const POST = route<{ id: string }>(async ({ params, me, db }) => {
  await markNoticeRead(db, me.person.id, params.id);
  return new Response(null, { status: 204 });
});
