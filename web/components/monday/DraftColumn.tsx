"use client";
// The middle column: pending drafts from the team's notes, grouped by note. Each draft is the same line the
// drafting table uses, with its quote shown under it. Accepting one slides it onto the owner's sheet in the
// right column, then the page asks for its data again, so the counts change without a navigation.
import { useState } from "react";
import { DraftLine } from "@/components/table/DraftLine";
import type { TableDraft, TablePerson } from "@/components/table/types";

export type NoteGroup = { id: string; title: string; drafts: TableDraft[] };

export function DraftColumn({ groups, people, isLead }: { groups: NoteGroup[]; people: TablePerson[]; isLead: boolean }) {
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const byId = new Map(people.map((p) => [p.id, p]));
  if (groups.length === 0) return <p className="empty">No drafts are waiting.</p>;
  return (
    <>
      {groups.map((g) => (
        <section key={g.id} className="mon-note" aria-label={g.title}>
          <h3 className="mon-nh">{g.title}</h3>
          <ul>
            {g.drafts.map((d) => {
              const owner = byId.get(d.ownerId ?? chosen[d.id] ?? "") ?? null;
              return (
                <li key={d.id} className="mon-draft">
                  <DraftLine
                    d={d}
                    people={people}
                    isLead={isLead}
                    owner={owner}
                    ink={owner?.ink ?? d.ink}
                    chosen={chosen[d.id] ?? ""}
                    onChoose={(id) => setChosen((c) => ({ ...c, [d.id]: id }))}
                    showQuote
                  />
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}
