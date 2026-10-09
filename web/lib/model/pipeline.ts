// Note to drafts. The only thing this file ever writes about tasks is draft rows (FR-67e):
// no task exists until a person approves a draft. The note body is data in every step.
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { drafts, notes } from "@/lib/db/schema";
import { getNote, openTasksOf, rosterEntries } from "@/lib/db/queries-pipeline";
import { AnthropicDrafter } from "./anthropic-drafter";
import { runChecks, titleSimilarity, DUPLICATE_THRESHOLD } from "./checks";
import { FixtureDrafter } from "./fixture-drafter";
import { REAL_NOTE_REFUSED, gates, realNoteBlocked } from "./gate";
import { logModelCall } from "./log";
import { StubChecker, usable } from "./stub-checker";
import type { CheckedDraft, Checker, DraftCandidate, Drafter } from "./types";

export type DraftRun = { ok: true; count: number } | { ok: false; reason: string };

// The fixture drafter unless a key is set. The key alone never opens the gate for real notes.
export function defaultDrafter(): Drafter {
  return process.env.ANTHROPIC_API_KEY ? new AnthropicDrafter() : new FixtureDrafter();
}

// One commitment said twice is one draft. The first one stays.
function dedupe(list: DraftCandidate[]): DraftCandidate[] {
  const kept: DraftCandidate[] = [];
  for (const c of list) {
    const twin = kept.some(
      (k) => (k.spokenOwner ?? "") === (c.spokenOwner ?? "") && titleSimilarity(k.title, c.title) >= DUPLICATE_THRESHOLD,
    );
    if (!twin) kept.push(c);
  }
  return kept;
}

// The second pass (FR-68). It only adds a check line. It never edits or drops a draft.
async function secondPass(d: CheckedDraft, checker: Checker, synthetic: boolean): Promise<CheckedDraft> {
  if (!synthetic && !gates.typesafeAnswers()) {
    return { ...d, checks: [...d.checks, { name: "second_pass", pass: null, detail: "not run: the TypeSafe gate is closed for real notes" }] };
  }
  const q = {
    kind: "yes_no" as const,
    prompt: "Does the quote say the speaker will do this task?",
    subject: `${d.title}\n${d.quote}`,
  };
  const started = Date.now();
  let answer = null;
  try {
    answer = usable(q, await checker.check(q));
  } catch {
    answer = null; // an error is "no answer", never a default
  }
  if (answer) {
    await logModelCall({ step: "second_pass", model: checker.name, input: q.subject, output: { answer: answer.answer }, confidence: answer.confidence, latencyMs: Date.now() - started });
  }
  const detail = answer ? `the checker said ${answer.answer ? "yes" : "no"}` : "no answer from the checker";
  return { ...d, checks: [...d.checks, { name: "second_pass", pass: answer ? Boolean(answer.answer) : null, detail }] };
}

export async function draftFromNote(noteId: string, opts: { drafter?: Drafter; checker?: Checker } = {}): Promise<DraftRun> {
  const db = getDb();
  const note = await getNote(noteId);
  if (!note) return { ok: false, reason: "This note does not exist." };
  if (note.status === "cleared") return { ok: false, reason: "This note was already decided and its text was cleared." };
  if (note.status === "drafted") return { ok: false, reason: "This note already has drafts." };
  // NFR-10 and FR-72: a real note is held, no model is called, and the note stays as it is.
  if (realNoteBlocked(note)) return { ok: false, reason: REAL_NOTE_REFUSED };
  if (!note.body) return { ok: false, reason: "This note has no text." };

  const drafter = opts.drafter ?? defaultDrafter();
  const checker = opts.checker ?? new StubChecker();
  const [roster, open] = await Promise.all([rosterEntries(note.teamId), openTasksOf(note.teamId)]);

  const started = Date.now();
  let candidates: DraftCandidate[];
  try {
    candidates = await drafter.draft(
      { id: note.id, externalId: note.externalId, title: note.title, body: note.body, heldAt: note.heldAt },
      roster,
    );
  } catch (e) {
    // A model error means no draft, never a guessed one.
    await logModelCall({ step: "drafter", model: drafter.name, input: note.body, output: { error: e instanceof Error ? e.name : "error" }, latencyMs: Date.now() - started });
    await db.update(notes).set({ status: "failed" }).where(eq(notes.id, note.id));
    return { ok: false, reason: "The drafter failed. Nothing was drafted. An admin can try again." };
  }
  const unique = dedupe(candidates);
  await logModelCall({
    step: "drafter",
    model: drafter.name,
    input: note.body,
    output: { drafts: unique.length, dropped_twins: candidates.length - unique.length },
    latencyMs: Date.now() - started,
    cost: drafter.lastCost ?? 0,
  });

  let checked: CheckedDraft[] = unique.map((c) => runChecks(c, { body: note.body!, heldAt: note.heldAt, roster, openTasks: open }));
  checked = await Promise.all(checked.map((d) => secondPass(d, checker, note.synthetic)));

  const now = new Date().toISOString();
  return db.transaction(async (tx) => {
    const [fresh] = await tx.select().from(notes).where(eq(notes.id, note.id));
    if (!fresh || fresh.status === "drafted" || fresh.status === "cleared") return { ok: false as const, reason: "This note already has drafts." };
    if (checked.length > 0) {
      await tx.insert(drafts).values(
        checked.map((d, i) => ({
          id: `drf_${Math.random().toString(36).slice(2, 8)}${i}${Date.now().toString(36)}`,
          noteId: note.id,
          title: d.title.slice(0, 200),
          spokenOwner: d.spokenOwner,
          ownerId: d.ownerId === "missing" ? null : d.ownerId,
          duePhrase: d.duePhrase,
          dueOn: d.dueOn === "missing" ? null : d.dueOn,
          dueKind: d.dueKind,
          sourceQuote: d.quote,
          quoteValid: d.quoteValid,
          critical: d.critical,
          confidence: Math.min(1, Math.max(0, d.confidence)),
          duplicateOf: d.duplicateOf,
          checks: d.checks,
          state: "draft" as const,
        })),
      );
      await tx.update(notes).set({ status: "drafted", draftedAt: now }).where(eq(notes.id, note.id));
    } else {
      // R10: no drafts means nothing is left to decide, so the text is cleared now.
      await tx.update(notes).set({ status: "cleared", body: null, draftedAt: now }).where(eq(notes.id, note.id));
    }
    return { ok: true as const, count: checked.length };
  });
}
