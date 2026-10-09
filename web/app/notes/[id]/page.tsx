// The drafting table. One note, its drafts, and a lead's decisions. The page reads the note once and
// hands plain data to the table. Decisions run the existing draft actions.
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DraftButton } from "@/components/table/DraftButton";
import { DraftingTable } from "@/components/table/DraftingTable";
import type { DraftCheck, TableDraft, TablePerson } from "@/components/table/types";
import { fmtLong, fmtShort, inkOf, lcFirst } from "@/components/week/lines";
import { getPersonOrRedirect, isLeadOf, isOnTeam, type Person } from "@/lib/auth";
import { addDays, istDay, mondayOf, todayIST } from "@/lib/db/dates";
import { draftsOfNote, getNote, type DraftRow } from "@/lib/db/queries-pipeline";
import { taskTitlesOf } from "@/lib/db/queries-ui";
import { fmtDay } from "@/lib/format";
import { REAL_NOTE_REFUSED, realNoteBlocked } from "@/lib/model/gate";
import { roster } from "@/lib/views";

type Check = { name: string; pass: boolean | null; detail: string };

// Passing checks are plain words. A check that needs a look keeps a hollow amber square. None is green or red.
function checksOf(d: DraftRow, dupTitle: string | null): DraftCheck[] {
  const list = (Array.isArray(d.checks) ? d.checks : []) as Check[];
  const out: DraftCheck[] = [];
  if (d.critical) out.push({ kind: "critical", word: "critical" });
  out.push(d.ownerId ? { kind: "ok", word: "owner matched" } : { kind: "attention", word: "owner not found" });
  out.push(d.dueOn ? { kind: "ok", word: `date ${fmtDay(d.dueOn)}` } : { kind: "attention", word: "no date given" });
  out.push(d.quoteValid ? { kind: "ok", word: "quote found" } : { kind: "attention", word: "quote not found" });
  if (d.duplicateOf) out.push({ kind: "attention", word: `possible duplicate of ${dupTitle ?? "an open task"}` });
  const second = list.find((c) => c.name === "second_pass");
  if (second && second.pass !== null) out.push({ kind: second.pass ? "ok" : "attention", word: second.detail });
  return out;
}

// The week sheet an accepted line sits on. A date before this week sits on this week, as a carried line.
function sheetOf(d: DraftRow, viewer: Person, today: string): { href: string; week: string } | null {
  if (d.state !== "approved" || !d.ownerId || !d.dueOn) return null;
  const week = mondayOf(d.dueOn > today ? d.dueOn : today);
  const thisWeek = mondayOf(today);
  const mine = d.ownerId === viewer.id;
  const reach = addDays(thisWeek, 7); // both /me and the desk open on next week
  const base = mine ? "/me" : "/team";
  return { href: week <= reach ? `${base}?week=${week}` : base, week };
}

async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const person = await getPersonOrRedirect();
  const note = await getNote(id);
  if (!note || !isOnTeam(person, note.teamId)) notFound();
  const today = todayIST();
  const [list, team] = await Promise.all([draftsOfNote(id), roster(note.teamId)]);
  const people: TablePerson[] = team.map((p) => ({ id: p.id, name: p.displayName, ink: inkOf(p.department) }));
  const byId = new Map(people.map((p) => [p.id, p]));
  const dupTitles = await taskTitlesOf(list.flatMap((d) => (d.duplicateOf ? [d.duplicateOf] : [])));
  const day = fmtDay(istDay(note.heldAt));

  const rows: TableDraft[] = list.map((d) => {
    const o = d.ownerId ? byId.get(d.ownerId) : undefined;
    const dup = d.duplicateOf ? (dupTitles[d.duplicateOf] ?? null) : null;
    const sheet = sheetOf(d, person, today);
    return {
      id: d.id,
      title: d.title,
      ownerId: d.ownerId,
      ownerName: o?.name ?? d.spokenOwner ?? null,
      ink: o?.ink ?? "var(--ink)",
      dueOn: d.dueOn,
      quote: d.sourceQuote,
      duplicateTitle: dup ?? (d.duplicateOf ? "an open task" : null),
      state: d.state,
      merged: d.state === "rejected" && (d.decisionNote ?? "").startsWith("Merged into task"),
      checks: checksOf(d, dup),
      sheetHref: sheet?.href ?? null,
      sheetWeek: sheet?.week ?? null,
    };
  });

  const head = (
    <>
      <h1 className="tb-title">{note.title}</h1>
      <p className="tb-meta">
        {day}. <Link href="/notes" className="caps act">All notes</Link>
      </p>
    </>
  );

  // R10: every draft decided, so the text is gone. The page keeps what was decided.
  if (note.status === "cleared") {
    return (
      <div className="tb">
        <div className="stack">
          <div className="sheet">
            {head}
            <p className="tb-closed">{rows.length === 0 ? "No commitments were found in this note. The note text was cleared." : "Every draft decided. The note text was cleared."}</p>
            {rows.length > 0 ? (
              <ul className="tb-list tb-decided">
                {rows.map((d) => (
                  <li key={d.id}>
                    <p className="tb-will">
                      <span className="who">
                        <i style={{ ["--p" as string]: d.ink }} />
                        {d.ownerName ?? "Nobody named"}
                      </span>{" "}
                      will {lcFirst(d.title)} <span className="by">by {d.dueOn ? fmtLong(d.dueOn) : "a day not yet set"}</span>.
                    </p>
                    {d.state === "approved" && d.sheetHref && d.sheetWeek ? (
                      <p className="tb-where">
                        <Link href={d.sheetHref}>
                          On {d.ownerName}&apos;s sheet for the week of {fmtShort(d.sheetWeek)}
                        </Link>
                        .
                      </p>
                    ) : (
                      <p className="tb-where">{d.merged ? `Same as ${d.duplicateTitle ?? "an open task"}.` : "Not a commitment."}</p>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  // No drafts yet: the note on the left, one action on the right.
  if (rows.length === 0) {
    const blocked = note.status === "received" && realNoteBlocked(note);
    return (
      <div className="tb">
        <div className="stack">
          <div className="sheet">
            {head}
            <div className="tb-grid tb-one">
              <p className="tb-p tb-whole">{note.body}</p>
              <div className="tb-c tb-first">
                {blocked ? (
                  <p role="status" className="tb-where">
                    {REAL_NOTE_REFUSED}
                  </p>
                ) : (
                  <DraftButton noteId={note.id} failed={note.status === "failed"} />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <DraftingTable
      title={note.title}
      day={day}
      body={note.body ?? ""}
      drafts={rows}
      people={people}
      isLead={isLeadOf(person, note.teamId)}
    />
  );
}

export default function NoteRoute({ params }: PageProps<"/notes/[id]">) {
  return (
    <Suspense fallback={null}>
      <NotePage params={params} />
    </Suspense>
  );
}
