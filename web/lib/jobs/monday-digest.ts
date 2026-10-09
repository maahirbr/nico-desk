// FR-51, FR-59. One digest per opted-in person per week, written as approved by that person's
// own opt-in (FR-56). Nobody else gets one. The send still waits for the person to press send.
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { mondayOf, todayIST } from "@/lib/db/dates";
import { emailOptins, people, sends, teamMembers } from "@/lib/db/schema";
import { buildDigest } from "@/lib/sends/render";
import { sendId, type JobResult } from "./types";

export async function mondayDigest(today: string = todayIST()): Promise<JobResult> {
  const db = getDb();
  const monday = mondayOf(today);
  const res: JobResult = { created: 0, skipped: 0, lines: [] };
  const opted = await db
    .select({ id: people.id, name: people.displayName })
    .from(emailOptins)
    .innerJoin(people, eq(people.id, emailOptins.personId))
    .where(and(eq(emailOptins.kind, "monday_digest"), isNull(emailOptins.optedOutAt), eq(people.active, true)))
    .orderBy(asc(people.id));
  for (const p of opted) {
    const [team] = await db
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(eq(teamMembers.personId, p.id))
      .orderBy(asc(teamMembers.teamId))
      .limit(1);
    if (!team) {
      res.skipped++;
      res.lines.push(`${p.name}: not on a team, skipped`);
      continue;
    }
    const [have] = await db
      .select({ id: sends.id })
      .from(sends)
      .where(and(eq(sends.kind, "monday_digest"), eq(sends.subjectId, p.id), sql`${sends.bodySnapshot}->>'weekOf' = ${monday}`));
    if (have) {
      res.skipped++;
      res.lines.push(`${p.name}: already has the digest for the week of ${monday}`);
      continue;
    }
    const body = await buildDigest(p.id, today);
    const now = new Date().toISOString();
    await db.insert(sends).values({
      id: sendId(),
      kind: "monday_digest",
      teamId: team.teamId,
      subjectId: p.id,
      taskId: null,
      triggeredBy: null,
      recipients: [p.id],
      bodySnapshot: body,
      channel: "email",
      state: "approved",
      approvedBy: p.id, // the standing opt-in is the approval
      approvedAt: now,
      createdAt: now,
    });
    res.created++;
    res.lines.push(`${p.name}: digest made, approved by their opt-in`);
  }
  if (opted.length === 0) res.lines.push("Nobody has opted in.");
  return res;
}
