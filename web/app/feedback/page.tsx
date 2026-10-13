import { requireMe } from '@/lib/auth';
import { listFeedback } from '@/lib/feedback';
import { db } from '@/lib/db';
import { fmtStamp } from '@/lib/time';
import { FeedbackList } from '@/components/FeedbackList';

export const dynamic = 'force-dynamic';

// Pilot feedback, newest first. Admins only. Nothing here is emailed to anyone.
export default async function Feedback() {
  const me = await requireMe();
  if (!me.person.appRoles.includes('admin')) return (<><h1>Feedback</h1><p className="lede">Only an admin reads feedback.</p></>);
  const rows = await listFeedback(await db(), me);
  const unread = rows.filter((r) => !r.readAt).length;
  return (
    <>
      <h1>Feedback</h1>
      <p className="lede">Notes from the team, newest first. {unread === 0 ? 'All read.' : `${unread} not read yet.`}</p>
      <FeedbackList rows={rows.map((r) => ({ id: r.id, personName: r.personName, stamp: fmtStamp(r.createdAt), path: r.path, body: r.body, read: !!r.readAt }))} />
    </>
  );
}
