import { connection } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { people, teamMembers, teams } from "@/lib/db/schema";
import { actAsPath, isHosted } from "@/lib/hosted";
import { allowedSessionEmail } from "@/lib/supabase/server";

export const PERSON_COOKIE = "nd_person";

export type AppRole = "member" | "lead" | "admin";
export type Membership = { teamId: string; teamName: string; teamType: string; appRole: AppRole };
export type Person = {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  memberships: Membership[];
};

// Raised by requirePerson and requireLead. Actions turn it into a plain error string.
export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export async function loadPerson(id: string): Promise<Person | null> {
  const db = getDb();
  const [row] = await db.select().from(people).where(and(eq(people.id, id), eq(people.active, true)));
  if (!row) return null;
  const memberships = await db
    .select({ teamId: teams.id, teamName: teams.name, teamType: teams.teamType, appRole: teamMembers.appRole })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(eq(teamMembers.personId, id))
    .orderBy(asc(teams.id), asc(teamMembers.appRole));
  return {
    id: row.id,
    name: row.displayName,
    email: row.email,
    role: row.role,
    department: row.department,
    memberships,
  };
}

// Local: the dev "act as" cookie. Hosted: the same cookie, but only with a verified, allowed Supabase user,
// so the cookie alone is never enough. Callers keep this signature.
export async function getCurrentPerson(): Promise<Person | null> {
  const id = (await cookies()).get(PERSON_COOKIE)?.value;
  if (!id) return null;
  if (isHosted() && !(await allowedSessionEmail())) return null;
  await connection(); // the database clock is a request-time value, so never part of a prerender
  return loadPerson(id);
}

// For pages: send a visitor with no person to the picker.
export async function getPersonOrRedirect(): Promise<Person> {
  const person = await getCurrentPerson();
  if (!person) redirect(actAsPath());
  return person;
}

// For actions: read the cookie again on the server, never trust a form field.
export async function requirePerson(): Promise<Person> {
  const person = await getCurrentPerson();
  if (!person) throw new AuthError("Choose who you are acting as first.");
  return person;
}

export function isLeadOf(person: Person, teamId: string): boolean {
  return person.memberships.some((m) => m.teamId === teamId && m.appRole === "lead");
}

export function isAdmin(person: Person): boolean {
  return person.memberships.some((m) => m.appRole === "admin");
}

// Lead of any team, or admin: the people who see Record and land on Team.
export function isLeadOrAdmin(person: Person): boolean {
  return person.memberships.some((m) => m.appRole === "lead" || m.appRole === "admin");
}

export function isOnTeam(person: Person, teamId: string): boolean {
  return person.memberships.some((m) => m.teamId === teamId);
}

export async function requireLead(teamId: string): Promise<Person> {
  const person = await requirePerson();
  if (!isLeadOf(person, teamId)) throw new AuthError("Only a lead of this team can do this.");
  return person;
}

// The team a view shows: the person's first team. `?team=` overrides it for admins.
export async function pickTeam(person: Person, requested?: string): Promise<Membership | null> {
  if (requested && isAdmin(person)) {
    const own = person.memberships.find((m) => m.teamId === requested);
    if (own) return own;
    const [t] = await getDb().select().from(teams).where(eq(teams.id, requested));
    if (t) return { teamId: t.id, teamName: t.name, teamType: t.teamType, appRole: "admin" };
  }
  return person.memberships[0] ?? null;
}
