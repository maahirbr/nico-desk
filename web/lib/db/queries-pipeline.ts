// Reads for the notes, drafts, sends and search pages. Plain queries over the existing schema.
// Writes live in lib/actions and lib/model, not here.
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { getDb } from "./client";
import { drafts, emailOptins, events, notes, people, sends, tasks, teamMembers, teams } from "./schema";
import type { OpenTask } from "@/lib/model/checks";
import type { RosterEntry } from "@/lib/model/types";

export type NoteRow = typeof notes.$inferSelect;
export type DraftRow = typeof drafts.$inferSelect;
export type SendRow = typeof sends.$inferSelect;

// Active people on a team, as the drafter and the checks see them.
export async function rosterEntries(teamId: string): Promise<RosterEntry[]> {
  const rows = await getDb()
    .selectDistinct({ id: people.id, name: people.displayName })
    .from(people)
    .innerJoin(teamMembers, eq(teamMembers.personId, people.id))
    .where(and(eq(teamMembers.teamId, teamId), eq(people.active, true)))
    .orderBy(asc(people.displayName));
  return rows;
}

export async function openTasksOf(teamId: string): Promise<OpenTask[]> {
  return getDb()
    .select({ id: tasks.id, title: tasks.title, ownerId: tasks.ownerId })
    .from(tasks)
    .where(and(eq(tasks.teamId, teamId), eq(tasks.statusCategory, "open")));
}

export async function teamNames(): Promise<Map<string, string>> {
  const rows = await getDb().select().from(teams);
  return new Map(rows.map((t) => [t.id, t.name]));
}

export async function getNote(id: string): Promise<NoteRow | null> {
  const [row] = await getDb().select().from(notes).where(eq(notes.id, id));
  return row ?? null;
}

export type NoteListRow = NoteRow & { pending: number; total: number };

export async function listNotes(teamIds: string[]): Promise<NoteListRow[]> {
  if (teamIds.length === 0) return [];
  const db = getDb();
  const rows = await db.select().from(notes).where(inArray(notes.teamId, teamIds)).orderBy(desc(notes.heldAt));
  if (rows.length === 0) return [];
  const counts = await db
    .select({
      noteId: drafts.noteId,
      total: sql<number>`count(*)::int`,
      pending: sql<number>`count(*) FILTER (WHERE ${drafts.state} = 'draft')::int`,
    })
    .from(drafts)
    .where(inArray(drafts.noteId, rows.map((r) => r.id)))
    .groupBy(drafts.noteId);
  const byNote = new Map(counts.map((c) => [c.noteId, c]));
  return rows.map((r) => ({ ...r, pending: byNote.get(r.id)?.pending ?? 0, total: byNote.get(r.id)?.total ?? 0 }));
}

export async function draftsOfNote(noteId: string): Promise<DraftRow[]> {
  return rankDrafts(await getDb().select().from(drafts).where(eq(drafts.noteId, noteId)));
}

// FR-48: critical first, then confidence, then the fewest missing fields.
function missingFields(d: DraftRow): number {
  return (d.ownerId ? 0 : 1) + (d.dueOn ? 0 : 1);
}
export function rankDrafts(list: DraftRow[]): DraftRow[] {
  return [...list].sort(
    (a, b) =>
      Number(b.critical) - Number(a.critical) ||
      b.confidence - a.confidence ||
      missingFields(a) - missingFields(b) ||
      a.id.localeCompare(b.id),
  );
}

export type DraftListRow = DraftRow & { noteTitle: string; teamId: string };

export async function listDrafts(teamIds: string[], which: "pending" | "decided"): Promise<DraftListRow[]> {
  if (teamIds.length === 0) return [];
  const rows = await getDb()
    .select({ d: drafts, noteTitle: notes.title, teamId: notes.teamId })
    .from(drafts)
    .innerJoin(notes, eq(notes.id, drafts.noteId))
    .where(and(inArray(notes.teamId, teamIds), which === "pending" ? eq(drafts.state, "draft") : sql`${drafts.state} <> 'draft'`))
    .orderBy(asc(drafts.id));
  const joined = rows.map((r) => ({ ...r.d, noteTitle: r.noteTitle, teamId: r.teamId }));
  if (which === "pending") {
    const order = new Map(rankDrafts(joined).map((d, i) => [d.id, i]));
    return joined.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  }
  return joined.sort((a, b) => (b.decidedAt ?? "").localeCompare(a.decidedAt ?? ""));
}

