// Monday mode (/team/monday). One shared screen for the lead: last week's page on the left, the drafts waiting in
// the middle, this week's sheets on the right. The lead carries lines, closes them and accepts drafts without
// leaving the page. A member sees one sentence and a link back to the desk.
import Link from "next/link";
import { Suspense } from "react";
import { lineNow, moveMap, prepare, replayAll } from "@/components/desk/asof";
import { Week } from "@/components/ledger/Ledger";
import { bookOf } from "@/components/ledger/book";
import { DraftColumn, type NoteGroup } from "@/components/monday/DraftColumn";
import { toTableDrafts } from "@/components/monday/map";
import { OpenLines, type OpenLineData } from "@/components/monday/OpenLines";
import { Sheets } from "@/components/monday/Sheets";
import type { TablePerson } from "@/components/table/types";
import { Empty, Section } from "@/components/ui/Section";
import { fmtShort, inkOf, markOf, weekLines } from "@/components/week/lines";
import { isLeadOf } from "@/lib/auth";
import { addDays, mondayOf, todayIST } from "@/lib/db/dates";
import { listDrafts } from "@/lib/db/queries-pipeline";
import { deskHistory, dueMovesOf, ledgerLines, openPastDue, taskTitlesOf } from "@/lib/db/queries-ui";
import { fmtDay } from "@/lib/format";
import { loadTeam, roster, type TeamSearch } from "@/lib/views";

const count = (n: number, one: string, many: string) => (n === 0 ? `No ${many}` : `${n} ${n === 1 ? one : many}`);

async function Monday({ sp }: { sp: Promise<TeamSearch> }) {
  const { person, team } = await loadTeam(sp);
  if (!team) return <Section title="Monday mode"><Empty>You are not on a team yet.</Empty></Section>;
  if (!isLeadOf(person, team.teamId)) {
    return (
      <Section title="Monday mode">
        <p className="py-2">The team lead runs Monday mode.</p>
        <Link href="/team" className="caps act">
          Go to the team desk
        </Link>
      </Section>
    );
  }
  const today = todayIST();
  const teamId = team.teamId;
  // The plan week starts today when today is a Monday, otherwise on the next Monday. Last week is the week before it.
  // So Friday and the Monday after show the same two weeks.
  const planMonday = mondayOf(today) === today ? today : addDays(mondayOf(today), 7);
  const planEnd = addDays(planMonday, 6);
  const lastMonday = addDays(planMonday, -7);
  const [people, history, past, pending, lines] = await Promise.all([
    roster(teamId),
    deskHistory(teamId),
    openPastDue(teamId, today),
    listDrafts([teamId], "pending"),
    ledgerLines(teamId, 1, today),
  ]);
  const [moves, dupTitles] = await Promise.all([
    dueMovesOf(past.map((t) => t.id)),
    taskTitlesOf(pending.flatMap((d) => (d.duplicateOf ? [d.duplicateOf] : []))),
  ]);

  const who = new Map(people.map((p) => [p.id, { name: p.displayName, department: p.department }]));
  const tablePeople: TablePerson[] = people.map((p) => ({ id: p.id, name: p.displayName, ink: inkOf(p.department) }));

  // Left column: the lines to carry or close, then last week's page.
  const open: OpenLineData[] = past.map((t) => {
    const w = who.get(t.ownerId);
    const last = (moves.get(t.id) ?? []).at(-1);
    const reason = last?.reason ? ` ${/[.!?]$/.test(last.reason) ? last.reason : `${last.reason}.`}` : "";
    return {
      id: t.id,
      version: t.version,
      title: t.title,
      owner: w?.name ?? t.ownerId,
      ink: inkOf(w?.department ?? ""),
      dueOn: t.dueOn,
      mark: markOf(t, t.dueOn, null, today),
      why: last ? `From ${fmtDay(last.from)}.${reason}` : null,
      fromSheet: t.origin === "sheet",
    };
  });
  const book = bookOf(lines, who, today, 1).weeks;
  const last = book.find((w) => w.monday === lastMonday) ?? book[0];

  // Middle column: pending drafts grouped by the note they came from.
  const rows = toTableDrafts(pending, tablePeople, dupTitles);
  const groups: NoteGroup[] = [];
  pending.forEach((d, i) => {
    const g = groups.find((x) => x.id === d.noteId);
    if (g) g.drafts.push(rows[i]);
    else groups.push({ id: d.noteId, title: d.noteTitle, drafts: [rows[i]] });
  });

  // Right column: each person's sheet for the plan week, read as of today. Open lines due after that week sit
  // under Later, so an accepted draft always lands on its owner's sheet, whatever its day.
  const prepared = prepare(history);
  const mv = moveMap(prepared);
  const rep = replayAll(prepared, today);
  const sheets = people.map((p) => {
    const mine = rep.filter((r) => r.t.ownerId === p.id);
    return {
      id: p.id,
      name: p.displayName,
      ink: inkOf(p.department),
      lines: weekLines(
        mine.map((r) => r.t),
        mv,
        planMonday,
        today,
      ),
      later: mine
        .filter((r) => !r.t.closedOn && r.t.statusCategory !== "done" && r.t.dueOn > planEnd)
        .map((r) => lineNow(r, mv, today))
        .sort((a, b) => a.due.localeCompare(b.due) || a.t.id.localeCompare(b.t.id)),
    };
  });

  const landed = last.totals.ahead + last.totals.onTime;
  const claim =
    last.totals.counted === 0
      ? "Last week: nothing came due."
      : `Last week: ${landed} of ${last.totals.counted} on or before the date first given.`;
  // A line that comes from a Sheet cannot be carried here, so it is counted apart.
  const sheetOnly = open.filter((l) => l.fromSheet).length;
  const carryable = open.length - sheetOnly;
  const sheetWords = sheetOnly === 0 ? "" : `, ${sheetOnly} to change on ${sheetOnly === 1 ? "its Sheet" : "their Sheets"}`;
  const headline = `${claim} ${count(pending.length, "draft", "drafts")} waiting. ${count(carryable, "line", "lines")} to carry${sheetWords}.`;

  return (
    <div className="dk mon">
      <div className="dk-top">
        <h1 className="claim">{headline}</h1>
        <p className="ctx">
          {team.teamName}. Planning the week of {fmtShort(planMonday)}.
        </p>
      </div>
      <div className="mon-grid">
        <div className="stack">
          <div className="sheet mon-col">
            <h2 className="caps mon-h">Last week</h2>
            <h3 className="caps mon-sh">Past their date</h3>
            <OpenLines lines={open} today={today} planMonday={planMonday} />
            <Week w={last} />
          </div>
        </div>
        <div className="stack">
          <div className="sheet mon-col">
            <h2 className="caps mon-h">Drafts waiting</h2>
            <DraftColumn groups={groups} people={tablePeople} isLead />
          </div>
        </div>
        <div className="stack">
          <div className="sheet mon-col">
            <h2 className="caps mon-h">Week of {fmtShort(planMonday)}</h2>
            <Sheets sheets={sheets} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MondayPage({ searchParams }: PageProps<"/team/monday">) {
  return (
    <Suspense fallback={null}>
      <Monday sp={searchParams as Promise<TeamSearch>} />
    </Suspense>
  );
}
