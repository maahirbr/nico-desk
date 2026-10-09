// The send state changes, as plain functions. The server actions in lib/actions/sends.ts call
// these after they read the person from the cookie, and the smoke test calls them directly.
// A send moves forward only by a person's action (FR-56, R11): draft, approved, sent.
import { and, eq } from "drizzle-orm";
import { AuthError, type Person } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { taskOwnerOf, type SendRow } from "@/lib/db/queries-pipeline";
import { sends } from "@/lib/db/schema";
import { APPROVER_WORD, mayAct, type SendKind } from "./kinds";
import { deliver } from "./outbox";
import { asSnapshot } from "./render";

// not_approver: only the kind's approver may approve, send or discard.
export async function assertApprover(person: Person, send: SendRow): Promise<void> {
  const taskOwnerId = await taskOwnerOf(send.taskId);
  if (!mayAct(person, { kind: send.kind, teamId: send.teamId, subjectId: send.subjectId, taskOwnerId })) {
    throw new AuthError(`Only ${APPROVER_WORD[send.kind as SendKind]} can do this.`);
  }
}

export async function approveSendRow(person: Person, send: SendRow, coveringText = ""): Promise<void> {
  await assertApprover(person, send);
  if (send.state !== "draft") throw new AuthError("Only a draft can be approved.");
  let body = asSnapshot(send.bodySnapshot);
  // The covering text may be edited before approval, for the Friday message only (FR-52).
  const covering = coveringText.trim();
  if (send.kind === "overdue_weekly" && covering) body = { ...body, covering: covering.slice(0, 1000) };
  const done = await getDb()
    .update(sends)
    .set({ state: "approved", approvedBy: person.id, approvedAt: new Date().toISOString(), bodySnapshot: body })
    .where(and(eq(sends.id, send.id), eq(sends.state, "draft")))
    .returning({ id: sends.id });
  if (done.length === 0) throw new AuthError("Only a draft can be approved.");
}

export type SendOutcome = "sent" | "already_sent" | "failed";

export async function sendApprovedRow(person: Person, send: SendRow): Promise<SendOutcome> {
  await assertApprover(person, send);
  if (send.state === "sent") return "already_sent";
  if (send.state !== "approved") throw new AuthError("This message is not approved yet. Approve it first.");
  try {
    // The outbox writes a send id once, so a second press cannot send twice.
    const out = deliver({ id: send.id, kind: send.kind, recipients: send.recipients, body: asSnapshot(send.bodySnapshot) });
    await getDb()
      .update(sends)
      .set({ state: "sent", providerId: out.providerId, sentAt: new Date().toISOString() })
      .where(and(eq(sends.id, send.id), eq(sends.state, "approved")));
    return "sent";
  } catch (e) {
    console.error(e);
    await getDb().update(sends).set({ state: "failed" }).where(and(eq(sends.id, send.id), eq(sends.state, "approved")));
    return "failed";
  }
}
