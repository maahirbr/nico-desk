"use server";
// Paste a note, and draft tasks from a note. The paste path is POST /notes in the spec (FR-63).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AuthError, isOnTeam, requirePerson } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { isIsoDate, todayIST } from "@/lib/db/dates";
import { getNote } from "@/lib/db/queries-pipeline";
import { notes } from "@/lib/db/schema";
import { plainError } from "@/lib/model/errors";
import { draftFromNote } from "@/lib/model/pipeline";
import type { ActionResult } from "@/components/ui/ActionForm";

const text = (d: FormData, k: string) => String(d.get(k) ?? "").trim();
const MAX_BODY = 100_000;

export async function pasteNoteAction(_p: ActionResult, d: FormData): Promise<ActionResult> {
  let id: string;
  try {
    const person = await requirePerson();
    const teamId = text(d, "teamId");
    if (!isOnTeam(person, teamId)) throw new AuthError("You are not on this team.");
    const title = text(d, "title");
    const body = String(d.get("body") ?? "");
    if (title.length < 1 || title.length > 200) throw new AuthError("Give the note a title of up to 200 characters.");
    if (body.trim().length < 1) throw new AuthError("Paste the note text first.");
    if (body.length > MAX_BODY) throw new AuthError("This note is too long. The limit is 100,000 characters.");
    const day = text(d, "heldOn") || todayIST();
    if (!isIsoDate(day)) throw new AuthError("Pick the day the meeting was held.");
    // FR-65: no API sets synthetic. Only this dev form can, and never in production.
    const synthetic = process.env.NODE_ENV !== "production" && d.get("synthetic") === "on";
    id = `ntn_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36)}`;
    const now = new Date().toISOString();
    await getDb().insert(notes).values({
      id,
      teamId,
      sourceApp: "paste",
      externalId: null,
      title,
      body,
      heldAt: `${day}T06:30:00Z`, // midday in Asia/Kolkata, so the day never shifts
      receivedAt: now,
      status: "received",
      synthetic,
    });
  } catch (e) {
    return { error: plainError(e) };
  }
  revalidatePath("/notes");
  redirect(`/notes/${id}`);
}

export async function draftNoteAction(_p: ActionResult, d: FormData): Promise<ActionResult> {
  try {
    const person = await requirePerson();
    const note = await getNote(text(d, "noteId"));
    if (!note) throw new AuthError("This note does not exist.");
    if (!isOnTeam(person, note.teamId)) throw new AuthError("You are not on this team.");
    const run = await draftFromNote(note.id);
    revalidatePath(`/notes/${note.id}`);
    revalidatePath("/notes");
    revalidatePath("/drafts");
    return run.ok ? { ok: run.count === 0 ? "No tasks found in this note." : `${run.count} ${run.count === 1 ? "draft" : "drafts"} made. A lead reviews them.` } : { error: run.reason };
  } catch (e) {
    return { error: plainError(e) };
  }
}
