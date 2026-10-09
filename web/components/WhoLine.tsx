// The top line: the current person and the team they are viewing. Reads the cookie, so it sits in Suspense.
import Link from "next/link";
import { getCurrentPerson, pickTeam } from "@/lib/auth";

export async function WhoLine({ short = false }: { short?: boolean }) {
  const person = await getCurrentPerson();
  if (!person) {
    return (
      <Link href="/dev/act-as" className="caps act">
        {short ? "Who are you" : "Choose who you are"}
      </Link>
    );
  }
  const team = await pickTeam(person);
  if (short) {
    return (
      <Link href="/dev/act-as" className="caps act nav-who" title="Change who you are acting as">
        {person.name.split(" ")[0]}
      </Link>
    );
  }
  return (
    <Link href="/dev/act-as" className="caps act" title="Change who you are acting as">
      {person.name}
      {team ? `, ${team.teamName}` : ""}
    </Link>
  );
}
