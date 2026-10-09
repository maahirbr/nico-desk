// FR-61. For each open task that is past its date, one draft asking the owner for a new date and a
// reason. It never changes a date: a date moves only when the owner or a lead renegotiates.
// Idempotent per lapse: a task gets one draft for each due date that passed, whatever happened to it.
import { and, asc, eq, lt, ne, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { todayIST } from "@/lib/db/dates";
import { people, sends, tasks } from "@/lib/db/schema";
import { buildRenegotiation } from "@/lib/sends/render";
import { sendId, type JobResult } from "./types";

export async function renegotiationDrafts(today: string = todayIST()): Promise<JobResult> {
  const db = getDb();
  const res: JobResult = { created: 0, skipped: 0, lines: [] };
  const overdue = await db
    .select({ t: tasks, owner: people.displayName })
    .from(tasks)
    .innerJoin(people, eq(people.id, tasks.ownerId))
    .where(and(eq(tasks.statusCategory, "open"), lt(tasks.dueOn, today), ne(tasks.origin, "sheet")))
    .orderBy(asc(tasks.dueOn), asc(tasks.id));
  for (const { t, owner } of overdue) {
    const [have] = await db
      .select({ id: sends.id })
      .from(sends)
      .where(and(eq(sends.kind, "renegotiation"), eq(sends.taskId, t.id), sql`${sends.bodySnapshot}->>'dueOn' = ${t.dueOn}`));
    if (have) {
      res.skipped++;
      continue;
    }
    await db.insert(sends).values({
      id: sendId(),
      kind: "renegotiation",
      teamId: t.teamId,
      subjectId: t.ownerId,
      taskId: t.id,
      triggeredBy: null,
      recipients: [t.ownerId],
      bodySnapshot: buildRenegotiation(t, owner, today),
      channel: "email",
      state: "draft",
      createdAt: new Date().toISOString(),
    });
    res.created++;
    res.lines.push(`${t.title}: draft for ${owner}`);
  }
  if (overdue.length === 0) res.lines.push("No open task is past its date.");
  return res;
}
