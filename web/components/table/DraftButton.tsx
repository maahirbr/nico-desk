"use client";
// One action for a note with no drafts yet. The server action makes the drafts. The page then refreshes.
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { draftNoteAction } from "@/lib/actions/notes";

export function DraftButton({ noteId, failed }: { noteId: string; failed: boolean }) {
  const router = useRouter();
  const [state, run, pending] = useActionState(draftNoteAction, null);
  useEffect(() => {
    if (state?.ok || state?.error) router.refresh();
  }, [state, router]);
  return (
    <form action={run} className="tb-draftform">
      <input type="hidden" name="noteId" value={noteId} />
      {failed ? <p className="tb-where">The last try failed. No drafts were made.</p> : null}
      <button type="submit" className="caps act" disabled={pending}>
        Draft commitments from this note
      </button>
      {pending ? <p className="tb-where">Reading the note.</p> : null}
      {state?.error ? (
        <p role="alert" className="tb-err">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
