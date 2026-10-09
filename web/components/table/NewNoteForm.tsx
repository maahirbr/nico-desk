"use client";
// Paste a meeting note. One large field, and the day and team it belongs to. Then the table opens.
import { useActionState } from "react";
import { KeyboardRule } from "@/components/week/KeyboardRule";
import { pasteNoteAction } from "@/lib/actions/notes";
import type { ActionResult } from "@/components/ui/ActionForm";

type Props = { teams: { id: string; name: string }[]; today: string; dev: boolean };

// A blank title is taken from the first line of the note, without its markdown hashes.
function titleOf(body: string): string {
  const first = body.split("\n").find((l) => l.trim().length > 0) ?? "";
  return first.replace(/^[#\s]+/, "").trim().slice(0, 200);
}

async function paste(prev: ActionResult, fd: FormData): Promise<ActionResult> {
  if (!String(fd.get("title") ?? "").trim()) fd.set("title", titleOf(String(fd.get("body") ?? "")));
  return pasteNoteAction(prev, fd);
}

export function NewNoteForm({ teams, today, dev }: Props) {
  const [state, run, pending] = useActionState(paste, null);
  return (
    <form action={run} className="tb-new">
      <KeyboardRule />
      <label className="caps" htmlFor="tb-body">
        Meeting note
      </label>
      <textarea id="tb-body" name="body" required rows={16} className="tb-body no-ring" placeholder="Paste the note here." />
      <div className="tb-new-meta">
        <label className="tb-fld">
          <span className="caps">Title</span>
          <input name="title" maxLength={200} placeholder="Taken from the first line" className="no-ring" />
        </label>
        <label className="tb-fld">
          <span className="caps">Meeting day</span>
          <input type="date" name="heldOn" defaultValue={today} required className="no-ring" />
        </label>
        {teams.length > 1 ? (
          <label className="tb-fld">
            <span className="caps">Team</span>
            <select name="teamId" required className="no-ring">
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <input type="hidden" name="teamId" value={teams[0]?.id ?? ""} />
        )}
      </div>
      {dev ? (
        <label className="tb-check">
          <input type="checkbox" name="synthetic" />
          <span>This is a synthetic test note. Local use only.</span>
        </label>
      ) : (
        <p className="tb-where">A note that is not synthetic is held until the vendor gate opens.</p>
      )}
      {state?.error ? (
        <p role="alert" className="tb-err">
          {state.error}
        </p>
      ) : null}
      <div className="tb-new-go">
        <button type="submit" className="caps act" disabled={pending}>
          Save the note
        </button>
        <p className="tb-where">Next, the note opens on the drafting table. Nothing reaches a week sheet until a lead accepts a line.</p>
      </div>
    </form>
  );
}
