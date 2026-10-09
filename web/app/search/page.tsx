import Link from "next/link";
import { Suspense } from "react";
import { Empty, Section } from "@/components/ui/Section";
import { Row } from "@/components/ui/Row";
import { TaskLine } from "@/components/TaskLine";
import { getPersonOrRedirect } from "@/lib/auth";
import { istDay, todayIST } from "@/lib/db/dates";
import { searchTasks } from "@/lib/db/queries";
import { searchEvents, searchPeople } from "@/lib/db/queries-pipeline";
import { fmtDay } from "@/lib/format";
import { enrich } from "@/lib/views";

// FR-74: tasks (full text), people (by name) and events (the reason or an update). Note text is not searched.
async function Results({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const person = await getPersonOrRedirect();
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, 200) ?? "";
  if (!q) {
    return (
      <Section title="Search">
        <Empty>Type a word in the Find field. It looks in tasks, people and the reasons and updates in task logs.</Empty>
      </Section>
    );
  }
  const teamIds = person.memberships.map((m) => m.teamId);
  const today = todayIST();
  const [perTeam, ppl, evs] = await Promise.all([
    Promise.all(teamIds.map((t) => searchTasks(t, q))),
    searchPeople(teamIds, q),
    searchEvents(teamIds, q),
  ]);
  const found = await enrich(perTeam.flat());
  if (found.length + ppl.length + evs.length === 0) {
    return (
      <Section title="Search" right={q}>
        <Empty>Nothing matches “{q}”.</Empty>
      </Section>
    );
  }
  return (
    <>
      {found.length > 0 ? (
        <Section title="Tasks" right={`${found.length} found`}>
          {found.map((t) => <TaskLine key={t.id} t={t} today={today} showOwner />)}
        </Section>
      ) : null}
      {ppl.length > 0 ? (
        <Section title="People" right={`${ppl.length} found`}>
          {ppl.map((p) => (
            <Row key={p.id} className="block!">
              <Link href={`/team/week?person=${p.id}`} className="font-medium hover:underline">
                {p.name}
              </Link>
              <p className="alt-meta mt-1">{[p.role, p.department].filter(Boolean).join(" · ")}</p>
            </Row>
          ))}
        </Section>
      ) : null}
      {evs.length > 0 ? (
        <Section title="Log lines" right={`${evs.length} found`}>
          {evs.map((e) => (
            <Row key={e.id} className="block!">
              <Link href={`/tasks/${e.taskId}`} className="font-medium hover:underline">
                {e.taskTitle}
              </Link>
              <p className="alt-meta mt-1">{fmtDay(istDay(e.at))} · {e.text ?? e.reason}</p>
            </Row>
          ))}
        </Section>
      ) : null}
    </>
  );
}

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <Suspense fallback={null}>
      <Results searchParams={searchParams} />
    </Suspense>
  );
}
