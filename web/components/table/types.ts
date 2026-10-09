// What the server hands the drafting table: plain data only, so the client holds no query logic.
// A check on a draft. "ok" is a plain word, "attention" needs a look (hollow amber square), "critical" is a tracked-caps word.
// None of them uses green or red: those colours belong to the marks of the sheet.
export type DraftCheck = { kind: "ok" | "attention" | "critical"; word: string };

export type TableDraft = {
  id: string;
  title: string;
  ownerId: string | null; // null when the spoken owner matched nobody
  ownerName: string | null; // the matched person's name, or the name as spoken
  ink: string; // the owner's department ink, or plain ink
  dueOn: string | null; // null when no date was given
  quote: string;
  duplicateTitle: string | null; // set when a possible duplicate is flagged
  state: "draft" | "approved" | "rejected";
  merged: boolean; // rejected as the same as an open task
  checks: DraftCheck[];
  sheetHref: string | null; // approved: the owner's sheet at the right week
  sheetWeek: string | null; // approved: the Monday of that week
};

export type TablePerson = { id: string; name: string; ink: string };
