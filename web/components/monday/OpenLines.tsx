"use client";
// The left column's open lines: each is past its date, from any week. The lead carries it to a new date with a reason (the
// Red rule: 10 to 280 characters, a day from today on) or closes it as done. Both run the existing task
// actions. They accept the owner or the lead, so a lead can act on any line. A line that comes from a Sheet is
// changed there. The page asks for its data again after each result, so the line leaves with no navigation.
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import type { ActionResult } from "@/components/ui/ActionForm";
import { KeyboardRule } from "@/components/week/KeyboardRule";
import { Mark } from "@/components/week/Mark";
import type { MarkSpec } from "@/components/week/lines";
import { closeAction, renegotiateAction } from "@/lib/actions/tasks";
import { addDays } from "@/lib/db/dates";
import { fmtDay } from "@/lib/format";
import { fmtShort } from "@/components/week/lines";

export type OpenLineData = {
  id: string;
  version: number;
  title: string;
  owner: string;
  ink: string;
  dueOn: string;
  mark: MarkSpec;
  why: string | null; // the reason of the last date move, as a sentence
  fromSheet: boolean;
};

function useRefreshOnResult(state: ActionResult) {
  const router = useRouter();
  useEffect(() => {
    if (state?.ok || state?.error) router.refresh();
  }, [state, router]);
}

function OpenLine({ l, today, planMonday }: { l: OpenLineData; today: string; planMonday: string }) {
  const id = useId();
  const [carry, setCarry] = useState(false);
  const [moveState, moveRun, moving] = useActionState(renegotiateAction, null);
  const [doneState, doneRun, closing] = useActionState(closeAction, null);
  const reasonRef = useRef<HTMLInputElement>(null);
  useRefreshOnResult(moveState);
  useRefreshOnResult(doneState);
  useEffect(() => {
    if (carry) reasonRef.current?.focus();
  }, [carry]);

  const hidden = (
    <>
      <input type="hidden" name="taskId" value={l.id} />
      <input type="hidden" name="version" value={l.version} />
    </>
  );
  const busy = moving || closing;
  return (
    <li className="ln mon-row" style={{ ["--p" as string]: l.ink }}>
      <div className="hit">
        <span className="t" data-first>
          {l.title}
        </span>
        <span className="meta">
          <span className="who">
            <i aria-hidden />
            {l.owner}
          </span>
          <span className="by">{fmtDay(l.dueOn)}</span>
          <Mark {...l.mark} />
        </span>
      </div>
      {l.why ? <p className="why">{l.why}</p> : null}
      {l.fromSheet ? (
        <p className="mon-note-line">This line comes from a Sheet. Change it there.</p>
      ) : (
        <div className="mon-acts">
          <button type="button" className="caps act" aria-expanded={carry} aria-controls={`${id}-f`} disabled={busy} onClick={() => setCarry((c) => !c)}>
            Carry to the week of {fmtShort(planMonday)}
          </button>
          <form action={doneRun}>
            {hidden}
            <input type="hidden" name="as" value="done" />
            <button type="submit" className="caps act" disabled={busy}>
              Close as done
            </button>
          </form>
        </div>
      )}
      {carry && !l.fromSheet ? (
        <form id={`${id}-f`} action={moveRun} className="mon-form" data-kb>
          {hidden}
          <div className="mon-fld">
            <label className="caps" htmlFor={`${id}-d`}>
              New date
            </label>
            <input id={`${id}-d`} type="date" name="dueOn" min={today} defaultValue={addDays(planMonday, 4)} required />
          </div>
          <div className="mon-fld">
            <label className="caps" htmlFor={`${id}-r`}>
              Reason, in a sentence
            </label>
            <input ref={reasonRef} id={`${id}-r`} type="text" name="reason" enterKeyHint="done" autoComplete="off" required minLength={10} maxLength={280} placeholder="What changed" />
          </div>
          <div className="mon-acts">
            <button type="submit" className="caps act" disabled={moving}>
              Save the new date
            </button>
            <button type="button" className="caps act" style={{ color: "var(--ink-65)" }} onClick={() => setCarry(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}
      {moveState?.error || doneState?.error ? (
        <p role="alert" className="tb-err">
          {moveState?.error ?? doneState?.error}
        </p>
      ) : null}
    </li>
  );
}

export function OpenLines({ lines, today, planMonday }: { lines: OpenLineData[]; today: string; planMonday: string }) {
  if (lines.length === 0) return <p className="empty">No open line is past its date.</p>;
  return (
    <>
      <KeyboardRule />
      <ul>
        {lines.map((l) => (
          <OpenLine key={l.id} l={l} today={today} planMonday={planMonday} />
        ))}
      </ul>
    </>
  );
}
