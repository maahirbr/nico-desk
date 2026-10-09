// Interfaces for the two model seams. Code never depends on a vendor: it depends on these.
// A note body is DATA. Nothing here lets note text act as an instruction.

export type RosterEntry = { id: string; name: string };

// What a drafter returns (FR-46). It is raw: code (checks.ts) matches the owner, derives the
// date and validates the quote afterwards. A date the model made up is never read.
export type DraftCandidate = {
  title: string;
  spokenOwner: string | null; // the name as said, or null when nobody was named
  duePhrase: string | null; // the exact date words as said, or null
  quote: string; // must be an exact substring of the note body (checked in code)
  critical: boolean;
  confidence: number; // 0 to 1
};

export type NoteInput = {
  id: string;
  externalId: string | null;
  title: string;
  body: string;
  heldAt: string; // ISO timestamp
};

export interface Drafter {
  readonly name: string; // logged as the model in model_calls
  lastCost?: number; // USD for the last call, when the drafter knows it
  draft(note: NoteInput, roster: RosterEntry[]): Promise<DraftCandidate[]>;
}

// Jev style typed questions. Options are in a fixed order by design.
export type CheckerQuestion =
  | { kind: "choice"; prompt: string; options: string[]; subject: string }
  | { kind: "score"; prompt: string; subject: string }
  | { kind: "yes_no"; prompt: string; subject: string };

export type CheckerAnswer = { answer: string | number | boolean; confidence: number };

export interface Checker {
  readonly name: string;
  // null means "no answer": an error, a low confidence or a refusal. Never a default.
  check(question: CheckerQuestion): Promise<CheckerAnswer | null>;
}

// One entry in drafts.checks.
// pass is null when the check did not run (for example the second pass).
export type CheckResult = { name: string; pass: boolean | null; detail: string };

// A draft after the code checks. owner and due are either a value or the word "missing".
export type CheckedDraft = DraftCandidate & {
  ownerId: string | "missing";
  dueOn: string | "missing";
  dueKind: "stated" | "inferred" | "missing";
  quoteValid: boolean;
  duplicateOf: string | null;
  checks: CheckResult[];
};
