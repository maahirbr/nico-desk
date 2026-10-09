// The ledger book, as plain data. One section per week, the week being the Monday of the first date given.
// No database and no React here. Judged against the first date, never the date it moved to.
import { markOf, fmtShort, inkOf, type MarkSpec } from "@/components/week/lines";
import { addDays, mondayOf } from "@/lib/db/dates";
import type { LedgerLine } from "@/lib/db/queries-ui";

export type Who = { name: string; department: string };
export type Totals = { counted: number; ahead: number; onTime: number; late: number; openOverdue: number };
export type BookRow = {
  id: string;
  owner: string;
  ink: string;
  title: string;
  first: string;
  landed: string | null; // the day it landed, or null while open
  mark: MarkSpec;
  counted: boolean;
  threadTo: number | null; // index of the last move sentence of this row, when its date moved with a reason
};
export type BookMove = { id: string; ink: string; text: string };
export type BookWeek = { monday: string; rows: BookRow[]; moves: BookMove[]; totals: Totals };
export type Book = { weeks: BookWeek[]; total: Totals };

const none = (): Totals => ({ counted: 0, ahead: 0, onTime: 0, late: 0, openOverdue: 0 });
const add = (a: Totals, b: Totals): Totals => ({
  counted: a.counted + b.counted,
  ahead: a.ahead + b.ahead,
  onTime: a.onTime + b.onTime,
  late: a.late + b.late,
  openOverdue: a.openOverdue + b.openOverdue,
});

// Late and open overdue first, then on time, then ahead, then lines not counted yet.
const rank = (l: LedgerLine) => (!l.counted ? 3 : l.outcome === "ahead" ? 2 : l.outcome === "on_time" ? 1 : 0);

// A line is read as of today. A line that is not counted yet shows its new date and nothing else, so its move has a row.
function rowMark(l: LedgerLine, today: string): MarkSpec {
  if (!l.counted) return { tone: "grey", word: `Now due ${fmtShort(l.dueOn)}`, open: true };
  // markOf reads only these fields, and health matters only for an open line that is not late.
  const t = { id: l.id, title: l.title, statusCategory: l.closedOn ? ("done" as const) : ("open" as const), createdAt: "", dueOn: l.dueOn, closedOn: l.closedOn, firstDueOn: l.firstDueOn, health: null };
  return markOf(t, l.dueOn, l.closedOn, today);
}

const sentence = (owner: string, title: string, from: string, to: string, reason: string | null) => {
  const head = `${owner} moved ${title} from ${fmtShort(from)} to ${fmtShort(to)}`;
  if (!reason) return `${head}.`;
  return `${head}: ${reason}${/[.!?]$/.test(reason) ? "" : "."}`;
};

export function bookOf(lines: LedgerLine[], who: Map<string, Who>, today: string, weeksBack: number): Book {
  const first = addDays(mondayOf(today), -7 * weeksBack);
  const weeks: BookWeek[] = [];
  for (let m = first; m <= mondayOf(today); m = addDays(m, 7)) {
    const mine = lines.filter((l) => mondayOf(l.firstDueOn) === m).sort((a, b) => rank(a) - rank(b) || a.firstDueOn.localeCompare(b.firstDueOn) || a.id.localeCompare(b.id));
    const totals = none();
    const moves: BookMove[] = [];
    const rows = mine.map((l): BookRow => {
      const p = who.get(l.ownerId) ?? { name: l.ownerId, department: "" };
      const ink = inkOf(p.department);
      if (l.counted) {
        totals.counted++;
        if (l.outcome === "ahead") totals.ahead++;
        else if (l.outcome === "on_time") totals.onTime++;
        else if (l.outcome === "late") totals.late++;
        else totals.openOverdue++;
      }
      let threadTo: number | null = null;
      for (const mv of l.moves) {
        moves.push({ id: l.id, ink, text: sentence(p.name, l.title, mv.from, mv.to, mv.reason) });
        threadTo = moves.length - 1;
      }
      return { id: l.id, owner: p.name, ink, title: l.title, first: l.firstDueOn, landed: l.closedOn, mark: rowMark(l, today), counted: l.counted, threadTo };
    });
    weeks.push({ monday: m, rows, moves, totals });
  }
  return { weeks, total: weeks.reduce((a, w) => add(a, w.totals), none()) };
}
