"use server";
// Runs one job by name. Localhost only: a production build refuses. Each job is idempotent, so a
// second press on the same day makes nothing new.
import { revalidatePath } from "next/cache";
import { JOBS, type JobName } from "@/lib/jobs";
import { plainError } from "@/lib/model/errors";
import type { ActionResult } from "@/components/ui/ActionForm";

export async function runJobAction(_p: ActionResult, d: FormData): Promise<ActionResult> {
  try {
    if (process.env.NODE_ENV === "production") return { error: "Jobs run from this page on localhost only." };
    const name = String(d.get("job") ?? "") as JobName;
    if (!Object.hasOwn(JOBS, name)) return { error: "Unknown job." };
    const r = await JOBS[name].run();
    revalidatePath("/dev/jobs");
    revalidatePath("/sends");
    const head = `${JOBS[name].title}: ${r.created} made, ${r.skipped} skipped.`;
    return { ok: [head, ...r.lines.slice(0, 12)].join(" ") };
  } catch (e) {
    return { error: plainError(e) };
  }
}
