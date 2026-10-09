"use client";
// The desk: one sheet per team member for the week of the chosen day, and a scrubber along the bottom
// that replays the event log. All events arrive once with the page, so dragging never asks the server.
import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";
import { OwedMatrix } from "./OwedMatrix";
import { ThreadLayer } from "@/components/week/ThreadLayer";
import { KeyboardRule } from "@/components/week/KeyboardRule";
import { fmtLong, fmtShort, inkOf, markOf } from "@/components/week/lines";
import type { DeskTask, OwedEdge, TaskQuote } from "@/lib/db/queries-ui";
import { addDays, mondayOf } from "@/lib/db/dates";
import { fmtDay } from "@/lib/format";
import { Line } from "./Line";
import { claimAt, claimWords, deskDays, moveMap, planLinesAt, planWords, prepare, replayAll, sheetLinesAt, sinceAt, type DeskLine, type Replayed } from "./asof";

export type DeskPerson = { id: string; name: string; role: string; department: string };
type Props = { teamName: string; people: DeskPerson[]; tasks: DeskTask[]; today: string; quotes?: TaskQuote[]; initialWeek?: string; team?: string; owed?: OwedEdge[] };

// The long label wraps on a phone, so a narrow screen shows the date alone (see .flip in globals.css).
function FlipLabel({ d }: { d: string }) {
  return (
    <>
      <span className="long">Week of {fmtShort(d)}</span>
      <span className="short" aria-hidden>
        {fmtShort(d)}
      </span>
    </>
  );
}

function Sheet({ person, lines, W, quotes }: { person: DeskPerson; lines: DeskLine[]; W: string; quotes: Map<string, TaskQuote> }) {
  const ink = inkOf(person.department);
  // Threads draw in when the week or a threaded line's date changes. A change in the lines alone redraws them still.
  const sig = `${W}|${lines.filter((l) => l.movedIn || l.movedOut).map((l) => `${l.t.id}:${l.due}`).join(",")}`;
  const layout = lines.map((l) => `${l.t.id}${l.kind}${l.mark.word}${quotes.has(l.t.id) ? "q" : ""}`).join(",");
  return (
    <div className="stack">
      <ThreadLayer sig={sig} layout={layout} />
      <div className="sheet ps" style={{ "--p": ink } as CSSProperties}>
        <h2 className="who-h">
          <span className="who">
            <i />
            {person.name}
          </span>
        </h2>
        <p className="r caps">
          {person.role}, {person.department}
        </p>
        {lines.length > 0 ? (
          <ul>
            {lines.map((l) => (
              <Line key={l.t.id} l={l} ink={ink} quote={quotes.get(l.t.id)} />
            ))}
          </ul>
        ) : (
          <p className="empty">Nothing is due this week.</p>
        )}
      </div>
    </div>
  );
}

