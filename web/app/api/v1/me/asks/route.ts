import { route } from '@/lib/http';
import { listAsks } from '@/lib/service';

export const GET = route(async ({ me, db }) => listAsks(db, me.team.id, me.person.id));
