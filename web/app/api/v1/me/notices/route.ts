import { route } from '@/lib/http';
import { listNotices } from '@/lib/service';

export const GET = route(async ({ req, me, db }) =>
  listNotices(db, me.person.id, new URL(req.url).searchParams.get('unread') === 'true'),
);
