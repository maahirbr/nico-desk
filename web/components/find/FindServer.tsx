// The FIND field with the team roster for names. The roster reads the cookie, so it loads as a promise: the field is
// part of the page shell and is there to type in at once, and the roster is read inside it when it arrives.
import { connection } from "next/server";
import { getCurrentPerson, pickTeam } from "@/lib/auth";
import { todayIST } from "@/lib/db/dates";
import { roster } from "@/lib/views";
import { FindBox, type FindData } from "./FindBox";

async function loadFind(): Promise<FindData> {
  await connection();
  try {
    const person = await getCurrentPerson();
    const team = person ? await pickTeam(person) : null;
    const names = team ? (await roster(team.teamId)).map((p) => ({ id: p.id, name: p.displayName })) : [];
    return { roster: names, teamId: team?.teamId ?? null, today: todayIST() };
  } catch {
    return { roster: [], teamId: null, today: "" };
  }
}

export function FindServer() {
  return <FindBox data={loadFind()} />;
}
