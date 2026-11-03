import { route } from '@/lib/http';
import { handoffLoad } from '@/lib/service';

// GET: what a person still holds (open tasks, live projects they own or lead, blocks waiting on them). Admins only.
export const GET = route<{ id: string }>(async ({ params, me, db }) => handoffLoad(db, me.person.id, me.team.id, params.id));
