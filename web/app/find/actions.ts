"use server";
// FIND commit: one typed sentence becomes a one-line note, and the existing pipeline drafts it. The result is a
// DRAFT, never a task. A lead accepts it on the drafting table or in Monday mode. This file only calls the two
// existing note actions. It changes no rule in lib.
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { AuthError, isOnTeam, requirePerson } from "@/lib/auth";
import { isIsoDate, todayIST } from "@/lib/db/dates";
import { draftsOfNote } from "@/lib/db/queries-pipeline";
import { fmtShort } from "@/components/week/lines";
import { draftNoteAction, pasteNoteAction } from "@/lib/actions/notes";
import { plainError } from "@/lib/model/errors";
import { roster } from "@/lib/views";

export type CommitResult = { ok: true; noteId: string; draftId: string } | { ok: false; error: string; noteId?: string };

type Input = { teamId: string; ownerId: string; what: string; dueOn: string | null };

// "<Owner full name>: By 9 Oct, I will <do>." The drafter reads a speaker line with "I will", and the
// existing owner and date checks read the name and the day from it.
function bodyOf(ownerName: string, what: string, dueOn: string | null): string {
  return dueOn ? `${ownerName}: By ${fmtShort(dueOn)}, I will ${what}.` : `${ownerName}: I will ${what}.`;
}

export async function commitFindAction(input: Input): Promise<CommitResult> {
  let noteId = "";
  try {
    const person = await requirePerson();
    if (!isOnTeam(person, input.teamId)) throw new AuthError("You are not on this team.");
    const owner = (await roster(input.teamId)).find((p) => p.id === input.ownerId);
    if (!owner) throw new AuthError("That person is not on this team.");
    const what = input.what.replace(/\s+/g, " ").replace(/[\s.;]+$/, "").trim();
    if (what.length < 3 || what.length > 160) throw new AuthError("Say what will be done in 3 to 160 characters.");
    if (input.dueOn !== null && (!isIsoDate(input.dueOn) || input.dueOn < todayIST())) throw new AuthError("Pick a day from today on.");

    const fd = new FormData();
    fd.set("teamId", input.teamId);
    fd.set("title", `Captured in FIND, ${fmtShort(todayIST())}`);
    fd.set("body", bodyOf(owner.displayName, what, input.dueOn));
    fd.set("heldOn", todayIST());
    // Synthetic only counts outside production (pasteNoteAction ignores it there). It is set because this build
    // runs on synthetic fixtures. Before real use the repo owner must decide how FIND notes are declared.
    fd.set("synthetic", "on");
    try {
      const r = await pasteNoteAction(null, fd);
      if (r?.error) throw new AuthError(r.error);
    } catch (e) {
      // pasteNoteAction ends with redirect(), which throws. The note id is in the redirect target.
      if (!isRedirectError(e)) throw e;
      const m = /\/notes\/([A-Za-z0-9_]+)/.exec((e as { digest?: string }).digest ?? "");
      if (!m) throw new AuthError("The note was saved but its id could not be read.");
      noteId = m[1];
    }

    const df = new FormData();
    df.set("noteId", noteId);
    const run = await draftNoteAction(null, df);
    if (run?.error) return { ok: false, error: run.error, noteId };
    const made = await draftsOfNote(noteId);
    if (made.length !== 1) return { ok: false, error: `FIND expected one draft and got ${made.length}. Open the note to see them.`, noteId };
    return { ok: true, noteId, draftId: made[0].id };
  } catch (e) {
    return { ok: false, error: plainError(e), ...(noteId ? { noteId } : {}) };
  }
}
