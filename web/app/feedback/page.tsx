import { requireMe } from '@/lib/auth';
import { listFeedback, mayReplyFeedback } from '@/lib/feedback';
import { db, scoped } from '@/lib/db';
import { fmtStamp } from '@/lib/time';
import { FeedbackForm } from '@/components/FeedbackForm';
import { FeedbackList } from '@/components/FeedbackList';

export const dynamic = 'force-dynamic';

// Feedback, for everyone: a box to write a note at the top, and the whole team's notes below it, newest first.
// Everyone reads every note and every reply. Notes pile up; nothing marks them read. Only people the Roster lets reply
// can answer a note. Nothing here is emailed to anyone.
export default async function Feedback() {
  const me = await requireMe();
  const rows = await listFeedback(scoped(await db(), me.team.id), me);
  return (
    <>
      <h1>Feedback</h1>
      <p className="lede">You're one of the first users of Nico Desk, and we'd love to hear your thoughts.<br />Everyone on the team can read the notes.</p>
      <FeedbackForm />
      <section>
        <h2>From the team <span className="count-badge">{rows.length === 0 ? 'none yet' : rows.length === 1 ? '1 note' : `${rows.length} notes`}</span></h2>
        <FeedbackList meId={me.person.id} canReply={mayReplyFeedback(me.person) && !me.viewingAs}
          rows={rows.map((r) => ({ id: r.id, personId: r.personId, personName: r.personName, stamp: fmtStamp(r.createdAt), path: r.path, body: r.body, images: r.images, votes: r.votes, mine: r.mine,
            replies: r.replies.map((x) => ({ id: x.id, authorName: x.authorName, body: x.body, stamp: fmtStamp(x.createdAt) })) }))} />
      </section>
    </>
  );
}
