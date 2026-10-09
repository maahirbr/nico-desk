// FR-77, first rule: an open task with no event in 10 days is at risk. The flag itself is derived
// on read and never stored. This job only turns it into an in-app notice for the owner, when the
// task is also due soon. The notice kinds have no "at_risk", so the kind says when it is due:
// overdue, due_today or due_tomorrow. A stale task due later is listed here and gets no notice.
// Idempotent through the notices unique key (person, task, kind, day).
import { and, asc, eq, lte, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { addDays, todayIST } from "@/lib/db/dates";
import { notices, tasks } from "@/lib/db/schema";
import { type JobResult } from "./types";

export const STALE_DAYS = 10;

export async function atRisk(today: string = todayIST()): Promise<JobResult> {
  const db = getDb();
  const res: JobResult = { created: 0, skipped: 0, lines: [] };
  const cutoff = `${addDays(today, -STALE_DAYS)}T00:00:00+05:30`;
  const open = await db
    .select({ t: tasks, last: sql<string | null>`(SELECT max(e.at) FROM events e WHERE e.entity_type = 'task' AND e.entity_id = ${tasks.id})` })
    .from(tasks)
    .where(and(eq(tasks.statusCategory, "open"), lte(tasks.createdAt, cutoff)))
    .orderBy(asc(tasks.dueOn), asc(tasks.id));
  const stale = open.filter((r) => !r.last || new Date(r.last).getTime() <= new Date(cutoff).getTime());
  for (const { t } of stale) {
    const kind = t.dueOn < today ? "overdue" : t.dueOn === today ? "due_today" : t.dueOn === addDays(today, 1) ? "due_tomorrow" : null;
    if (!kind) {
      res.skipped++;
      res.lines.push(`${t.title}: at risk, due ${t.dueOn}, no notice kind fits`);
      continue;
    }
    const made = await db
      .insert(notices)
      .values({ id: `ntc_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36)}`, personId: t.ownerId, taskId: t.id, kind, forDate: today, createdAt: new Date().toISOString() })
      .onConflictDoNothing()
      .returning({ id: notices.id });
    if (made.length) {
      res.created++;
      res.lines.push(`${t.title}: notice ${kind}`);
    } else {
      res.skipped++;
    }
  }
  if (stale.length === 0) res.lines.push(`No open task has been quiet for ${STALE_DAYS} days.`);
  return res;
}
