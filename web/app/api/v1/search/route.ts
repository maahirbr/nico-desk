import { route } from '@/lib/http';
import { search } from '@/lib/search';

export const GET = route(async ({ req, me, db }) => search(db, me.team.id, (new URL(req.url).searchParams.get('q') ?? '').slice(0, 120)));
