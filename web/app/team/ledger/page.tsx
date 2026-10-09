// The ledger book: the last four weeks on one long sheet, each line judged against the date first given.
import { Suspense } from "react";
import { bookOf } from "@/components/ledger/book";
import { Ledger } from "@/components/ledger/Ledger";
import { Empty, Section } from "@/components/ui/Section";
import { todayIST } from "@/lib/db/dates";
import { ledgerLines } from "@/lib/db/queries-ui";
import { loadTeam, roster, type TeamSearch } from "@/lib/views";

// Weeks before this one. Three back plus this week is four weeks.
const WEEKS_BACK = 3;

async function LedgerBook({ sp }: { sp: Promise<TeamSearch> }) {
  const { team } = await loadTeam(sp);
  if (!team) return <Section title="Team"><Empty>You are not on a team yet.</Empty></Section>;
  const today = todayIST();
  const [people, lines] = await Promise.all([roster(team.teamId), ledgerLines(team.teamId, WEEKS_BACK, today)]);
  const who = new Map(people.map((p) => [p.id, { name: p.displayName, department: p.department }]));
  return <Ledger book={bookOf(lines, who, today, WEEKS_BACK)} teamName={team.teamName} today={today} />;
}

export default function LedgerPage({ searchParams }: PageProps<"/team/ledger">) {
  return (
    <Suspense fallback={null}>
      <LedgerBook sp={searchParams as Promise<TeamSearch>} />
    </Suspense>
  );
}
