import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentPerson, isLeadOrAdmin } from "@/lib/auth";
import { actAsPath } from "@/lib/hosted";

// A member lands on their week, a lead or admin on the team.
async function Route(): Promise<null> {
  const person = await getCurrentPerson();
  redirect(!person ? actAsPath() : isLeadOrAdmin(person) ? "/team" : "/week");
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <Route />
    </Suspense>
  );
}
