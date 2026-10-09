// Display helpers. Every day is an Asia/Kolkata day written as YYYY-MM-DD (see lib/db/dates.ts).
import { addDays } from "@/lib/db/dates";

const DAY = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  weekday: "short",
  day: "numeric",
  month: "short",
});
const STAMP = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata",
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

// "Mon 6 Oct" from a plain ISO day.
export function fmtDay(iso: string): string {
  return DAY.format(new Date(`${iso}T00:00:00Z`)).replace(",", "").replace("Sept", "Sep");
}

// "Mon 6 Oct, 14:05" from a timestamp, in Asia/Kolkata.
export function fmtStamp(ts: string): string {
  return STAMP.format(new Date(ts)).replace(",", "").replace(/(\d{2}:\d{2})$/, ", $1");
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000);
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

// "today", "tomorrow", "yesterday", "in 3 days", "3 days ago".
export function relDays(iso: string, today: string): string {
  const n = daysBetween(today, iso);
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  return n > 0 ? `in ${plural(n, "day")}` : `${plural(-n, "day")} ago`;
}

// "late by 3 days", measured from the date first given to today.
export function lateBy(firstDueOn: string, today: string): string | null {
  const n = daysBetween(firstDueOn, today);
  return n > 0 ? `late by ${plural(n, "day")}` : null;
}

export type OutcomeKey = "ahead" | "on_time" | "late";
const OUTCOME_WORD: Record<OutcomeKey, string> = { ahead: "ahead", on_time: "on time", late: "late" };

// The outcome word, judged against the date first given (rule C1).
export function outcomeWord(o: OutcomeKey): string {
  return OUTCOME_WORD[o];
}

export function outcomeOf(closedOn: string, firstDueOn: string): OutcomeKey {
  return closedOn < firstDueOn ? "ahead" : closedOn === firstDueOn ? "on_time" : "late";
}

export const HEALTH_WORD: Record<string, string> = {
  not_started: "Not started",
  off_track: "Off track",
  on_track: "On track",
  ahead: "Ahead",
};

export const PRIORITY_WORD: Record<string, string> = { high: "High", normal: "Normal", low: "Low" };

// "Due Fri 26 Sep (first given Tue 23 Sep, moved once)" for FR-19.
export function dateLine(dueOn: string, firstDueOn: string, moves: number): string {
  if (moves === 0 && dueOn === firstDueOn) return `Due ${fmtDay(dueOn)}`;
  const moved = moves === 0 ? "date changed" : moves === 1 ? "moved once" : `moved ${moves} times`;
  return `Due ${fmtDay(dueOn)} (first given ${fmtDay(firstDueOn)}, ${moved})`;
}

export function weekLabel(mondayIso: string): string {
  return `${fmtDay(mondayIso)} to ${fmtDay(addDays(mondayIso, 6))}`;
}
