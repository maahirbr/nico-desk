import { route } from '@/lib/http';
import { removeProjectLink } from '@/lib/projectLinks';

// DELETE: remove a key document. The project's owner, its lead or an admin (23 Nov).
export const DELETE = route<{ id: string; linkId: string }>(async ({ params, me, db }) => ({ links: await removeProjectLink(db, me, params.id, params.linkId) }));
