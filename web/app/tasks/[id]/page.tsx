import { notFound } from "next/navigation";
import { Suspense } from "react";
import { TaskActions } from "@/components/TaskActions";
import { Mark } from "@/components/ui/Mark";
import { Pair } from "@/components/ui/Row";
import { Empty, Section } from "@/components/ui/Section";
import { getPersonOrRedirect, isAdmin, isLeadOf, isOnTeam } from "@/lib/auth";
import { todayIST } from "@/lib/db/dates";
import { taskLog } from "@/lib/db/queries";
import { PRIORITY_WORD, dateLine, fmtDay, lateBy, outcomeOf, outcomeWord } from "@/lib/format";
import { enrich, getTask, logLines, nameMap, projectMap, roster } from "@/lib/views";

async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const person = await getPersonOrRedirect();
  const raw = await getTask(id);
  if (!raw || (!isOnTeam(person, raw.teamId) && !isAdmin(person))) notFound();
  const [t] = await enrich([raw]);
  const today = todayIST();
  const lead = isLeadOf(person, t.teamId);
  const owner = t.ownerId === person.id;
  const can = { owner, lead, clearBlock: owner || lead || t.blockedOnId === person.id };
  const [names, projs, team, log] = await Promise.all([nameMap(), projectMap(), roster(t.teamId), taskLog(id, { newestFirst: true })]);
  const lines = logLines(log, names, projs);
  const outcome = t.statusCategory === "done" && t.closedOn ? outcomeOf(t.closedOn, t.firstDueOn) : null;
  const late = t.statusCategory === "open" && t.dueOn < today ? lateBy(t.firstDueOn, today) : null;
  return (
    <>
      <Section title="Task" right={t.origin === "sheet" ? "From Sheet, read only" : undefined}>
        <h1 className="mb-4 text-(length:--text-xl) font-medium">{t.title}</h1>
        <dl>
          <Pair label="Health">{outcome ? <Mark kind={outcome} word={outcomeWord(outcome)} /> : <Mark kind={t.health} />}{late ? <span className="ml-4 font-medium">{late}</span> : null}</Pair>
          <Pair label="Dates">{dateLine(t.dueOn, t.firstDueOn, t.moves)}</Pair>
          <Pair label="First due date">{fmtDay(t.firstDueOn)} <span className="alt-meta ml-2">Locked. It never changes.</span></Pair>
          <Pair label="Owner">{t.ownerName}</Pair>
          <Pair label="Project">{t.projectName ?? "None"}</Pair>
          <Pair label="Status">{t.statusCategory === "open" ? "Open" : t.statusCategory === "done" ? `Done ${t.closedOn ? fmtDay(t.closedOn) : ""}` : "Dropped"}</Pair>
          <Pair label="Priority">{t.priority ? `${PRIORITY_WORD[t.priority]}${t.prioritySetBy ? `, set by ${names.get(t.prioritySetBy) ?? t.prioritySetBy}` : ""}` : "Not set"}</Pair>
          <Pair label="Blocked">{t.blockedOnName ? `Blocked on ${t.blockedOnName}${t.blockedAsk ? `: ${t.blockedAsk}` : ""}` : "No"}</Pair>
          <Pair label="Note">{t.note ?? "None"}</Pair>
        </dl>
      </Section>
      <TaskActions t={t} can={can} team={team} />
      <Section title="Log" right={`${lines.length} lines, newest first`}>
        {lines.length === 0 ? <Empty>No log lines.</Empty> : (
          <ol>
            {lines.map((l) => (
              <li key={l.id} className="py-2" style={{ borderBottom: "var(--rule-item)" }}>
                <p><span className="font-medium">{l.who}</span> <span className="alt-meta">{l.when}</span></p>
                <p>{l.what}</p>
                {l.reason ? <p className="alt-meta">Reason: {l.reason}</p> : null}
              </li>
            ))}
          </ol>
        )}
      </Section>
    </>
  );
}

export default function Page({ params }: PageProps<"/tasks/[id]">) {
  return (
    <Suspense fallback={null}>
      <TaskPage params={params} />
    </Suspense>
  );
}
