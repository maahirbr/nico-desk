// Builds the body of a send from the same task rows the views use, and prints it as plain text.
// A snapshot is stored in sends.body_snapshot, so what the person approves is what goes out.
// No note text and no model text is in any send: every date and name comes from task rows and events.
import { and, asc, eq, gte, lt, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { addDays, mondayOf } from "@/lib/db/dates";
import { events, people, tasks } from "@/lib/db/schema";
import { daysBetween, fmtDay } from "@/lib/format";

export type SnapRow = {
  taskId: string;
  title: string;
  ownerName: string;
  dueOn: string;
  firstDueOn: string;
  detail: string | null;
};
export type Snapshot = {
  subject: string;
  covering: string;
  weekOf: string | null; // Monday of the week this send is for. Makes the jobs idempotent.
  dueOn: string | null; // renegotiation only: the date that lapsed. Makes that job idempotent.
  sections: { heading: string; rows: SnapRow[] }[];
};

type TaskRec = typeof tasks.$inferSelect;
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

async function names(): Promise<Map<string, string>> {
  const rows = await getDb().select({ id: people.id, n: people.displayName }).from(people);
  return new Map(rows.map((r) => [r.id, r.n]));
}

function toRow(t: TaskRec, who: Map<string, string>, today: string): SnapRow {
  const late = t.dueOn < today ? `late by ${plural(daysBetween(t.firstDueOn, today), "day")} from the first date` : null;
  const parts = [late, t.blockedOnId ? `blocked on ${who.get(t.blockedOnId) ?? t.blockedOnId}` : null].filter(Boolean);
  return {
    taskId: t.id,
    title: t.title,
    ownerName: who.get(t.ownerId) ?? t.ownerId,
    dueOn: t.dueOn,
    firstDueOn: t.firstDueOn,
    detail: parts.length ? parts.join(", ") : null,
  };
}

export async function buildDigest(personId: string, today: string): Promise<Snapshot> {
  const who = await names();
  const open = await getDb()
    .select()
    .from(tasks)
    .where(and(eq(tasks.ownerId, personId), eq(tasks.statusCategory, "open")))
    .orderBy(asc(tasks.dueOn), asc(tasks.id));
  const monday = mondayOf(today);
  const sunday = addDays(monday, 6);
  const buckets: Record<string, SnapRow[]> = { Overdue: [], "Due this week": [], Blocked: [], "The rest": [] };
  for (const t of open) {
    const key = t.dueOn < today ? "Overdue" : t.dueOn <= sunday ? "Due this week" : t.blockedOnId ? "Blocked" : "The rest";
    buckets[key].push(toRow(t, who, today));
  }
  // A blocked task that is also overdue or due this week stays in the first section it fits.
  return {
    subject: `Your week from ${fmtDay(monday)}`,
    covering: open.length === 0 ? "You have no open tasks." : `You have ${plural(open.length, "open task")}.`,
    weekOf: monday,
    dueOn: null,
    sections: Object.entries(buckets).filter(([, rows]) => rows.length).map(([heading, rows]) => ({ heading, rows })),
  };
}

// FR-52: every person's overdue tasks, and the dates that moved after they had passed.
export async function buildOverdueWeekly(teamId: string, today: string): Promise<Snapshot | null> {
  const db = getDb();
  const who = await names();
  const overdue = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.teamId, teamId), eq(tasks.statusCategory, "open"), lt(tasks.dueOn, today)))
    .orderBy(asc(tasks.ownerId), asc(tasks.dueOn), asc(tasks.id));
  const since = addDays(today, -7);
  const lateMoves = await db
    .select({ t: tasks, before: events.before, at: events.at })
    .from(events)
    .innerJoin(tasks, and(eq(tasks.id, events.entityId), eq(events.entityType, "task")))
    .where(
      and(
        eq(tasks.teamId, teamId),
        eq(events.field, "due_on"),
        gte(events.at, `${since}T00:00:00+05:30`),
        sql`(${events.before} #>> '{}')::date < (${events.at} AT TIME ZONE 'Asia/Kolkata')::date`,
      ),
    )
    .orderBy(asc(events.at));
  if (overdue.length === 0 && lateMoves.length === 0) return null;
  const monday = mondayOf(today);
  const sections: Snapshot["sections"] = [];
  if (overdue.length) sections.push({ heading: "Overdue and slipping silently", rows: overdue.map((t) => toRow(t, who, today)) });
  if (lateMoves.length) {
    sections.push({
      heading: "Dates moved after they had passed, last 7 days",
      rows: lateMoves.map((m) => ({ ...toRow(m.t, who, today), detail: `moved from ${fmtDay(String(m.before))} to ${fmtDay(m.t.dueOn)}` })),
    });
  }
  return {
    subject: `Overdue on the team, week of ${fmtDay(monday)}`,
    covering: `${plural(overdue.length, "task")} overdue. Each person is named under their own tasks.`,
    weekOf: monday,
    dueOn: null,
    sections,
  };
}

// FR-61: asks the owner for a new date and a reason. It never moves a date.
export function buildRenegotiation(t: TaskRec, ownerName: string, today: string): Snapshot {
  const days = daysBetween(t.dueOn, today);
  return {
    subject: `New date needed: ${t.title}`,
    covering: `"${t.title}" was due ${fmtDay(t.dueOn)} and is open ${plural(days, "day")} later. First date given: ${fmtDay(t.firstDueOn)}. Please give a new date and a short reason in the app. The date does not change until you do.`,
    weekOf: null,
    dueOn: t.dueOn,
    sections: [{ heading: "The task", rows: [{ taskId: t.id, title: t.title, ownerName, dueOn: t.dueOn, firstDueOn: t.firstDueOn, detail: null }] }],
  };
}

export function renderText(s: Snapshot): string {
  const lines = [s.subject, "", s.covering];
  for (const sec of s.sections) {
    lines.push("", sec.heading);
    for (const r of sec.rows) {
      lines.push(`- ${r.title} (${r.ownerName}), due ${fmtDay(r.dueOn)}, first given ${fmtDay(r.firstDueOn)}${r.detail ? `, ${r.detail}` : ""}`);
    }
  }
  return lines.join("\n");
}

export function asSnapshot(v: unknown): Snapshot {
  return v as Snapshot;
}


