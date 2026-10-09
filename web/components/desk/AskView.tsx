// What FIND opens for an Ask: one focused list built from the desk's own lines. Late lines, lines waiting on a
// person, what is owed to a person or by one, and a person's week. Server component: it reads once and renders
// the same Line the desk uses. The three owed questions are for the lead or an admin, like the Owed matrix.
import Link from "next/link";
import type { CSSProperties } from "react";
import type { AskKind } from "@/components/find/parse";
import { fmtLong, inkOf } from "@/components/week/lines";
import { addDays, mondayOf } from "@/lib/db/dates";
import { deskHistory, ledgerLines, owedEdges } from "@/lib/db/queries-ui";
import { Line } from "./Line";
import { lineNow, moveMap, prepare, replayAll, sheetLinesAt, type DeskLine } from "./asof";

type P = { id: string; name: string; department: string };
type Props = { ask: AskKind; personId: string; teamId: string; teamName: string; people: P[]; today: string; canSeeOwed: boolean; back: string };

type Group = { title: string | null; ink: string; lines: DeskLine[] };

const many = (n: number, one: string, more: string) => `${n} ${n === 1 ? one : more}`;

export async function AskView({ ask, personId, teamId, teamName, people, today, canSeeOwed, back }: Props) {
  const person = people.find((p) => p.id === personId);
  const frame = (title: string, ctx: string, body: React.ReactNode, ink = "var(--ink)") => (
    <div className="dk ask">
      <div className="dk-top">
        <h1 className="claim">{title}</h1>
        <p className="ctx">
          {teamName}. {ctx}{" "}
          <Link href={back} className="caps act">
            Back to the desk
          </Link>
        </p>
      </div>
      <div className="stack">
        <div className="sheet ps" style={{ "--p": ink } as CSSProperties}>
          {body}
        </div>
      </div>
    </div>
  );
  if (!person) return frame("That person is not on this team.", "", <p className="empty">Nothing to show.</p>);

  const owedAsk = ask === "waiting" || ask === "owed" || ask === "owes";
  if (owedAsk && !canSeeOwed) {
    return frame(`Who owes whom is for the team lead.`, "", <p className="empty">The lead and admins read this. Your own week is on Me.</p>);
  }

  const ink = inkOf(person.department);
  const prepared = prepare(await deskHistory(teamId));
  const moves = moveMap(prepared);
  const rep = replayAll(prepared, today);
  const byTask = new Map(rep.map((r) => [r.t.id, r]));
  const lineOf = (id: string): DeskLine | null => {
    const r = byTask.get(id);
    return r ? lineNow(r, moves, today) : null;
  };
  const byDue = (a: DeskLine, b: DeskLine) => a.due.localeCompare(b.due) || a.t.id.localeCompare(b.t.id);
  const nameOf = (id: string) => people.find((p) => p.id === id);

  let groups: Group[] = [];
  let title = "";
  let ctx = "";
  let none = "";

  if (ask === "late") {
    // Open lines past their date, and lines that closed late in the last four weeks.
    const open = rep.filter((r) => r.t.ownerId === person.id && r.t.statusCategory === "open" && r.t.dueOn < today).map((r) => lineNow(r, moves, today));
    const seen = new Set(open.map((l) => l.t.id));
    const judged = (await ledgerLines(teamId, 3, today))
      .filter((l) => l.ownerId === person.id && l.outcome === "late" && !seen.has(l.id))
      .map((l) => lineOf(l.id))
      .filter((l): l is DeskLine => l !== null);
    open.sort(byDue);
    judged.sort(byDue);
    groups = [
      { title: open.length ? "Open and past their date" : null, ink, lines: open },
      { title: judged.length ? "Closed late in the last four weeks" : null, ink, lines: judged },
    ];
    const n = open.length + judged.length;
    title = n === 0 ? `No line is late for ${person.name}.` : `${person.name} has ${many(n, "late line", "late lines")}.`;
    ctx = `${many(open.length, "open past its date", "open past their date")}, ${judged.length} closed late in the last four weeks. As of ${fmtLong(today)}.`;
    none = "Nothing is late.";
  } else if (ask === "week") {
    const mine = rep.filter((r) => r.t.ownerId === person.id).map((r) => r.t);
    const lines = sheetLinesAt(mine, moves, today).filter((l) => l.kind !== "out");
    groups = [{ title: null, ink, lines }];
    title = lines.length === 0 ? `Nothing is due this week for ${person.name}.` : `${person.name} has ${many(lines.length, "line", "lines")} this week.`;
    ctx = `Week of ${fmtLong(mondayOf(today))} to ${fmtLong(addDays(mondayOf(today), 6))}.`;
    none = "Nothing is due this week.";
  } else {
    const edges = await owedEdges(teamId);
    // waiting: open lines blocked on this person. owed: everything owed to this person. owes: everything this person owes.
    const pick = edges.filter((e) =>
      ask === "waiting" ? e.via === "blocked" && e.toId === person.id : ask === "owed" ? e.toId === person.id : e.ownerId === person.id,
    );
    const key = ask === "owes" ? (e: (typeof pick)[number]) => e.toId : (e: (typeof pick)[number]) => e.ownerId;
    const ids = [...new Set(pick.map(key))].filter((id) => nameOf(id));
    groups = ids.map((id) => ({
      title: ask === "owes" ? `Owed to ${nameOf(id)!.name}` : `${nameOf(id)!.name} owes`,
      ink: inkOf(nameOf(id)!.department),
      lines: pick
        .filter((e) => key(e) === id)
        .map((e) => lineOf(e.taskId))
        .filter((l): l is DeskLine => l !== null)
        .sort(byDue),
    }));
    const n = groups.reduce((s, g) => s + g.lines.length, 0);
    title =
      n === 0
        ? ask === "waiting" ? `Nothing is waiting on ${person.name}.` : ask === "owed" ? `Nothing is owed to ${person.name}.` : `${person.name} owes nothing.`
        : ask === "waiting" ? `${many(n, "line is", "lines are")} waiting on ${person.name}.`
        : ask === "owed" ? `${many(n, "open line is", "open lines are")} owed to ${person.name}.`
        : `${person.name} owes ${many(n, "open line", "open lines")}.`;
    ctx = `Read from the Owed matrix, as of ${fmtLong(today)}.`;
    none = "Nothing is open.";
  }

  const shown = groups.filter((g) => g.lines.length > 0);
  return frame(
    title,
    ctx,
    shown.length === 0 ? (
      <p className="empty">{none}</p>
    ) : (
      shown.map((g, i) => (
        <section key={i} style={{ "--p": g.ink } as CSSProperties}>
          {g.title ? <h2 className="caps ask-h">{g.title}</h2> : null}
          <ul>
            {g.lines.map((l) => (
              <Line key={l.t.id} l={l} ink={g.ink} />
            ))}
          </ul>
        </section>
      ))
    ),
    ink,
  );
}
