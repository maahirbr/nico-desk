"use client";
// Health and done, set on the line itself. Off track opens the new date and the reason on this line
// (the Red rule). Each form calls the existing server action. The mark changes once the save lands.
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import type { ActionResult } from "@/components/ui/ActionForm";
import { closeAction, healthAction } from "@/lib/actions/tasks";
import { addDays } from "@/lib/db/dates";

const HEALTH = [
  ["not_started", "Not started"],
  ["on_track", "On track"],
  ["off_track", "Off track"],
  ["ahead", "Ahead"],
] as const;

type Props = { taskId: string; version: number; health: string | null; dueOn: string; today: string };

// The first weekday after the later of today and the current date, so the default never lands on a weekend.
function nextWeekday(iso: string): string {
  let d = addDays(iso, 1);
  while ([0, 6].includes(new Date(`${d}T00:00:00Z`).getUTCDay())) d = addDays(d, 1);
  return d;
}

// The actions only refresh the task page, so this page asks for its own data again.
function useRefreshOnResult(state: ActionResult) {
  const router = useRouter();
  useEffect(() => {
    if (state?.ok || state?.error) router.refresh();
  }, [state, router]);
}

export function LineControls({ taskId, version, health, dueOn, today }: Props) {
  const id = useId();
  const [healthState, healthRun, healthPending] = useActionState(healthAction, null);
  const [redState, redRun, redPending] = useActionState(healthAction, null);
  const [doneState, doneRun, donePending] = useActionState(closeAction, null);
  const [red, setRed] = useState(false);
  const [closedFor, setClosedFor] = useState<ActionResult>(null);
  const reasonRef = useRef<HTMLInputElement>(null);
  useRefreshOnResult(healthState);
  useRefreshOnResult(redState);
  useRefreshOnResult(doneState);

  // A saved Off track closes the panel. The new state is compared once, while rendering.
  if (redState?.ok && redState !== closedFor) {
    setClosedFor(redState);
    setRed(false);
  }
  useEffect(() => {
    if (red) reasonRef.current?.focus();
  }, [red]);

  const hidden = (
    <>
      <input type="hidden" name="taskId" value={taskId} />
      <input type="hidden" name="version" value={version} />
    </>
  );
  const error = healthState?.error ?? doneState?.error;
  const busy = healthPending || donePending || redPending;

  return (
    <>
      <div className="choices">
        <form action={healthRun}>
          {hidden}
          <div role="radiogroup" aria-label="Health" style={{ display: "contents" }}>
            {HEALTH.map(([value, word]) =>
              value === "off_track" ? (
                <button key={value} type="button" role="radio" aria-checked={red || health === value} aria-controls={`${id}-red`} className="choice" onClick={() => setRed(true)}>
                  <i aria-hidden />
                  {word}
                </button>
              ) : (
                <button key={value} type="submit" name="health" value={value} role="radio" aria-checked={!red && health === value} className="choice" disabled={busy}>
                  <i aria-hidden />
                  {word}
                </button>
              ),
            )}
          </div>
        </form>
        <form action={doneRun}>
          {hidden}
          <input type="hidden" name="as" value="done" />
          <button type="submit" className="choice caps act" disabled={busy}>
            Mark done
          </button>
        </form>
      </div>
      {error ? (
        <p role="alert" className="error">
          {error}
        </p>
      ) : null}
      {red ? (
        <form id={`${id}-red`} action={redRun} className="red" data-kb>
          {hidden}
          <div className="field">
            <label className="caps" htmlFor={`${id}-d`}>
              New date
            </label>
            <input id={`${id}-d`} type="date" name="dueOn" min={today} defaultValue={nextWeekday(dueOn < today ? today : dueOn)} required />
          </div>
          <div className="field">
            <label className="caps" htmlFor={`${id}-r`}>
              Reason, in a sentence
            </label>
            <input ref={reasonRef} id={`${id}-r`} type="text" name="reason" enterKeyHint="done" autoComplete="off" required minLength={10} maxLength={280} placeholder="What changed" />
          </div>
          {redState?.error ? (
            <p role="alert" className="error">
              {redState.error}
            </p>
          ) : null}
          <div className="acts caps">
            <button type="submit" name="health" value="off_track" className="caps act" disabled={redPending}>
              Save the new date
            </button>
            <button type="button" className="caps act" style={{ color: "var(--ink-65)" }} onClick={() => setRed(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </>
  );
}
