"use server";
// Approve, reject or merge a draft. Only a lead of the note's team may (FR-49). The role is read
// again on the server, never taken from a form field. Approval makes the task in the same
// transaction as the draft link (R9).
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { AuthError, requireLead, type Person } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { isIsoDate } from "@/lib/db/dates";
import { DeskError, addUpdate, createTaskIn } from "@/lib/db/mutations";
import { getDraft } from "@/lib/db/queries-pipeline";
import { drafts, notes } from "@/lib/db/schema";
import { plainError } from "@/lib/model/errors";
import type { ActionResult } from "@/components/ui/ActionForm";

const text = (d: FormData, k: string) => String(d.get(k) ?? "").trim();

async function guard(d: FormData) {
  const draft = await getDraft(text(d, "draftId"));
  if (!draft) throw new AuthError("This draft does not exist.");
  const lead: Person = await requireLead(draft.note.teamId);
  if (draft.state !== "draft") throw new DeskError("invalid", "this draft was already decided");
  return { draft, lead };
}

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

// R10: when every draft of a note is decided, the note text is cleared.
async function clearIfDecided(tx: Tx, noteId: string) {
  const [open] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(drafts)
    .where(and(eq(drafts.noteId, noteId), eq(drafts.state, "draft")));
  if (open.n === 0) await tx.update(notes).set({ body: null, status: "cleared" }).where(eq(notes.id, noteId));
}

function refresh(noteId: string, draftId: string) {
  revalidatePath("/drafts");
  revalidatePath(`/drafts/${draftId}`);
  revalidatePath(`/notes/${noteId}`);
  revalidatePath("/notes");
}

export async function approveDraftAction(_p: ActionResult, d: FormData): Promise<ActionResult> {
  try {
    const { draft, lead } = await guard(d);
    // The approver may change any field. Owner and date must be set after the merge (FR-49).
    const title = text(d, "title") || draft.title;
    const ownerId = text(d, "ownerId") || draft.ownerId;
    const dueOn = text(d, "dueOn") || draft.dueOn;
    const projectId = text(d, "projectId") || null;
    if (!ownerId) throw new DeskError("invalid", "set an owner before approving");
    if (!dueOn || !isIsoDate(dueOn)) throw new DeskError("invalid", "set a due date before approving");
    await getDb().transaction(async (tx) => {
      const task = await createTaskIn(tx, {
        teamId: draft.note.teamId,
        title,
        ownerId,
        dueOn,
        projectId,
        byPersonId: lead.id,
        origin: "notes",
        originRef: `${draft.noteId}#${draft.id}`,
      });
      const done = await tx
        .update(drafts)
        .set({ state: "approved", title, ownerId, dueOn, decidedBy: lead.id, decidedAt: new Date().toISOString(), taskId: task.id })
        .where(and(eq(drafts.id, draft.id), eq(drafts.state, "draft")))
        .returning({ id: drafts.id });
      if (done.length === 0) throw new DeskError("invalid", "this draft was already decided");
      await clearIfDecided(tx, draft.noteId);
    });
    refresh(draft.noteId, draft.id);
    revalidatePath("/me");
    return { ok: "Approved. The task is made." };
  } catch (e) {
    return { error: plainError(e) };
  }
}

export async function rejectDraftAction(_p: ActionResult, d: FormData): Promise<ActionResult> {
  try {
    const { draft, lead } = await guard(d);
    const note = text(d, "reason").slice(0, 280) || null;
    await getDb().transaction(async (tx) => {
      const done = await tx
        .update(drafts)
        .set({ state: "rejected", decidedBy: lead.id, decidedAt: new Date().toISOString(), decisionNote: note })
        .where(and(eq(drafts.id, draft.id), eq(drafts.state, "draft")))
        .returning({ id: drafts.id });
      if (done.length === 0) throw new DeskError("invalid", "this draft was already decided");
      await clearIfDecided(tx, draft.noteId);
    });
    refresh(draft.noteId, draft.id);
    return { ok: "Rejected." };
  } catch (e) {
    return { error: plainError(e) };
  }
}

// Merge: the draft is the same commitment as an open task. The draft closes as rejected with a
// pointer to that task, and the quote goes into the task's log as an update.
export async function mergeDraftAction(_p: ActionResult, d: FormData): Promise<ActionResult> {
  try {
    const { draft, lead } = await guard(d);
    if (!draft.duplicateOf) throw new DeskError("invalid", "this draft has no possible duplicate");
    const target = draft.duplicateOf;
    await getDb().transaction(async (tx) => {
      const done = await tx
        .update(drafts)
        .set({ state: "rejected", decidedBy: lead.id, decidedAt: new Date().toISOString(), decisionNote: `Merged into task ${target}` })
        .where(and(eq(drafts.id, draft.id), eq(drafts.state, "draft")))
        .returning({ id: drafts.id });
      if (done.length === 0) throw new DeskError("invalid", "this draft was already decided");
      await clearIfDecided(tx, draft.noteId);
    });
    await addUpdate(target, { text: `Said again in a meeting: "${draft.sourceQuote.slice(0, 240)}"`, byPersonId: lead.id });
    refresh(draft.noteId, draft.id);
    revalidatePath(`/tasks/${target}`);
    return { ok: "Merged into the open task." };
  } catch (e) {
    return { error: plainError(e) };
  }
}
