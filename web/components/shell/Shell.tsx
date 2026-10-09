import { Suspense } from "react";
import { getCurrentPerson, isLeadOrAdmin } from "@/lib/auth";
import { TopBar } from "./TopBar";

// Reads the cookie, so it sits in Suspense. The fallback is the bare bar, so the page does not jump.
async function Bar() {
  const person = await getCurrentPerson();
  return <TopBar viewer={person ? { name: person.name, canRecord: isLeadOrAdmin(person) } : null} />;
}

export function Shell() {
  return (
    <Suspense fallback={<TopBar />}>
      <Bar />
    </Suspense>
  );
}
