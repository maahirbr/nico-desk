// Turns pending draft rows into the plain data the drafting-table draft line takes. The same checks as the note
// page, so a draft reads the same in Monday mode. Server-safe: no React, no database.
import type { DraftCheck, TableDraft, TablePerson } from "@/components/table/types";
import { fmtDay } from "@/lib/format";
import type { DraftListRow } from "@/lib/db/queries-pipeline";

type Check = { name: string; pass: boolean | null; detail: string };

// Passing checks are plain words. A check that needs a look keeps a hollow amber square. None is green or red.
function checksOf(d: DraftListRow, dupTitle: string | null): DraftCheck[] {
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

export function toTableDrafts(list: DraftListRow[], people: TablePerson[], dupTitles: Record<string, string>): TableDraft[] {
  const byId = new Map(people.map((p) => [p.id, p]));
  return list.map((d) => {
    const o = d.ownerId ? byId.get(d.ownerId) : undefined;
    const dup = d.duplicateOf ? (dupTitles[d.duplicateOf] ?? null) : null;
    return {
      id: d.id,
      title: d.title,
      ownerId: d.ownerId,
      ownerName: o?.name ?? d.spokenOwner ?? null,
      ink: o?.ink ?? "var(--ink)",
      dueOn: d.dueOn,
      quote: d.sourceQuote,
      duplicateTitle: dup ?? (d.duplicateOf ? "an open task" : null),
      state: "draft" as const,
      merged: false,
      checks: checksOf(d, dup),
      sheetHref: null,
      sheetWeek: null,
    };
  });
}
