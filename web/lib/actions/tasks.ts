"use server";
// Task actions. Each one reads the person from the cookie, re-checks the role on the server,
// calls one mutation, and returns a plain sentence on failure. No optimistic UI.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AuthError, isAdmin, isLeadOf, isOnTeam, requirePerson, type Person } from "@/lib/auth";
import { DeskError, appendNoteToTask, close, createTask, renegotiate, reopen, setBlockedOn, setHealth, setPriority } from "@/lib/db/mutations";
import { isIsoDate, todayIST } from "@/lib/db/dates";
import { getTask } from "@/lib/views";
import type { Task } from "@/lib/db/mutations";
import type { ActionResult } from "@/components/ui/ActionForm";

const WORDS: Record<string, string> = {
  stale_version: "Someone changed this task while you were reading it. Reload the page and try again.",
  not_open: "This task is closed. Ask a lead to reopen it first.",
  not_closed: "This task is already open.",
  not_lead: "Only a lead of this team can do this.",
};

function plain(e: unknown): string {
  if (e instanceof AuthError) return e.message;
  if (e instanceof DeskError) return WORDS[e.code] ?? `${e.message.charAt(0).toUpperCase()}${e.message.slice(1)}.`;
  console.error(e);
  return "Something went wrong. Nothing was saved.";
}

const text = (d: FormData, k: string) => String(d.get(k) ?? "").trim();
const num = (d: FormData) => {
  const raw = d.get("version");
  const v = Number(raw);
  return raw !== null && raw !== "" && Number.isInteger(v) ? v : undefined;
};

type Who = "owner" | "lead" | "owner_or_lead" | "any";

// Loads the task and the person. Refuses a mirrored sheet task, a stranger, or a missing role.
async function guard(d: FormData, who: Who): Promise<{ p: Person; t: Task }> {
  const p = await requirePerson();
  const t = await getTask(text(d, "taskId"));
  if (!t) throw new AuthError("This task does not exist.");
  if (t.origin === "sheet") throw new AuthError("This task comes from a Sheet. Change it there.");
  if (!isOnTeam(p, t.teamId) && !isAdmin(p)) throw new AuthError("You are not on this team.");
  const lead = isLeadOf(p, t.teamId);
  const owner = t.ownerId === p.id;
  if (who === "lead" && !lead) throw new AuthError("Only a lead of this team can do this.");
  if (who === "owner" && !owner) throw new AuthError("Only the owner can do this.");
  if (who === "owner_or_lead" && !owner && !lead) throw new AuthError("Only the owner or a lead can do this.");
  return { p, t };
}

async function run(d: FormData, who: Who, ok: string, fn: (p: Person, t: Task, v?: number) => Promise<unknown>): Promise<ActionResult> {
  try {
    const { p, t } = await guard(d, who);
    await fn(p, t, num(d));
    revalidatePath(`/tasks/${t.id}`);
    return { ok };
  } catch (e) {
    // Refresh the page too, so a stale-version error shows the task as it is now.
    const id = text(d, "taskId");
    if (id) revalidatePath(`/tasks/${id}`);
    return { error: plain(e) };
  }
}

const needDate = (d: FormData, k: string) => {
  const v = text(d, k);
  if (!isIsoDate(v)) throw new DeskError("invalid", "pick a date");
  if (v < todayIST()) throw new DeskError("invalid", "the new date must be today or later");
  return v;
};

export async function renegotiateAction(_p: ActionResult, d: FormData): Promise<ActionResult> {
  return run(d, "owner_or_lead", "The date is moved. The first date stays.", (p, t, version) =>
    renegotiate(t.id, { dueOn: needDate(d, "dueOn"), reason: text(d, "reason"), byPersonId: p.id, version }),
  );
}

export async function healthAction(_p: ActionResult, d: FormData): Promise<ActionResult> {
  const health = text(d, "health") as "not_started" | "off_track" | "on_track" | "ahead";
  return run(d, "owner_or_lead", "Health is saved.", (p, t, version) =>
    health === "off_track"
      ? setHealth(t.id, { health, dueOn: needDate(d, "dueOn"), reason: text(d, "reason"), byPersonId: p.id, version })
      : setHealth(t.id, { health, byPersonId: p.id, version }),
  );
}

export async function closeAction(_p: ActionResult, d: FormData): Promise<ActionResult> {
  const as = text(d, "as") === "dropped" ? "dropped" : "done";
  return run(d, "owner_or_lead", as === "done" ? "Closed as done." : "Dropped.", (p, t, version) =>
    close(t.id, { as, reason: text(d, "reason"), byPersonId: p.id, version }),
  );
}

export async function reopenAction(_p: ActionResult, d: FormData): Promise<ActionResult> {
  return run(d, "lead", "Reopened.", (p, t, version) => reopen(t.id, { reason: text(d, "reason"), byPersonId: p.id, version }));
}

export async function priorityAction(_p: ActionResult, d: FormData): Promise<ActionResult> {
  const priority = text(d, "priority") as "high" | "normal" | "low";
  return run(d, "lead", "Priority is saved.", (p, t, version) => setPriority(t.id, { priority, byPersonId: p.id, version }));
}

// Raise: the owner names a person and writes the ask. Clear: the owner, the person named, or a lead.
export async function blockAction(_p: ActionResult, d: FormData): Promise<ActionResult> {
  const clearing = text(d, "mode") === "clear";
  return run(d, "any", clearing ? "The block is cleared." : "The block is raised. The person sees a notice.", (p, t, version) => {
    if (clearing) {
      if (t.ownerId !== p.id && t.blockedOnId !== p.id && !isLeadOf(p, t.teamId)) {
        throw new AuthError("Only the owner, the person named or a lead can clear this.");
      }
      return setBlockedOn(t.id, { blockedOnId: null, note: text(d, "note"), byPersonId: p.id, version });
    }
    if (t.ownerId !== p.id) throw new AuthError("Only the owner can raise a block.");
    const onId = text(d, "blockedOnId");
    if (!onId || onId === t.ownerId) throw new DeskError("invalid", "name a person other than the owner");
    return setBlockedOn(t.id, { blockedOnId: onId, ask: text(d, "ask"), byPersonId: p.id, version });
  });
}

export async function noteAction(_p: ActionResult, d: FormData): Promise<ActionResult> {
  return run(d, "owner_or_lead", "Note is saved.", (p, t, version) => appendNoteToTask(t.id, { note: text(d, "note"), byPersonId: p.id, version }));
}

export async function createTaskAction(_p: ActionResult, d: FormData): Promise<ActionResult> {
  let id: string;
  try {
    const p = await requirePerson();
    const teamId = text(d, "teamId");
    if (!isOnTeam(p, teamId)) throw new AuthError("You are not on this team.");
    const t = await createTask({
      teamId,
      title: text(d, "title"),
      ownerId: text(d, "ownerId"),
      projectId: text(d, "projectId") || undefined,
      dueOn: needDate(d, "dueOn"),
      note: text(d, "note") || undefined,
      byPersonId: p.id,
    });
    const pri = text(d, "priority");
    if (pri && isLeadOf(p, teamId)) await setPriority(t.id, { priority: pri as "high" | "normal" | "low", byPersonId: p.id });
    id = t.id;
  } catch (e) {
    return { error: plain(e) };
  }
  redirect(`/tasks/${id}`);
}
