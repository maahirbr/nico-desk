// Paste a meeting note. One large field, then the drafting table.
import { Suspense } from "react";
import { NewNoteForm } from "@/components/table/NewNoteForm";
import { getPersonOrRedirect } from "@/lib/auth";
import { todayIST } from "@/lib/db/dates";

async function NewNote() {
  const person = await getPersonOrRedirect();
  const teams = person.memberships.map((m) => ({ id: m.teamId, name: m.teamName }));
  return (
    <div className="tb">
      <div className="stack">
        <div className="sheet">
          <h1 className="tb-title">Paste a meeting note</h1>
          {teams.length === 0 ? (
            <p className="tb-where">You are not on a team yet, so you cannot paste a note.</p>
          ) : (
            <NewNoteForm teams={teams} today={todayIST()} dev={process.env.NODE_ENV !== "production"} />
          )}
        </div>
      </div>
    </div>
  );
}

export default function NewNotePage() {
  return (
    <Suspense fallback={null}>
      <NewNote />
    </Suspense>
  );
}
