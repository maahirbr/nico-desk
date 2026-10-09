// FR-52. One Friday overdue message per team per week, in state draft. A lead approves it and
// presses send. The job never approves or sends. A team with no lead gets none: nobody could approve it.
import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { mondayOf, todayIST } from "@/lib/db/dates";
import { people, sends, teamMembers, teams } from "@/lib/db/schema";
import { buildOverdueWeekly } from "@/lib/sends/render";
import { sendId, type JobResult } from "./types";

export async function overdueWeekly(today: string = todayIST()): Promise<JobResult> {
  const db = getDb();
  const monday = mondayOf(today);
  const res: JobResult = { created: 0, skipped: 0, lines: [] };
  for (const team of await db.select().from(teams).orderBy(asc(teams.id))) {
    const members = await db
      .selectDistinct({ id: people.id, role: teamMembers.appRole })
      .from(teamMembers)
      .innerJoin(people, eq(people.id, teamMembers.personId))
      .where(and(eq(teamMembers.teamId, team.id), eq(people.active, true)));
    if (!members.some((m) => m.role === "lead")) {
      res.skipped++;
      res.lines.push(`${team.name}: no lead to approve it, skipped`);
      continue;
    }
    const [have] = await db
      .select({ id: sends.id })
      .from(sends)
      .where(and(eq(sends.kind, "overdue_weekly"), eq(sends.teamId, team.id), sql`${sends.bodySnapshot}->>'weekOf' = ${monday}`));
    if (have) {
      res.skipped++;
      res.lines.push(`${team.name}: already has the message for the week of ${monday}`);
      continue;
    }
    const body = await buildOverdueWeekly(team.id, today);
    if (!body) {
      res.skipped++;
      res.lines.push(`${team.name}: nothing overdue, no message`);
      continue;
    }
    await db.insert(sends).values({
      id: sendId(),
      kind: "overdue_weekly",
      teamId: team.id,
      subjectId: null,
      taskId: null,
      triggeredBy: null,
      recipients: [...new Set(members.map((m) => m.id))].sort(),
      bodySnapshot: body,
      channel: "email",
      state: "draft",
      createdAt: new Date().toISOString(),
    });
    res.created++;
    res.lines.push(`${team.name}: draft made for a lead to approve`);
  }
  return res;
}
