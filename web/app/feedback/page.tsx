import { requireMe } from '@/lib/auth';
import { feedbackNewsForMe, listFeedback } from '@/lib/feedback';
import { db, scoped } from '@/lib/db';
import { fmtStamp } from '@/lib/time';
import { FeedbackForm } from '@/components/FeedbackForm';
import { FeedbackList } from '@/components/FeedbackList';

export const dynamic = 'force-dynamic';

// Feedback, for everyone: a box to write a note at the top, and the whole team's notes below it, newest first.
// Everyone reads every note and every reply, and anyone replies or marks a note Done or Not now. Closed notes fold away
// under Resolved and stay. Nothing here is emailed to anyone.
export default async function Feedback() {
  const me = await requireMe();
  const d = scoped(await db(), me.team.id);
  const [rows, news] = await Promise.all([listFeedback(d, me), feedbackNewsForMe(d, me)]);
  const open = rows.filter((r) => r.status === 'open').length;
  return (
    <>
      <h1>Feedback</h1>
      <p className="lede">You're one of the first users of Nico Desk, and we'd love to hear your thoughts.<br />Everyone on the team can read the notes.</p>
      <FeedbackForm />
      <section>
        <h2>From the team <span className="count-badge">{rows.length === 0 ? 'none yet' : `${open} open`}</span></h2>
        <FeedbackList meId={me.person.id} hasNews={news.length > 0}
          rows={rows.map((r) => ({ id: r.id, personId: r.personId, personName: r.personName, stamp: fmtStamp(r.createdAt), path: r.path, body: r.body, images: r.images, votes: r.votes, mine: r.mine,
            status: r.status, closedByName: r.closedByName, closedAt: r.closedAt ? new Date(r.closedAt).toISOString() : null, closedStamp: r.closedAt ? fmtStamp(r.closedAt) : null, closedNote: r.closedNote,
            replies: r.replies.map((x) => ({ id: x.id, authorName: x.authorName, body: x.body, stamp: fmtStamp(x.createdAt) })) }))} />
      </section>
    </>
  );
}
