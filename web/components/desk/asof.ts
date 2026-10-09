// The desk as it stood at the end of a day. Pure: it replays the team's events (loaded once) and picks
// each sheet's lines with the same rules as /me (weekLines). No database and no React in this file.
import { markOf, weekLines, type LineTask, type WeekLine } from "@/components/week/lines";
import { addDays, istDay, mondayOf } from "@/lib/db/dates";
import type { DeskTask, DueMove } from "@/lib/db/queries-ui";

export type AsOfTask = LineTask & { ownerId: string };
type DayMove = DueMove & { day: string };
export type Prepared = { h: DeskTask; createdDay: string; moves: DayMove[] };
export type DeskLine = WeekLine<AsOfTask>;
export type Claim = { overdue: number; moved: number; closed: number };
export type Since = { closed: number; moved: number; past: number };

// Done once per load, so a scrub step does no setup.
export function prepare(tasks: DeskTask[]): Prepared[] {
  return tasks.map((h) => ({
    h,
    createdDay: istDay(h.createdAt),
    moves: h.events
      .filter((e) => e.field === "due_on" && e.before && e.after)
      .map((e) => ({ taskId: h.id, from: e.before as string, to: e.after as string, reason: e.reason, at: e.at, day: e.day })),
  }));
}

export function moveMap(list: Prepared[]): Map<string, DueMove[]> {
  return new Map(list.map((p) => [p.h.id, p.moves]));
}

// Every weekday from the Monday eight weeks before this week's Monday, up to today.
export function deskDays(today: string): string[] {
  const out: string[] = [];
  for (let d = addDays(mondayOf(today), -56); d <= today; d = addDays(d, 1)) {
    const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
    if (dow > 0 && dow < 6) out.push(d);
  }
  return out;
}

// One task as it was at the end of day x. Events are in time order, so the first later day ends the loop.
export function replay(p: Prepared, x: string): AsOfTask | null {
  if (p.createdDay > x) return null;
  const { h } = p;
  const t: AsOfTask = {
    id: h.id,
    title: h.title,
    ownerId: h.ownerId,
    firstDueOn: h.firstDueOn,
    dueOn: h.dueOn,
    health: h.health as AsOfTask["health"],
    statusCategory: h.statusCategory as AsOfTask["statusCategory"],
    closedOn: h.closedOn,
    createdAt: h.createdAt,
  };
  for (const e of h.events) {
    if (e.day > x) break;
    if (e.field === "title" && e.after) t.title = e.after;
    else if (e.field === "owner_id" && e.after) t.ownerId = e.after;
    else if (e.field === "due_on" && e.after) t.dueOn = e.after;
    else if (e.field === "health") t.health = e.after as AsOfTask["health"];
    else if (e.field === "status_category" && e.after) t.statusCategory = e.after as AsOfTask["statusCategory"];
    else if (e.field === "closed_on") t.closedOn = e.after;
  }
  return t;
}

export type Replayed = { p: Prepared; t: AsOfTask };

export function replayAll(list: Prepared[], x: string): Replayed[] {
  const out: Replayed[] = [];
  for (const p of list) {
    const t = replay(p, x);
    if (t && t.statusCategory !== "dropped") out.push({ p, t });
  }
  return out;
}

// Overdue lines first, then the rest of the week by date, then lines that moved on to a later week.
const rank = (l: DeskLine, x: string) => (l.kind !== "out" && !l.closed && l.due < x ? 0 : l.kind === "out" ? 2 : 1);

export function sheetLinesAt(tasks: AsOfTask[], moves: Map<string, DueMove[]>, x: string): DeskLine[] {
  return weekLines(tasks, moves, mondayOf(x), x).sort((a, b) => rank(a, x) - rank(b, x) || a.due.localeCompare(b.due) || a.t.id.localeCompare(b.t.id));
}

// The headline counts for the week that holds x, up to the end of x.
export function claimAt(rep: Replayed[], x: string): Claim {
  const W = mondayOf(x);
  let overdue = 0;
  let moved = 0;
  let closed = 0;
  for (const { p, t } of rep) {
    if (!t.closedOn && t.dueOn < x) overdue++;
    for (const m of p.moves) if (m.day >= W && m.day <= x) moved++;
    if (t.closedOn && t.closedOn >= W && t.closedOn <= x) closed++;
  }
  return { overdue, moved, closed };
}

// What happened after day x, read against the state today (now).
export function sinceAt(now: Replayed[], x: string, today: string): Since {
  let closed = 0;
  let moved = 0;
  let past = 0;
  for (const { p, t } of now) {
    if (t.closedOn && t.closedOn > x) closed++;
    for (const m of p.moves) if (m.day > x && m.day <= today) moved++;
    if (!t.closedOn && t.dueOn < today && t.dueOn >= x) past++;
  }
  return { closed, moved, past };
}

const WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
const countWords = (n: number, one: string, many: string) => (n === 0 ? `None ${many}` : `${WORDS[n] ?? String(n)} ${n === 1 ? one : many}`);

export function claimWords(c: Claim): string {
  return `${countWords(c.overdue, "past its date", "past their date")}. ${countWords(c.moved, "moved with a reason", "moved with a reason")}. ${countWords(c.closed, "closed this week", "closed this week")}.`;
}

// The plan for the week after today's: open lines due in that week, plus lines that moved into it (with their thread
// back to the sheet behind). Read as of today. Lines already late stay on this week's sheet, not here.
export function planLinesAt(tasks: AsOfTask[], moves: Map<string, DueMove[]>, nextMonday: string, today: string): DeskLine[] {
  return weekLines(tasks, moves, nextMonday, today)
    .filter((l) => l.kind === "here" && (!l.closed || l.movedIn))
    .sort((a, b) => a.due.localeCompare(b.due) || a.t.id.localeCompare(b.t.id));
}

export function planWords(planned: number, movedIn: number): string {
  if (planned === 0) return "Nothing is planned for the week yet.";
  const n = WORDS[planned] ?? String(planned);
  const moved = movedIn === 0 ? "None moved in from this week." : `${WORDS[movedIn] ?? String(movedIn)} moved in from earlier weeks.`;
  return `${n} planned. ${moved}`;
}

// One task as a single line on day `today`, with no week around it: its date, its mark and its date moves.
// A closed task shows the day it closed, so its mark is judged against the date first given.
export function lineNow(r: Replayed, moves: Map<string, DueMove[]>, today: string): DeskLine {
  const mv = moves.get(r.t.id) ?? [];
  const closed = r.t.statusCategory === "done" ? r.t.closedOn : null;
  return { t: r.t, kind: "here", due: r.t.dueOn, closed, mark: markOf(r.t, r.t.dueOn, closed, today), moves: mv, sameWeek: mv.at(-1) };
}
