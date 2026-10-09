import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentPerson } from "@/lib/auth";

async function Route(): Promise<null> {
  redirect((await getCurrentPerson()) ? "/me" : "/dev/act-as");
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <Route />
    </Suspense>
  );
}
