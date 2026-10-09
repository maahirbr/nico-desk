import { cookies } from "next/headers";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { asc, eq } from "drizzle-orm";
import { PERSON_COOKIE, getCurrentPerson, loadPerson } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { people, teamMembers, teams } from "@/lib/db/schema";
import { isHosted } from "@/lib/hosted";
import { allowedSessionEmail, createClient } from "@/lib/supabase/server";
import styles from "./act-as.module.css";

// The data is synthetic, so a signed-in person picks which fixture person to act as.
async function actAs(formData: FormData) {
  "use server";
  if (!isHosted() || !(await allowedSessionEmail())) redirect("/sign-in");
  const id = String(formData.get("person") ?? "").trim();
  // Only a real, active person id is accepted, never the raw form value.
  if (!id || !(await loadPerson(id))) redirect("/act-as");
  (await cookies()).set(PERSON_COOKIE, id, { path: "/", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  redirect("/");
}

async function signOut() {
  "use server";
  if (isHosted()) await (await createClient()).auth.signOut();
  (await cookies()).delete(PERSON_COOKIE);
  redirect("/sign-in");
}

async function Picker() {
  if (!isHosted()) redirect("/dev/act-as");
  const email = await allowedSessionEmail();
  if (!email) redirect("/sign-in");
  const current = await getCurrentPerson();
  await connection();
  const rows = await getDb()
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
    <section className={styles.page}>
      <div className={styles.head}>
        <h1 className={styles.title}>Act as</h1>
        <form action={signOut}>
          <button type="submit" className={styles.quiet}>
            Sign out
          </button>
        </form>
      </div>
      <p className={styles.meta}>Signed in as {email}. The data here is synthetic, so choose who to act as.</p>
      <ul className={styles.list}>
        {[...byPerson.entries()].map(([id, e]) => (
          <li key={id} className={styles.row}>
            <span>
              <span className={styles.name}>{e.name}</span>
              <span className={styles.where}>{e.where.join("; ") || "No team"}</span>
            </span>
            <form action={actAs}>
              <input type="hidden" name="person" value={id} />
              <button type="submit" className={styles.pick}>
                {current?.id === id ? "Acting" : "Act as"}
              </button>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function ActAsPage() {
  return (
    <Suspense fallback={null}>
      <Picker />
    </Suspense>
  );
}
