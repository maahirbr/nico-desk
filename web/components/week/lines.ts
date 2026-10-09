// Which lines sit on a person's sheet for a week, and what each mark says. No database access here.
// A line belongs to the week its due date falls in. An open line past its week is carried onto
// every later sheet. A line moved to a later week stays on the old sheet as a struck-back "out" line.
import { addDays, istDay, mondayOf } from "@/lib/db/dates";
import type { DueMove } from "@/lib/db/queries-ui";
import { daysBetween, fmtDay } from "@/lib/format";
import type { TaskRow } from "@/lib/views";

export type Tone = "green" | "amber" | "red" | "grey";
export type MarkSpec = { tone: Tone; word: string; open: boolean };
export type LineKind = "carried" | "here" | "out";

// The fields a line is read from. The desk replays them from the event log, so it has no full TaskRow.
export type LineTask = Pick<TaskRow, "id" | "title" | "statusCategory" | "createdAt" | "dueOn" | "closedOn" | "firstDueOn" | "health">;

export type WeekLine<T extends LineTask = TaskRow> = {
  t: T;
  kind: LineKind;
  due: string; // the due date on the line, as of the end of the week (or today on a live week)
  closed: string | null;
  mark: MarkSpec;
  moves: DueMove[]; // moves made up to that point
  movedIn?: DueMove;
  movedOut?: DueMove;
  sameWeek?: DueMove;
};

const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const at = (iso: string) => new Date(`${iso}T00:00:00Z`);

// "Friday 10 Oct"
export const fmtLong = (iso: string) => `${DOW[at(iso).getUTCDay()]} ${at(iso).getUTCDate()} ${MON[at(iso).getUTCMonth()]}`;
// "10 Oct"
export const fmtShort = (iso: string) => `${at(iso).getUTCDate()} ${MON[at(iso).getUTCMonth()]}`;
export const lcFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

const plural = (n: number) => `${n} day${n === 1 ? "" : "s"}`;
const HEALTH_MARK: Record<string, MarkSpec> = {
  not_started: { tone: "grey", word: "Not started", open: true },
  on_track: { tone: "green", word: "On track", open: true },
  off_track: { tone: "red", word: "Off track", open: true },
  ahead: { tone: "green", word: "Ahead", open: true },
};

// Judged against the date first given. An open line past its current date is late by the days since.
export function markOf(t: LineTask, due: string, closed: string | null, xd: string): MarkSpec {
  if (closed) {
    const n = daysBetween(t.firstDueOn, closed);
    if (n < 0) return { tone: "green", word: "Ahead", open: false };
    if (n === 0) return { tone: "green", word: "On time", open: false };
    return { tone: "amber", word: `Late by ${plural(n)}`, open: false };
  }
  if (due < xd) return { tone: "amber", word: `Late by ${plural(daysBetween(due, xd))}`, open: true };
  if (!t.health) return { tone: "grey", word: "From the sheet", open: true };
  return HEALTH_MARK[t.health] ?? { tone: "grey", word: "Not started", open: true };
}

// W is a Monday. On a week not yet over, the sheet is read as of today. On a past week it is read as of
// its Sunday, from the date moves and the closing day. Health is always the current value.
export function weekLines<T extends LineTask>(tasks: T[], moves: Map<string, DueMove[]>, W: string, today: string): WeekLine<T>[] {
  const live = W >= mondayOf(today);
  const xd = live ? today : addDays(W, 6);
  const end = addDays(W, 6);
  const out: WeekLine<T>[] = [];
  for (const t of tasks) {
    if (t.statusCategory === "dropped" || istDay(t.createdAt) > xd) continue;
    const upTo = (moves.get(t.id) ?? []).filter((m) => istDay(m.at) <= xd);
    const due = live ? t.dueOn : (upTo.at(-1)?.to ?? t.firstDueOn);
    const closed = t.statusCategory === "done" && t.closedOn && t.closedOn <= xd ? t.closedOn : null;
    const inWeek = due >= W && due <= end;
    const carried = !closed && due < W;
    const movedIn = inWeek ? upTo.find((m) => mondayOf(m.from) < W && mondayOf(m.to) === W) : undefined;
    const movedOut = !inWeek ? upTo.find((m) => mondayOf(m.from) === W && mondayOf(m.to) > W) : undefined;
    const base = { t, due, closed, mark: markOf(t, due, closed, xd), moves: upTo };
    if (inWeek || carried) {
      out.push({ ...base, kind: carried ? "carried" : "here", movedIn, sameWeek: upTo.find((m) => mondayOf(m.from) === W && mondayOf(m.to) === W) });
    } else if (movedOut) {
      out.push({ ...base, kind: "out", movedOut, mark: { tone: "grey", word: `Now due ${fmtDay(due)}`, open: true } });
    }
  }
  const rank = (l: WeekLine<T>) => (l.kind === "carried" ? 0 : l.kind === "out" ? 2 : 1);
  return out.sort((a, b) => rank(a) - rank(b) || a.due.localeCompare(b.due) || a.t.id.localeCompare(b.t.id));
}

export function moveWords(t: Pick<LineTask, "firstDueOn">, m: DueMove): string {
  const reason = m.reason ? ` ${/[.!?]$/.test(m.reason) ? m.reason : `${m.reason}.`}` : "";
  const day = istDay(m.at);
  const late = day > t.firstDueOn ? " The first date had already passed, so the ledger counts it late." : "";
  return `Moved from ${fmtDay(m.from)} to ${fmtDay(m.to)} on ${fmtDay(day)}.${reason}${late}`;
}

// A department's ink, or plain ink when the department has no token.
const INK: Record<string, string> = {
  digital: "var(--dept-digital)",
  brand: "var(--dept-brand)",
  retail: "var(--dept-retail)",
  retention: "var(--dept-retention)",
};
export const inkOf = (department: string) => INK[department.toLowerCase()] ?? "var(--ink)";
