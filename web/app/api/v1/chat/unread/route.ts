import { route } from '@/lib/http';
import { unreadTotal } from '@/lib/teamchat';

// The count for the badge in the nav. Light on purpose: the nav asks for it while the tab is visible.
export const GET = route(async ({ me, db }) => ({ unread: await unreadTotal(db, me) }));