export function Desk({ teamName, people, tasks, today, quotes = [], initialWeek, team, owed }: Props) {
  const prepared = useMemo(() => prepare(tasks), [tasks]);
  const moves = useMemo(() => moveMap(prepared), [prepared]);
  const days = useMemo(() => deskDays(today), [today]);
  const shown = useMemo(() => new Set(people.map((p) => p.id)), [people]);
  const quoteMap = useMemo(() => new Map(quotes.map((q) => [q.taskId, q])), [quotes]);
  const thisMonday = mondayOf(today);
  const nextMonday = addDays(thisMonday, 7);
  // The week after today's week is the plan, read as of today. The scrubber stays at today. Moving it ends the plan view.
  const [plan, setPlan] = useState(initialWeek === nextMonday);
  // A week in the link opens the desk on the last day of that week that is not in the future.
  const [idx, setIdx] = useState(() => {
    if (!initialWeek || initialWeek >= nextMonday) return days.length - 1;
    const end = addDays(initialWeek, 6);
    let at = 0;
    days.forEach((d, i) => {
      if (d <= end) at = i;
    });
    return at;
  });
  const x = days[idx];
  const last = days[days.length - 1];

  const nowState = useMemo(() => replayAll(prepared, last).filter((r) => shown.has(r.t.ownerId)), [prepared, last, shown]);

  const view = useMemo(() => {
    const rep: Replayed[] = replayAll(prepared, x).filter((r) => shown.has(r.t.ownerId));
    const planWeek = addDays(mondayOf(today), 7);
    const sheets = people.map((p) => {
      const mine = rep.filter((r) => r.t.ownerId === p.id).map((r) => r.t);
      return { person: p, lines: plan ? planLinesAt(mine, moves, planWeek, today) : sheetLinesAt(mine, moves, x) };
    });
    return { sheets, claim: claimAt(rep, x), since: sinceAt(nowState, x, today) };
  }, [prepared, moves, people, shown, nowState, x, today, plan]);

  // The Owed lines: each open task of an edge as it stands today, with the last date move for its reason.
  const owedLines = useMemo(() => {
    const m = new Map<string, DeskLine>();
    for (const r of replayAll(prepared, today)) {
      if (r.t.statusCategory !== "open") continue;
      const mv = moves.get(r.t.id) ?? [];
      m.set(r.t.id, { t: r.t, kind: "here", due: r.t.dueOn, closed: null, mark: markOf(r.t, r.t.dueOn, null, today), moves: mv, sameWeek: mv.at(-1) });
    }
    return m;
  }, [prepared, moves, today]);

  const W = plan ? nextMonday : mondayOf(x);
  const first = mondayOf(days[0]);
  const prev = plan ? thisMonday : W > first ? addDays(W, -7) : null;
  const next = !plan && W < nextMonday ? addDays(W, 7) : null;
  const href = (w: string) => {
    const q = new URLSearchParams();
    if (team) q.set("team", team);
    if (w !== thisMonday) q.set("week", w);
    const str = q.toString();
    return str ? `/team?${str}` : "/team";
  };
  const planned = view.sheets.reduce((n, s) => n + s.lines.length, 0);
  const movedIn = view.sheets.reduce((n, s) => n + s.lines.filter((l) => l.movedIn).length, 0);
  const n = people.length;
  const m = days.length - 1;
  const story =
    idx === m
      ? "Drag back to see the desk as it stood on any day. Mondays are marked."
      : `Between ${fmtDay(x)} and ${fmtDay(today)}: ${view.since.closed} closed, ${view.since.moved} moved with a reason, ${view.since.past} went past ${view.since.past === 1 ? "its" : "their"} date without one.`;
  const grid = { "--cols-d": n <= 3 ? Math.max(n, 1) : n === 4 ? 2 : 3, "--cols-t": n === 1 ? 1 : 2 } as CSSProperties;

  return (
    <div className="dk">
      <KeyboardRule />
      <div className="dk-top arrive" style={{ "--arrive-y": "24px", "--arrive-dur": "var(--dur-hero)" } as CSSProperties}>
        <nav className="flip caps" aria-label="Weeks">
          {prev ? (
            <Link href={href(prev)} className="act" rel="prev">
              <FlipLabel d={prev} />
            </Link>
          ) : (
            <span />
          )}
          <span aria-current="page">
            <FlipLabel d={W} />
          </span>
          {next ? (
            <Link href={href(next)} className="act" rel="next">
              <FlipLabel d={next} />
            </Link>
          ) : (
            <span />
          )}
        </nav>
        <h1 className="claim">{plan ? planWords(planned, movedIn) : claimWords(view.claim)}</h1>
        <p className="ctx">
          {teamName}. {plan ? `Plan for the week of ${fmtShort(W)}, as of ${fmtLong(x)}.` : `Sheets for the week of ${fmtShort(W)}, as of ${fmtLong(x)}.`}
        </p>
        <div className="deskgrid" style={grid}>
          {view.sheets.map((s) => (
            <Sheet key={s.person.id} person={s.person} lines={s.lines} W={W} quotes={quoteMap} />
          ))}
        </div>
      </div>
      {owed ? <OwedMatrix people={people} edges={owed} lines={owedLines} /> : null}
      <div className="scrub">
        <label className="caps" htmlFor="asof">
          As of
        </label>
        <output htmlFor="asof" className="asof">
          {fmtLong(x)}
        </output>
        <input id="asof" type="range" min={0} max={m} step={1} value={idx} aria-valuetext={fmtLong(x)} onChange={(e) => {
            setPlan(false);
            setIdx(Number(e.target.value));
          }} />
        <div className="ticks caps" style={{ "--m": m } as CSSProperties} aria-hidden>
          {days.map((d, i) =>
            new Date(`${d}T00:00:00Z`).getUTCDay() === 1 ? (
              <span key={d} className={i >= m - 5 ? "end" : undefined} style={{ "--i": i } as CSSProperties}>
                {fmtShort(d)}
              </span>
            ) : null,
          )}
        </div>
        <p className="story">{story}</p>
      </div>
    </div>
  );
}
