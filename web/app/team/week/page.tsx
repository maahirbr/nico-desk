import Link from "next/link";
import { Suspense } from "react";
import { TaskLine } from "@/components/TaskLine";
import { TeamTabs } from "@/components/TeamTabs";
import { Empty, Section } from "@/components/ui/Section";
import { addDays, isIsoDate, mondayOf, todayIST } from "@/lib/db/dates";
import { listTasksForTeamWeek } from "@/lib/db/queries";
import { weekLabel } from "@/lib/format";
import { enrich, loadTeam, roster, teamQuery, type TeamSearch } from "@/lib/views";

async function Week({ sp }: { sp: Promise<TeamSearch> }) {
  const { team, q } = await loadTeam(sp);
  if (!team) return <Section title="Team">{<Empty>You are not on a team yet.</Empty>}</Section>;
  const today = todayIST();
  const monday = q.week && isIsoDate(q.week) ? mondayOf(q.week) : mondayOf(today);
  const sunday = addDays(monday, 6);
  const [people, rows] = await Promise.all([roster(team.teamId), listTasksForTeamWeek(team.teamId, monday).then(enrich)]);
  const nav = (w: string) => `/team/week${teamQuery(q, { week: w })}`;
  return (
    <>
      <TeamTabs active="week" q={q} teamName={team.teamName} />
      <Section
        title={`Week of ${weekLabel(monday)}`}
        right={
          <span className="flex gap-5">
            <Link className="act caps" href={nav(addDays(monday, -7))}>Back a week</Link>
            <Link className="act caps" href={nav(mondayOf(today))}>This week</Link>
            <Link className="act caps" href={nav(addDays(monday, 7))}>Forward a week</Link>
          </span>
        }
      >
        <p className="alt-meta">Each person: tasks due this week, plus every open task past its date.</p>
      </Section>
      {people.map((p) => {
        const mine = rows.filter((t) => t.ownerId === p.id);
        const open = mine.filter((t) => t.statusCategory === "open");
        const counts = [
          `${open.length} open`,
          `${open.filter((t) => t.dueOn < today).length} overdue`,
          `${open.filter((t) => t.blockedOnId).length} blocked`,
          `${mine.filter((t) => t.closedOn && t.closedOn >= monday && t.closedOn <= sunday).length} closed this week`,
        ].join(" · ");
        return (
          <Section key={p.id} title={p.displayName} right={counts}>
            {mine.length === 0 ? <Empty>No tasks due this week.</Empty> : mine.map((t) => <TaskLine key={t.id} t={t} today={today} />)}
          </Section>
        );
      })}
    </>
  );
}

export default function WeekPage({ searchParams }: PageProps<"/team/week">) {
  return (
    <Suspense fallback={null}>
      <Week sp={searchParams as Promise<TeamSearch>} />
    </Suspense>
  );
}
