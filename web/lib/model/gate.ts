// The two gates for real notes. Both are off unless the repo owner sets the flag (FR-72, NFR-10).
// A note with synthetic = false counts as real. Nothing here reads note text.
export const gates = {
  // The company has approved the hosted model vendor in writing.
  vendorApproved: () => process.env.GATE_VENDOR_APPROVED === "1",
  // The five TypeSafe answers are on file.
  typesafeAnswers: () => process.env.GATE_TYPESAFE_ANSWERS === "1",
};

export const REAL_NOTE_REFUSED =
  "This note is not marked synthetic. Real notes are held until the vendor gate is open (FR-72). No model was called.";

export function realNoteBlocked(note: { synthetic: boolean }): boolean {
  return !note.synthetic && !gates.vendorApproved();
}
