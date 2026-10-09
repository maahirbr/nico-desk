// Read helpers shared by the task views. Plain queries over the existing schema; no new rules.
import { asc, eq, inArray, max, sql, and } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { events, people, projects, tasks, teamMembers } from "@/lib/db/schema";
import type { EventRow, Person } from "@/lib/db/queries";
import type { Task } from "@/lib/db/mutations";
import { istDay } from "@/lib/db/dates";
import { getPersonOrRedirect, pickTeam } from "@/lib/auth";
import { HEALTH_WORD, PRIORITY_WORD, fmtDay, fmtStamp } from "@/lib/format";

export type TaskRow = Task & {
  ownerName: string;
  projectName: string | null;
  blockedOnName: string | null;
  lastAt: string | null; // latest event time, an ISO timestamp
  moves: number; // due_on changes since creation
};

export async function getTask(id: string): Promise<Task | null> {
  const [row] = await getDb().select().from(tasks).where(eq(tasks.id, id));
  return row ?? null;
}

export async function listProjects(teamId: string) {
  return getDb().select().from(projects).where(eq(projects.teamId, teamId)).orderBy(asc(projects.name));
}

// Everyone ever on the roster, so old log lines still show a name. Keyed by person id.
export async function nameMap(): Promise<Map<string, string>> {
  const rows = await getDb().select({ id: people.id, name: people.displayName }).from(people);
  return new Map(rows.map((r) => [r.id, r.name]));
}

export async function enrich(list: Task[]): Promise<TaskRow[]> {
  if (list.length === 0) return [];
  const db = getDb();
  const ids = list.map((t) => t.id);
  const names = await nameMap();
  const projs = new Map(
    (await db.select({ id: projects.id, name: projects.name }).from(projects)).map((p) => [p.id, p.name]),
  );
  const last = await db
    .select({ id: events.entityId, at: max(events.at) })
    .from(events)
    .where(and(eq(events.entityType, "task"), inArray(events.entityId, ids)))
    .groupBy(events.entityId);
  const moved = await db
    .select({ id: events.entityId, n: sql<number>`count(*)::int` })
    .from(events)
    .where(and(eq(events.entityType, "task"), eq(events.field, "due_on"), inArray(events.entityId, ids)))
    .groupBy(events.entityId);
  const lastMap = new Map(last.map((r) => [r.id, r.at]));
  const movedMap = new Map(moved.map((r) => [r.id, r.n]));
  return list.map((t) => ({
    ...t,
    ownerName: names.get(t.ownerId) ?? t.ownerId,
    projectName: t.projectId ? (projs.get(t.projectId) ?? null) : null,
    blockedOnName: t.blockedOnId ? (names.get(t.blockedOnId) ?? t.blockedOnId) : null,
    lastAt: lastMap.get(t.id) ?? null,
    moves: movedMap.get(t.id) ?? 0,
  }));
}

export async function roster(teamId: string): Promise<Person[]> {
  const rows = await getDb()
    .selectDistinct({ p: people })
    .from(people)
    .innerJoin(teamMembers, eq(teamMembers.personId, people.id))
    .where(and(eq(teamMembers.teamId, teamId), eq(people.active, true)))
    .orderBy(asc(people.displayName));
  return rows.map((r) => r.p);
}

const FIELD_LABEL: Record<string, string> = {
  _created: "Created",
  _reopened: "Reopened",
  _update: "Update",
  title: "Title",
  owner_id: "Owner",
  project_id: "Project",
  due_on: "Due date",
  note: "Note",
  health: "Health",
  status: "Status",
  status_category: "Status",
  priority: "Priority",
  blocked_on_id: "Blocked on",
  blocked_ask: "Ask",
  closed_at: "Closed at",
  closed_on: "Closed on",
};

export type LogLine = {
  id: string;
  who: string;
  when: string;
  what: string; // the change in one plain phrase
  reason: string | null;
};

// One display line per event: who, when, field, before, after, reason.
export function logLines(rows: EventRow[], names: Map<string, string>, projs: Map<string, string>): LogLine[] {
  const show = (field: string, v: unknown): string | null => {
    if (v === null || v === undefined) return null;
    if (field === "_created") return "task created";
    const s = typeof v === "string" ? v : JSON.stringify(v);
    if (field === "due_on" || field === "closed_on") return fmtDay(s);
    if (field === "closed_at") return fmtStamp(s);
    if (field === "health") return HEALTH_WORD[s] ?? s;
    if (field === "priority") return PRIORITY_WORD[s] ?? s;
    if (field === "owner_id" || field === "blocked_on_id") return names.get(s) ?? s;
    if (field === "project_id") return projs.get(s) ?? s;
    return s;
  };
  const what = (e: EventRow) => {
    const label = FIELD_LABEL[e.field] ?? e.field;
    const before = e.field === "_created" ? null : show(e.field, e.before);
    const after = show(e.field, e.after);
    if (e.field === "_created") return "Task created";
    if (before === null && after === null) return label;
    if (after === null) return `${label}: cleared (was ${before})`;
    return before === null ? `${label}: ${after}` : `${label}: ${before} to ${after}`;
  };
  return rows.map((e) => ({
    id: e.id,
    who: e.actorId ? (names.get(e.actorId) ?? e.actorId) : "System",
    when: fmtStamp(e.at),
    what: what(e),
    reason: e.reason,
  }));
}

export async function projectMap(): Promise<Map<string, string>> {
  const rows = await getDb().select({ id: projects.id, name: projects.name }).from(projects);
  return new Map(rows.map((r) => [r.id, r.name]));
}

export const dayOf = (ts: string) => istDay(ts);

export type TeamSearch = { team?: string; week?: string; person?: string };

// The team a team view shows: the person's first team, or ?team= for admins.
export async function loadTeam(sp: Promise<TeamSearch>) {
  const q = await sp;
  const person = await getPersonOrRedirect();
  const team = await pickTeam(person, q.team);
  return { person, team, q };
}

// Keeps ?team= when moving between tabs, so an admin stays on the team they chose.
export const teamQuery = (q: TeamSearch, extra: Record<string, string> = {}) => {
  const p = new URLSearchParams();
  if (q.team) p.set("team", q.team);
  for (const [k, v] of Object.entries(extra)) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : "";
};
