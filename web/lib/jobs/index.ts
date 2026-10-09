import { atRisk } from "./at-risk";
import { mondayDigest } from "./monday-digest";
import { overdueWeekly } from "./overdue-weekly";
import { renegotiationDrafts } from "./renegotiation-drafts";

export { atRisk, mondayDigest, overdueWeekly, renegotiationDrafts };

export const JOBS = {
  overdueWeekly: { run: overdueWeekly, title: "Friday overdue message", note: "One draft per team for a lead to approve. Never sends." },
  mondayDigest: { run: mondayDigest, title: "Monday digest", note: "One digest per opted-in person, approved by their opt-in. Still waits for send." },
  renegotiationDrafts: { run: renegotiationDrafts, title: "Date request drafts", note: "One draft per overdue task for its owner to approve. Never moves a date." },
  atRisk: { run: atRisk, title: "At risk notices", note: "In-app notices for tasks quiet for 10 days that are due soon." },
} as const;

export type JobName = keyof typeof JOBS;
