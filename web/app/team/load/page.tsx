import { Suspense } from "react";
import { TeamTabs } from "@/components/TeamTabs";
import { Table } from "@/components/ui/Row";
import { Empty, Section } from "@/components/ui/Section";
import { addDays, mondayOf, todayIST } from "@/lib/db/dates";
import { loadView } from "@/lib/db/queries";
import { fmtDay } from "@/lib/format";
import { loadTeam, roster, type TeamSearch } from "@/lib/views";

async function Load({ sp }: { sp: Promise<TeamSearch> }) {
  const { team, q } = await loadTeam(sp);
  if (!team) return <Section title="Team"><Empty>You are not on a team yet.</Empty></Section>;
  const from = mondayOf(todayIST());
  const weeks = [0, 1, 2, 3].map((i) => addDays(from, 7 * i));
  const [people, cells] = await Promise.all([roster(team.teamId), loadView(team.teamId, from)]);
  const n = (id: string, w: string) => cells.find((c) => c.ownerId === id && c.weekMonday === w)?.open ?? 0;
  return (
    <>
      <TeamTabs active="load" q={q} teamName={team.teamName} />
      <Section title="Open tasks per person, next four weeks">
        <Table head={["Person", ...weeks.map((w) => `Week of ${fmtDay(w)}`)]}>
          {people.map((p) => (
            <tr key={p.id}>
              <td>{p.displayName}</td>
              {weeks.map((w) => <td key={w} className="num">{n(p.id, w)}</td>)}
            </tr>
          ))}
        </Table>
        <p className="alt-meta mt-4">Counts open tasks by the week of their current due date. Overdue tasks are not in this table.</p>
      </Section>
    </>
  );
}

export default function LoadPage({ searchParams }: PageProps<"/team/load">) {
  return (
    <Suspense fallback={null}>
      <Load sp={searchParams as Promise<TeamSearch>} />
    </Suspense>
  );
}