export async function getDraft(id: string): Promise<(DraftRow & { note: NoteRow }) | null> {
  const [row] = await getDb()
    .select({ d: drafts, n: notes })
    .from(drafts)
    .innerJoin(notes, eq(notes.id, drafts.noteId))
    .where(eq(drafts.id, id));
  return row ? { ...row.d, note: row.n } : null;
}

// ---- sends ----

export async function getSend(id: string): Promise<SendRow | null> {
  const [row] = await getDb().select().from(sends).where(eq(sends.id, id));
  return row ?? null;
}

export async function taskOwnerOf(taskId: string | null): Promise<string | null> {
  if (!taskId) return null;
  const [t] = await getDb().select({ ownerId: tasks.ownerId }).from(tasks).where(eq(tasks.id, taskId));
  return t?.ownerId ?? null;
}

// Sends in the teams a person belongs to, newest first. The caller filters by who may act.
export async function listSends(teamIds: string[], limit = 200): Promise<(SendRow & { taskOwnerId: string | null })[]> {
  if (teamIds.length === 0) return [];
  const rows = await getDb()
    .select({ s: sends, taskOwnerId: tasks.ownerId })
    .from(sends)
    .leftJoin(tasks, eq(tasks.id, sends.taskId))
    .where(inArray(sends.teamId, teamIds))
    .orderBy(desc(sends.createdAt), desc(sends.id))
    .limit(limit);
  return rows.map((r) => ({ ...r.s, taskOwnerId: r.taskOwnerId }));
}

export async function sendCounts(): Promise<{ kind: string; state: string; n: number }[]> {
  return getDb()
    .select({ kind: sends.kind, state: sends.state, n: sql<number>`count(*)::int` })
    .from(sends)
    .groupBy(sends.kind, sends.state)
    .orderBy(asc(sends.kind), asc(sends.state));
}

export async function isOptedIn(personId: string): Promise<boolean> {
  const [row] = await getDb()
    .select()
    .from(emailOptins)
    .where(and(eq(emailOptins.personId, personId), eq(emailOptins.kind, "monday_digest"), isNull(emailOptins.optedOutAt)));
  return !!row;
}

// ---- search (FR-74) ----

export type EventHit = { id: string; taskId: string; taskTitle: string; field: string; reason: string | null; text: string | null; at: string };

// Plain ILIKE on the reason and on the text of an update. Note bodies are never searched (R10).
export async function searchEvents(teamIds: string[], q: string, limit = 20): Promise<EventHit[]> {
  const term = q.trim();
  if (!term || teamIds.length === 0) return [];
  const like = `%${term.replace(/[\\%_]/g, "\\$&")}%`;
  const rows = await getDb()
    .select({
      id: events.id,
      taskId: events.entityId,
      taskTitle: tasks.title,
      field: events.field,
      reason: events.reason,
      after: events.after,
      at: events.at,
    })
    .from(events)
    .innerJoin(tasks, and(eq(tasks.id, events.entityId), eq(events.entityType, "task")))
    .where(
      and(
        inArray(tasks.teamId, teamIds),
        or(ilike(events.reason, like), and(eq(events.field, "_update"), sql`${events.after} #>> '{}' ILIKE ${like}`)),
      ),
    )
    .orderBy(desc(events.at))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    taskId: r.taskId,
    taskTitle: r.taskTitle,
    field: r.field,
    reason: r.reason,
    text: r.field === "_update" && typeof r.after === "string" ? r.after : null,
    at: r.at,
  }));
}

export async function searchPeople(teamIds: string[], q: string, limit = 20) {
  const term = q.trim();
  if (!term || teamIds.length === 0) return [];
  const like = `%${term.replace(/[\\%_]/g, "\\$&")}%`;
  return getDb()
    .selectDistinct({ id: people.id, name: people.displayName, role: people.role, department: people.department })
    .from(people)
    .innerJoin(teamMembers, eq(teamMembers.personId, people.id))
    .where(and(inArray(teamMembers.teamId, teamIds), eq(people.active, true), ilike(people.displayName, like)))
    .orderBy(asc(people.displayName))
    .limit(limit);
}
