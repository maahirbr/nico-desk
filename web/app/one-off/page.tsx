import { requireStaff } from '@/lib/auth';
import { lookups } from '@/lib/page';
import { oneOffsGiven } from '@/lib/service';
import { today } from '@/lib/time';
import { OneOffView } from '@/components/OneOffView';

export const dynamic = 'force-dynamic';

// One-off tasks (20 Nov, the PM's call): the tasks you gave someone outside any project, so you can see what you sent and
// where it stands. Opened from the chip beside Personal on Home. Only yours, and an admin's in View as (20 Nov). Closed
// tasks show for 30 days, then leave the list (the tasks themselves stay).
export default async function OneOff() {
  const me = await requireStaff();
  const { d, names, activeOpts, isLead, projectNames } = await lookups(me);
  const t = today();
  const { open, closed } = await oneOffsGiven(d, me.team.id, me.person.id, t);
  return <OneOffView open={open} closed={closed} names={names} people={activeOpts} meId={me.person.id} isLead={isLead} today={t} projectNames={projectNames} />;
}
