import { cookies } from "next/headers";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { asc, eq } from "drizzle-orm";
import { PERSON_COOKIE, getCurrentPerson } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { people, teamMembers, teams } from "@/lib/db/schema";
import { Section } from "@/components/ui/Section";

async function actAs(formData: FormData) {
  "use server";
  if (process.env.NODE_ENV === "production") return;
  const id = String(formData.get("person") ?? "").trim();
  const jar = await cookies();
  if (id) jar.set(PERSON_COOKIE, id, { path: "/", httpOnly: true, sameSite: "lax" });
  else jar.delete(PERSON_COOKIE);
  redirect("/me");
}

async function Picker() {
  const current = await getCurrentPerson();
  await connection();
  const db = getDb();
  const rows = await db
    .select({ id: people.id, name: people.displayName, team: teams.name, role: teamMembers.appRole })
    .from(people)
    .leftJoin(teamMembers, eq(teamMembers.personId, people.id))
    .leftJoin(teams, eq(teams.id, teamMembers.teamId))
    .orderBy(asc(people.displayName), asc(teams.name));
  const byPerson = new Map<string, { name: string; where: string[] }>();
  for (const r of rows) {
    const e = byPerson.get(r.id) ?? { name: r.name, where: [] };
    if (r.team) e.where.push(`${r.team}, ${r.role}`);
    byPerson.set(r.id, e);
  }
  return (
    <Section title="Act as" right={current ? `Now: ${current.name}` : "Nobody chosen"}>
      <p className="alt-meta mb-3">This list is for local use only. It stands in for sign-in.</p>
      <ul>
        {[...byPerson.entries()].map(([id, e]) => (
          <li key={id} className="alt-row dither-row flex items-baseline justify-between gap-4 py-3" style={{ borderBottom: "var(--rule-item)" }}>
            <span>
              <span className="font-medium">{e.name}</span>
              <span className="alt-meta ml-3">{e.where.join("; ") || "No team"}</span>
            </span>
            <form action={actAs}>
              <input type="hidden" name="person" value={id} />
              <button type="submit" className="alt-btn no-ring">
                {current?.id === id ? "Acting" : "Act as"}
              </button>
            </form>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export default function ActAsPage() {
  return (
    <Suspense fallback={null}>
      <Picker />
    </Suspense>
  );
}
