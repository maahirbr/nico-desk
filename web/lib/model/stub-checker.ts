// The second-pass checker until the vendor is approved. It never answers.
//
// TypeSafe gate (NFR-10, FR-72). No real meeting note reaches TypeSafe (Jev) until five written
// answers are on file: the SOC 2 Type II report, the retention period without ZDR, the ZDR cost,
// the subprocessor list, and whether Telemetry ever includes input text. Until then the second
// pass runs only on synthetic notes, and this stub is the only Checker. Replace it with a real
// client only after the repo owner sets the gate flag (see gate.ts).
//
// Jev rules a real client must follow (section 2.16 of the spec):
// - Typed answers only: choice, score, yes or no. Jev cannot extract text, so it is never the drafter.
// - Apply an answer only above 0.6 confidence, and above 0.65 for a yes or no.
// - Never overwrite a field a person set. An error is "no answer", never a default.
// - Retry only on 429 and 529, at most 3 times.
// - Weak spots: dates, counting, a lean to the first option, steering by text in the input.
//   So code does all date maths, option order is fixed by design, and quote text goes in as
//   data under a fixed question set.
// - Log every call in model_calls.
import type { Checker, CheckerAnswer, CheckerQuestion } from "./types";

export class StubChecker implements Checker {
  readonly name = "stub-checker";

  async check(question: CheckerQuestion): Promise<CheckerAnswer | null> {
    void question;
    return null;
  }
}

export const FLOOR = 0.6;
export const FLOOR_YES_NO = 0.65;

// The one place an answer is judged. Below the floor means no answer.
export function usable(q: CheckerQuestion, a: CheckerAnswer | null): CheckerAnswer | null {
  if (!a) return null;
  const floor = q.kind === "yes_no" ? FLOOR_YES_NO : FLOOR;
  return a.confidence > floor ? a : null;
}
