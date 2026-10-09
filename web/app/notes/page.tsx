// The notes of the person's teams: one line per note.
import Link from "next/link";
import { Suspense } from "react";
import { getPersonOrRedirect } from "@/lib/auth";
import { istDay } from "@/lib/db/dates";
import { listNotes } from "@/lib/db/queries-pipeline";
import { fmtDay } from "@/lib/format";

async function Notes() {
  const person = await getPersonOrRedirect();
  const rows = await listNotes(person.memberships.map((m) => m.teamId));
  return (
    <div className="tb">
      <div className="stack">
        <div className="sheet">
          <h1 className="tb-title">Notes</h1>
          <p className="tb-meta">
            <Link href="/notes/new" className="caps act">
              Paste a note
            </Link>
          </p>
          {rows.length === 0 ? (
            <p className="tb-where">No notes yet. Paste one to start.</p>
          ) : (
            <ul className="tb-list">
              {rows.map((n) => (
                <li key={n.id}>
                  <Link href={`/notes/${n.id}`} className="tb-list-t">
                    {n.title}
                  </Link>
                  <span className="tb-list-d">{fmtDay(istDay(n.heldAt))}</span>
                  <span className="tb-list-s">
                    {n.total === 0 ? (n.status === "cleared" ? "All decided" : "Not drafted yet") : n.pending === 0 ? "All decided" : `${n.pending} ${n.pending === 1 ? "draft" : "drafts"} waiting`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default function NotesPage() {
  return (
    <Suspense fallback={null}>
      <Notes />
    </Suspense>
  );
}
