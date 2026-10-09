// Pure replay of the event log. No database. Used by `npm run replay` and by the seed.
// Rules (they mirror what mutations.ts writes):
//  - _created: the row is `after`. created_at, created_by and origin fall back to the event.
//  - any other field: row[field] = after. _update and _reopened change no field.
//  - priority also sets priority_set_by and priority_set_at from the event.
//  - blocked_on_id also sets blocked_at (the event time, or null when cleared).
//  - projects: status_at is the time of their latest event.
export type Row = Record<string, unknown>;
export type EventLike = {
  id: string;
  entity_type: "task" | "project";
  entity_id: string;
  field: string;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
  actor_id?: string | null;
  origin: string;
  at: string;
};

// Fields that are derived by the database and not compared.
const IGNORED = new Set(["search_tsv", "updated_at", "version"]);
const NO_FIELD_CHANGE = new Set(["_update", "_reopened"]);

function applyTask(row: Row | undefined, e: EventLike): Row {
  if (e.field === "_created") {
    return {
      created_at: e.at,
      created_by: e.actor_id ?? null,
      origin: e.origin,
      ...(e.after as Row),
      id: e.entity_id,
    };
  }
  if (!row) throw new Error(`event ${e.id}: task ${e.entity_id} has no _created event before it`);
  if (NO_FIELD_CHANGE.has(e.field)) return row;
  const next: Row = { ...row, [e.field]: e.after ?? null };
  if (e.field === "priority") {
    next.priority_set_by = e.after == null ? null : (e.actor_id ?? null);
    next.priority_set_at = e.after == null ? null : e.at;
  }
  if (e.field === "blocked_on_id") next.blocked_at = e.after == null ? null : e.at;
  return next;
}

function applyProject(row: Row | undefined, e: EventLike): Row {
  if (e.field === "_created") return { ...(e.after as Row), id: e.entity_id, status_at: e.at };
  if (!row) throw new Error(`event ${e.id}: project ${e.entity_id} has no _created event before it`);
  if (NO_FIELD_CHANGE.has(e.field)) return row;
  return { ...row, [e.field]: e.after ?? null, status_at: e.at };
}

export function replayEvents(all: EventLike[]): { tasks: Map<string, Row>; projects: Map<string, Row> } {
  const ordered = all.map((e, i) => ({ e, i })).sort((a, b) => a.e.at.localeCompare(b.e.at) || a.i - b.i);
  const out = { tasks: new Map<string, Row>(), projects: new Map<string, Row>() };
  for (const { e } of ordered) {
    const bucket = e.entity_type === "task" ? out.tasks : out.projects;
    const apply = e.entity_type === "task" ? applyTask : applyProject;
    bucket.set(e.entity_id, apply(bucket.get(e.entity_id), e));
  }
  return out;
}

// Timestamps compare by instant, so "…Z" and "…+00:00" are equal. Missing and null are equal.
function norm(v: unknown): unknown {
  if (v === undefined) return null;
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v) && !Number.isNaN(Date.parse(v))) {
    return new Date(v).toISOString();
  }
  return v;
}

function diffRow(label: string, expected: Row, got: Row | undefined): string[] {
  if (!got) return [`${label}: missing from replay`];
  const keys = new Set([...Object.keys(expected), ...Object.keys(got)].filter((k) => !IGNORED.has(k)));
  const lines: string[] = [];
  for (const k of [...keys].sort()) {
    const a = JSON.stringify(norm(expected[k]));
    const b = JSON.stringify(norm(got[k]));
    if (a !== b) lines.push(`${label}.${k}: file has ${a}, replay gives ${b}`);
  }
  return lines;
}

function diffTable(name: string, expected: Row[], got: Map<string, Row>): string[] {
  const lines = expected.flatMap((r) => diffRow(`${name}.${String(r.id)}`, r, got.get(String(r.id))));
  const known = new Set(expected.map((r) => String(r.id)));
  for (const id of got.keys()) if (!known.has(id)) lines.push(`${name}.${id}: in replay, not in file`);
  return lines;
}

// Returns a list of differences. An empty list means the replay matches.
export function checkReplay(evs: EventLike[], taskRows: Row[], projectRows: Row[]): string[] {
  const r = replayEvents(evs);
  return [...diffTable("tasks", taskRows, r.tasks), ...diffTable("projects", projectRows, r.projects)];
}
