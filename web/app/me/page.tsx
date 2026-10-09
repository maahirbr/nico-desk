// The week sheet: one sheet per person per week, in the grammar "will <do> by <day>."
import Link from "next/link";
import { Suspense, type CSSProperties } from "react";
import { KeyboardRule } from "@/components/week/KeyboardRule";
import { Owed } from "@/components/week/Owed";
import { ThreadLayer } from "@/components/week/ThreadLayer";
import { WeekLine } from "@/components/week/WeekLine";
import { fmtShort, inkOf, weekLines } from "@/components/week/lines";
import { getPersonOrRedirect } from "@/lib/auth";
import { addDays, isIsoDate, mondayOf, todayIST } from "@/lib/db/dates";
import { listTasksForPerson } from "@/lib/db/queries";
import { dueMovesOf, openBlockedOn, quotesFor } from "@/lib/db/queries-ui";
import { enrich } from "@/lib/views";

// The long label wraps on a phone, so a narrow screen shows the date alone (see .flip in globals.css).
function Label({ d }: { d: string }) {
  return (
    <>
      <span className="long">Week of {fmtShort(d)}</span>
      <span className="short" aria-hidden>
        {fmtShort(d)}
      </span>
    </>
  );
}

async function Me({ searchParams }: { searchParams: PageProps<"/me">["searchParams"] }) {
  const person = await getPersonOrRedirect();
  const today = todayIST();
  const thisMonday = mondayOf(today);
  const tasks = await listTasksForPerson(person.id);
  const mine = await enrich(tasks);

  // The sheets run from the week of the earliest first date to next week.
  const earliest = tasks.reduce((m, t) => (t.firstDueOn < m ? t.firstDueOn : m), thisMonday);
  const first = mondayOf(earliest);
  const last = addDays(thisMonday, 7);
  const asked = (await searchParams).week;
  const requested = typeof asked === "string" && isIsoDate(asked) ? mondayOf(asked) : thisMonday;
  const W = requested < first ? first : requested > last ? last : requested;

  const moves = await dueMovesOf(mine.map((t) => t.id));
  const quotes = await quotesFor(tasks);
  const lines = weekLines(mine, moves, W, today);
  const live = W >= thisMonday;
  const owed = live ? await enrich(await openBlockedOn(person.id)) : [];
  const ink = inkOf(person.department);

  // Threads draw in again when the view changes week or a threaded line gets a new date.
  const sig = `${W}|${lines.filter((l) => l.movedIn || l.movedOut).map((l) => `${l.t.id}:${l.due}`).join(",")}`;
  const prev = W > first ? addDays(W, -7) : null;
  const next = W < last ? addDays(W, 7) : null;
  const href = (w: string) => (w === thisMonday ? "/me" : `/me?week=${w}`);

  return (
    <div className="wk">
      <KeyboardRule />
      <div key={W} className="stack arrive" style={{ "--arrive-y": "24px", "--arrive-dur": "var(--dur-hero)" } as CSSProperties}>
        <ThreadLayer sig={sig} />
        <div className="sheet note">
          <nav className="flip caps" aria-label="Weeks">
            {prev ? (
              <Link href={href(prev)} className="act" rel="prev">
                <Label d={prev} />
              </Link>
            ) : (
              <span />
            )}
            <span aria-current="page">
              <Label d={W} />
            </span>
            {next ? (
              <Link href={href(next)} className="act" rel="next">
                <Label d={next} />
              </Link>
            ) : (
              <span />
            )}
          </nav>
          <h1 className="sig">{person.name}</h1>
          <p className="role">
            {person.role}, {person.department}
          </p>
          {lines.length > 0 ? (
            lines.map((l) => <WeekLine key={l.t.id} l={l} ink={ink} today={today} live={live} canAct={W === thisMonday} quote={quotes.get(l.t.id)} />)
          ) : (
            <p className="empty">Nothing is due this week.</p>
          )}
          <Owed rows={owed} />
        </div>
      </div>
    </div>
  );
}

export default function MePage({ searchParams }: PageProps<"/me">) {
  return (
    <Suspense fallback={null}>
      <Me searchParams={searchParams} />
    </Suspense>
  );
}
