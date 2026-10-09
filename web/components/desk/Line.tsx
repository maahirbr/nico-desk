"use client";
// One line of a desk sheet: the title, its date, its mark, and the reason its date moved. Press it to read the reason in full.
import { useState } from "react";
import { Mark } from "@/components/week/Mark";
import { istDay } from "@/lib/db/dates";
import type { TaskQuote } from "@/lib/db/queries-ui";
import { fmtDay } from "@/lib/format";
import type { DeskLine } from "./asof";

// The reason a date moved, as the sheet shows it. A line that never moved shows none.
function whyOf(l: DeskLine): { thread?: "in" | "out"; text: string | null } {
  const reason = (r: string | null) => (r ? ` ${/[.!?]$/.test(r) ? r : `${r}.`}` : "");
  if (l.movedIn) return { thread: "in", text: `From ${fmtDay(l.movedIn.from)}.${reason(l.movedIn.reason)}` };
  if (l.movedOut) return { thread: "out", text: `Moved to ${fmtDay(l.movedOut.to)}.${reason(l.movedOut.reason)}` };
  if (l.sameWeek) return { text: `From ${fmtDay(l.sameWeek.from)}.${reason(l.sameWeek.reason)}` };
  return { text: null };
}

export function Line({ l, ink, quote }: { l: DeskLine; ink: string; quote?: TaskQuote }) {
  const [open, setOpen] = useState(false);
  const { thread, text } = whyOf(l);
  const by = l.kind === "out" && l.movedOut ? l.movedOut.from : l.due;
  const face = (
    <>
      <span className="t" data-first>
        {l.t.title}
      </span>
      <span className="meta">
        <span className="by">{fmtDay(by)}</span>
        <Mark {...l.mark} />
      </span>
    </>
  );
  return (
    <li className={`ln${l.kind === "out" ? " out" : ""}${text ? " dither-row" : ""}${open ? " open" : ""}`} {...(thread ? { "data-thread": thread, "data-ink": ink } : {})}>
      {text || quote ? (
        <button type="button" className="hit" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {face}
        </button>
      ) : (
        <div className="hit">{face}</div>
      )}
      {text ? <p className="why">{text}</p> : null}
      {quote ? (
        <div className="src">
          <p className="srcf">
            From the {quote.noteTitle} note, {fmtDay(istDay(quote.heldAt))}.
          </p>
          {quote.quote ? <q className="srcq">{quote.quote}</q> : null}
        </div>
      ) : null}
    </li>
  );
}
