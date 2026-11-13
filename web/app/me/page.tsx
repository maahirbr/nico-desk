import { newsFor } from '@/lib/news';
import { requireMe } from '@/lib/auth';
import { latestEndedFirst } from '@/lib/derive';
import { homeUpdates, lookups } from '@/lib/page';
import { handoversForMe, listNotices, myTasks } from '@/lib/service';
import { seenProjects, seenTasks } from '@/lib/visibility';
import { addDays, istDate, mondayOf, today } from '@/lib/time';
import { myProjects } from '@/lib/plan';
import { feedbackNewsForMe } from '@/lib/feedback';
import { asksForMe } from '@/lib/asks';
import { HomeView } from '@/components/HomeView';
import { firstSeenDay } from '@/lib/activity';

export const dynamic = 'force-dynamic';

function greeting(): string {
  const h = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }).format(new Date()));
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default async function Home({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const me = await requireMe();
  const sp = await searchParams;
  const { d, sight, names, projectNames, activeOpts, isLead } = await lookups(me);
  const t = today();
  const updates = await homeUpdates(me, d, names, projectNames);
  const [mine, notices, all, projects, onProjects, replies, asks] = await Promise.all([
    myTasks(d, me.person.id, me.team.id, undefined, !me.viewingAs), listNotices(d, me.person.id, true, me.viewingAs), seenTasks(d, me, undefined, sight), seenProjects(d, me, sight),
    myProjects(d, me.team.id, me.person.id), feedbackNewsForMe(d, me), asksForMe(d, me),
  ]);
  const handovers = await handoversForMe(d, me.person.id, me.team.id);
  const news = me.viewingAs ? null : await newsFor(d, me.person.id);
  const projectOf = new Map(all.map((x) => [x.id, x.projectId]));
  // A proper first day (2 Nov): the welcome card shows in someone's first 7 days. ?welcome=1 shows it any time, to preview.
  const first = await firstSeenDay(d, me.realPerson.id);
  const isNew = sp.welcome === '1' || !first || first >= addDays(t, -6);
  const { rows: [prof] } = isNew ? await d.query<{ done: boolean }>(
    `SELECT (photo_url IS NOT NULL OR nickname IS NOT NULL OR phone IS NOT NULL OR EXISTS (SELECT 1 FROM person_photos f WHERE f.person_id = p.id)) AS done
       FROM people p WHERE id = $1`, [me.person.id]) : { rows: [] as { done: boolean }[] };
  const open = [...mine.assigned, ...mine.tasks];
  const welcome = isNew && !me.viewingAs ? {
    firstName: me.person.displayName.split(' ')[0], projects: onProjects.map((p) => p.name), waiting: open.length,
    late: open.filter((x) => x.dueOn < t).length, dueToday: open.filter((x) => x.dueOn === t).length, profileDone: !!prof?.done,
    firstTaskId: [...open].sort((a, b) => a.dueOn.localeCompare(b.dueOn))[0]?.id ?? null,
  } : null;
  const weekStart = mondayOf(t);
  const doneThisWeek = all.filter((x) => x.ownerId === me.person.id && x.statusCategory === 'done' && x.closedAt && istDate(x.closedAt) >= weekStart).sort(latestEndedFirst);
  // Dropped tasks fold away under Home's own collapsed list. A drop sets no closed_at, so all of them show there.
  const dropped = all.filter((x) => x.ownerId === me.person.id && x.statusCategory === 'dropped').sort(latestEndedFirst);
  const assignedNotice = Object.fromEntries(notices.filter((n) => n.kind === 'assigned').map((n) => [n.taskId, n.id]));
  // Tasks that were mine and went to someone else (an in-app notice, nothing is sent outside the app).
  const ownerNow = new Map(all.map((x) => [x.id, x.ownerId]));
  const movedAway = notices.filter((n) => n.kind === 'reassigned_away').map((n) => ({
    noticeId: n.id, taskId: n.taskId, title: n.taskTitle, toName: names[ownerNow.get(n.taskId) ?? ''] ?? null, canOpen: n.canOpen,
  }));
  return (
    <HomeView
      greeting={`${greeting()}, ${me.person.displayName.split(' ')[0]}`}
      today={t}
      weekEnd={addDays(weekStart, 6)}
      meId={me.person.id}
      updates={updates}
      isLead={isLead}
      mine={[...mine.assigned, ...mine.tasks]}
      newIds={mine.assigned.map((x) => x.id)}
      assignedNotice={assignedNotice}
      noticeIds={notices.map((n) => n.id)}
      movedAway={movedAway}
      feedbackReplies={replies.map((r) => ({ id: r.id, kind: r.kind, authorName: r.actorName, snippet: r.text && r.text.length > 140 ? `${r.text.slice(0, 137)}...` : r.text, note: r.note.length > 60 ? `${r.note.slice(0, 57)}...` : r.note, href: r.href }))}
      handovers={handovers}
      asks={asks.map((a) => ({ id: a.id, taskId: a.taskId, title: a.title, askerName: (names[a.askerId] ?? 'Someone').split(' ')[0], question: a.question, askedAt: a.askedAt,
        project: projectNames[projectOf.get(a.taskId) ?? ''] ?? null }))}
      waiting={mine.blockedOnMe}
      done={doneThisWeek}
      dropped={dropped}
      names={names}
      projectNames={projectNames}
      people={activeOpts}
      projects={projects.filter((p) => p.kind === 'tasks' && !p.archivedAt).map((p) => ({ id: p.id, name: p.name }))}
      workstreamsByProject={Object.fromEntries(projects.map((p) => [p.id, p.workstreams]))}
      myProjects={onProjects}
      welcome={welcome}
      news={news}
    />
  );
}
