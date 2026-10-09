// The desk: every team member's sheet for the week, with an as-of scrubber along the bottom.
import Link from "next/link";
import { Suspense } from "react";
import { AskView } from "@/components/desk/AskView";
import { Desk } from "@/components/desk/Desk";
import type { AskKind } from "@/components/find/parse";
import { Empty, Section } from "@/components/ui/Section";
import { addDays, isIsoDate, mondayOf, todayIST } from "@/lib/db/dates";
import { deskHistory, owedEdges, quotesOfTeam } from "@/lib/db/queries-ui";
import { isAdmin, isLeadOf } from "@/lib/auth";
import { loadTeam, roster, teamQuery, type TeamSearch } from "@/lib/views";

const ASKS: AskKind[] = ["late", "waiting", "owed", "owes", "week"];
type DeskSearch = TeamSearch & { ask?: string };

async function TeamDesk({ sp }: { sp: Promise<DeskSearch> }) {
  const { person, team, q } = await loadTeam(sp);
  if (!team) return <Section title="Team">{<Empty>You are not on a team yet.</Empty>}</Section>;
  const ask = ASKS.find((a) => a === (q as DeskSearch).ask);
  if (ask && q.person) {
    const everyone = (await roster(team.teamId)).map((p) => ({ id: p.id, name: p.displayName, department: p.department }));
    return (
      <AskView
        ask={ask}
        personId={q.person}
        teamId={team.teamId}
        teamName={team.teamName}
        people={everyone}
        today={todayIST()}
        canSeeOwed={isLeadOf(person, team.teamId) || isAdmin(person)}
        back={`/team${teamQuery(q)}`}
      />
    );
  }
  const [people, tasks, quotes] = await Promise.all([roster(team.teamId), deskHistory(team.teamId), quotesOfTeam(team.teamId)]);
  // Owed shows who waits on whom. A lead of the team reads it, and so does an admin.
  const owed = isLeadOf(person, team.teamId) || isAdmin(person) ? await owedEdges(team.teamId) : undefined;
  const rows = people.map((p) => ({ id: p.id, name: p.displayName, role: p.role, department: p.department }));
  const today = todayIST();
  const asked = q.week && isIsoDate(q.week) ? mondayOf(q.week) : undefined;
  // Next week is the furthest the desk goes. A later week opens there.
  const next = addDays(mondayOf(today), 7);
  const initialWeek = asked && asked > next ? next : asked;
  const lead = isLeadOf(person, team.teamId);
  return (
    <>
      {lead ? (
        <p className="no-print px-[14px] pt-3">
          <Link href={`/team/monday${teamQuery(q)}`} className="caps act">
            Monday mode
          </Link>
        </p>
      ) : null}
      <Desk key={initialWeek ?? "now"} teamName={team.teamName} people={rows} tasks={tasks} today={today} quotes={quotes} initialWeek={initialWeek} team={q.team} owed={owed} />
    </>
  );
}

export default function TeamPage({ searchParams }: PageProps<"/team">) {
  return (
    <Suspense fallback={null}>
      <TeamDesk sp={searchParams as Promise<DeskSearch>} />
    </Suspense>
  );
}
