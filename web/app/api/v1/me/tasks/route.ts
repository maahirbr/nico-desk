import { route } from '@/lib/http';
import { myTasks } from '@/lib/service';

export const GET = route(async ({ me, db }) => myTasks(db, me.person.id, me.team.id));
