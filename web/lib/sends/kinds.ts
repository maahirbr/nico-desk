// The four kinds of send and who approves each one (FR-57). One approver rule, used by the
// page (to show buttons) and by the actions (to refuse everyone else). Not a UI check.
import { isLeadOf, type Person } from "@/lib/auth";

export type SendKind = "monday_digest" | "overdue_weekly" | "blocked_ask" | "renegotiation";

export const KIND_WORD: Record<SendKind, string> = {
  monday_digest: "Monday digest",
  overdue_weekly: "Friday overdue message",
  blocked_ask: "Blocked ask",
  renegotiation: "Date request",
};

export const APPROVER_WORD: Record<SendKind, string> = {
  monday_digest: "the person it is about",
  overdue_weekly: "a lead of the team",
  blocked_ask: "the task owner",
  renegotiation: "the task owner",
};

export type SendFacts = { kind: SendKind; teamId: string; subjectId: string | null; taskOwnerId: string | null };

export function mayAct(person: Person, s: SendFacts): boolean {
  switch (s.kind) {
    case "monday_digest":
      return s.subjectId === person.id;
    case "overdue_weekly":
      return isLeadOf(person, s.teamId);
    case "blocked_ask":
    case "renegotiation":
      return s.taskOwnerId === person.id;
  }
}

export const STATE_WORD: Record<string, string> = {
  draft: "Draft",
  approved: "Approved",
  sent: "Sent",
  failed: "Failed",
  discarded: "Discarded",
};
