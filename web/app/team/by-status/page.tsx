import Link from "next/link";
import { Suspense } from "react";
import { TeamTabs } from "@/components/TeamTabs";
import { Mark } from "@/components/ui/Mark";
import { Empty, Section } from "@/components/ui/Section";
import { addDays, isIsoDate, mondayOf, todayIST } from "@/lib/db/dates";
import { listTasksByStatus } from "@/lib/db/queries";
import { fmtDay, outcomeWord, weekLabel } from "@/lib/format";
import { enrich, loadTeam, teamQuery, type TaskRow, type TeamSearch } from "@/lib/views";

const COLUMNS = [
  ["not_started", "Not started"],
  ["on_track", "On track"],
  ["ahead", "Ahead"],
  ["off_track", "Off track"],
] as const;

function Column({ title, tone, rows }: { title: string; tone?: string; rows: TaskRow[] }) {
  return (
    <div>
      <h3 className="mb-2 pb-2" style={{ borderBottom: "var(--rule-row)" }}>
        <Mark kind={tone} word={`${title} (${rows.length})`} />
      </h3>
      {rows.length === 0 ? <Empty>None.</Empty> : rows.map((t) => (
        <div key={t.id} className="py-2" style={{ borderBottom: "var(--rule-item)" }}>
          <Link href={`/tasks/${t.id}`} className="font-medium hover:underline">{t.title}</Link>
          <p className="alt-meta">{t.ownerName} · due {fmtDay(t.dueOn)}</p>
        </div>
      ))}
    </div>
  );
}

async function ByStatus({ sp }: { sp: Promise<TeamSearch> }) {
  const { team, q } = await loadTeam(sp);
  if (!team) return <Section title="Team"><Empty>You are not on a team yet.</Empty></Section>;
  const today = todayIST();
  const monday = q.week && isIsoDate(q.week) ? mondayOf(q.week) : mondayOf(today);
  const g = await listTasksByStatus(team.teamId, monday);
  const by = Object.fromEntries(await Promise.all(Object.entries(g.byHealth).map(async ([k, v]) => [k, await enrich(v)])));
  const closed = {
    ahead: await enrich(g.closed.ahead),
    on_time: await enrich(g.closed.on_time),
    late: await enrich(g.closed.late),
  };
  const open = Object.values(by).flat() as TaskRow[];
  const overdue = open.filter((t) => t.dueOn < today);
  const nav = (w: string) => `/team/by-status${teamQuery(q, { week: w })}`;
  return (
    <>
      <TeamTabs active="by-status" q={q} teamName={team.teamName} />
      <Section title="Open tasks by health" right={`${open.length} open`}>
        <div className="grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
          {COLUMNS.map(([k, label]) => <Column key={k} title={label} tone={k} rows={(by[k] ?? []) as TaskRow[]} />)}
          <Column title="Overdue" tone="late" rows={overdue} />
        </div>
      </Section>
      <Section
        title={`Closed, week of ${weekLabel(monday)}`}
        right={
          <span className="flex gap-5">
            <Link className="act caps" href={nav(addDays(monday, -7))}>Back a week</Link>
            <Link className="act caps" href={nav(addDays(monday, 7))}>Forward a week</Link>
          </span>
        }
      >
        <div className="grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
          {(["ahead", "on_time", "late"] as const).map((k) => (
            <Column key={k} title={outcomeWord(k)[0].toUpperCase() + outcomeWord(k).slice(1)} tone={k} rows={closed[k]} />
          ))}
        </div>
      </Section>
    </>
  );
}

export default function ByStatusPage({ searchParams }: PageProps<"/team/by-status">) {
  return (
    <Suspense fallback={null}>
      <ByStatus sp={searchParams as Promise<TeamSearch>} />
    </Suspense>
  );
}
