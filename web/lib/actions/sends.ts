"use server";
// Approve, send and discard a send, and the Monday digest opt-in. Each action reads the person
// from the cookie, then checks the kind's approver on the server (FR-57). Nothing is sent
// unless a person approved it first (FR-58).
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { AuthError, requirePerson } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { getSend } from "@/lib/db/queries-pipeline";
import { emailOptins, sends } from "@/lib/db/schema";
import { plainError } from "@/lib/model/errors";
import { approveSendRow, assertApprover, sendApprovedRow } from "@/lib/sends/transitions";
import type { ActionResult } from "@/components/ui/ActionForm";

const text = (d: FormData, k: string) => String(d.get(k) ?? "").trim();

async function guard(d: FormData) {
  const person = await requirePerson();
  const send = await getSend(text(d, "sendId"));
  if (!send) throw new AuthError("This message does not exist.");
  await assertApprover(person, send);
  return { person, send };
}

const refresh = () => revalidatePath("/sends");

export async function approveSendAction(_p: ActionResult, d: FormData): Promise<ActionResult> {
  try {
    const { person, send } = await guard(d);
    await approveSendRow(person, send, text(d, "coveringText"));
    refresh();
    return { ok: "Approved. Nothing is sent until you press send." };
  } catch (e) {
    return { error: plainError(e) };
  }
}

export async function sendSendAction(_p: ActionResult, d: FormData): Promise<ActionResult> {
  try {
    const { person, send } = await guard(d);
    const out = await sendApprovedRow(person, send);
    refresh();
    if (out === "already_sent") return { ok: "Already sent. Nothing more was sent." };
    if (out === "failed") return { error: "The message could not be sent. It is marked failed." };
    return { ok: "Sent to the local outbox." };
  } catch (e) {
    return { error: plainError(e) };
  }
}

export async function discardSendAction(_p: ActionResult, d: FormData): Promise<ActionResult> {
  try {
    const { send } = await guard(d);
    if (send.state !== "draft" && send.state !== "approved") throw new AuthError("Only a draft or approved message can be discarded.");
    await getDb()
      .update(sends)
      .set({ state: "discarded" })
      .where(and(eq(sends.id, send.id), eq(sends.state, send.state)));
    refresh();
    return { ok: "Discarded. Nothing was sent." };
  } catch (e) {
    return { error: plainError(e) };
  }
}

// The opt-in is the approval for the Monday digest (FR-56, FR-59). Opting out stops the next one,
// and discards a digest that was approved but not yet sent.
export async function digestOptInAction(_p: ActionResult, d: FormData): Promise<ActionResult> {
  try {
    const person = await requirePerson();
    const db = getDb();
    const now = new Date().toISOString();
    if (text(d, "on") === "1") {
      await db
        .insert(emailOptins)
        .values({ personId: person.id, kind: "monday_digest", optedInAt: now })
        .onConflictDoUpdate({ target: [emailOptins.personId, emailOptins.kind], set: { optedInAt: now, optedOutAt: null } });
      refresh();
      return { ok: "You will get a Monday digest of your own tasks." };
    }
    await db
      .update(emailOptins)
      .set({ optedOutAt: now })
      .where(and(eq(emailOptins.personId, person.id), eq(emailOptins.kind, "monday_digest")));
    await db
      .update(sends)
      .set({ state: "discarded" })
      .where(and(eq(sends.kind, "monday_digest"), eq(sends.subjectId, person.id), eq(sends.state, "approved")));
    refresh();
    return { ok: "You will not get a Monday digest." };
  } catch (e) {
    return { error: plainError(e) };
  }
}
