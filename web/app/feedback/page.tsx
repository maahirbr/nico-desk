import { requireMe } from '@/lib/auth';
import { listFeedback } from '@/lib/feedback';
import { db } from '@/lib/db';
import { fmtStamp } from '@/lib/time';
import { FeedbackForm } from '@/components/FeedbackForm';
import { FeedbackList } from '@/components/FeedbackList';

export const dynamic = 'force-dynamic';

// Feedback, for everyone: a box to write a note at the top, and the whole team's notes below it, newest first.
// Everyone reads every note; only an admin marks one read. Nothing here is emailed to anyone.
export default async function Feedback() {
  const me = await requireMe();
  const admin = me.person.appRoles.includes('admin');
  const rows = await listFeedback(await db(), me);
  const unread = rows.filter((r) => !r.readAt).length;
  return (
    <>
      <h1>Feedback</h1>
      <p className="lede">You are one of the first people using Nico Desk, and we want to hear how it is going. Everyone on the team can read the notes.</p>
      <FeedbackForm />
      <section>
          <h2>From the team <span className="count-badge">{rows.length === 0 ? 'none yet' : unread === 0 ? 'all read' : `${unread} not read`}</span></h2>
          <FeedbackList rows={rows.map((r) => ({ id: r.id, personId: r.personId, personName: r.personName, stamp: fmtStamp(r.createdAt), path: r.path, body: r.body, read: !!r.readAt, images: r.images, votes: r.votes, mine: r.mine }))} canMark={admin} meId={me.person.id} />
      </section>
    </>
  );
}
