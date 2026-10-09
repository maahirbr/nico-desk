// One commitment in the grammar "will <do> by <day>.", with its mark and the quiet facts under it.
import { fmtDay } from "@/lib/format";
import type { TaskQuote } from "@/lib/db/queries-ui";
import { istDay } from "@/lib/db/dates";
import { SourceReveal } from "./SourceReveal";
import { LineControls } from "./LineControls";
import { WeekMark } from "./WeekMark";
import { fmtLong, lcFirst, moveWords, type WeekLine as Line } from "./lines";

type Props = { l: Line; ink: string; today: string; live: boolean; canAct: boolean; quote?: TaskQuote };

export function WeekLine({ l, ink, today, live, canAct, quote }: Props) {
  const { t } = l;
  const by = l.kind === "out" && l.movedOut ? l.movedOut.from : l.due;
  let thread: "in" | "out" | undefined;
  let why: string | null = null;
  if (l.movedIn) {
    thread = "in";
    why = moveWords(t, l.movedIn);
  } else if (l.movedOut) {
    thread = "out";
    why = moveWords(t, l.movedOut);
  } else if (l.sameWeek) why = moveWords(t, l.sameWeek);
  else if (l.mark.open && l.mark.tone === "amber" && l.moves.length === 0) why = "No new date has been given.";

  const open = t.statusCategory === "open" && l.mark.open;
  const waiting = live && open && t.blockedOnName ? `Waiting on ${t.blockedOnName}${t.blockedAsk ? `: ${t.blockedAsk}` : ""}` : null;
  const controls = canAct && open && l.kind !== "out" && t.origin !== "sheet";

  return (
    <article className={`bl${l.kind === "out" ? " out" : ""}`} {...(thread ? { "data-thread": thread, "data-ink": ink } : {})}>
      <p className="will" data-first>
        will {lcFirst(t.title)} <span className="by">by {fmtLong(by)}</span>.
      </p>
      <div className="facts">
        <WeekMark {...l.mark} />
        {waiting ? <span className="quiet">{waiting}</span> : null}
        {t.origin === "sheet" ? <span className="quiet">Mirrored from the department sheet</span> : null}
      </div>
      {why ? <p className="why">{why}</p> : null}
      {quote ? <SourceReveal noteTitle={quote.noteTitle} day={fmtDay(istDay(quote.heldAt))} quote={quote.quote} /> : null}
      {controls ? <LineControls taskId={t.id} version={t.version} health={t.health} dueOn={t.dueOn} today={today} /> : null}
    </article>
  );
}
