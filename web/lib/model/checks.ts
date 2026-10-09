// Code checks on every draft, whichever model made it (FR-67). The model's own owner and date
// are never read: the owner is matched here and the date is derived here from the date words.
import { addDays, isIsoDate, istDay } from "@/lib/db/dates";
import type { CheckResult, CheckedDraft, DraftCandidate, RosterEntry } from "./types";

const MONTHS: Record<string, number> = {
  january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3, april: 4, apr: 4, may: 5, june: 6, jun: 6,
  july: 7, jul: 7, august: 8, aug: 8, september: 9, sep: 9, sept: 9, october: 10, oct: 10,
  november: 11, nov: 11, december: 12, dec: 12,
};
const MONTH_RE = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join("|");
const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

const pad = (n: number) => String(n).padStart(2, "0");

function validDay(y: number, m: number, d: number): string | null {
  const iso = `${y}-${pad(m)}-${pad(d)}`;
  return isIsoDate(iso) ? iso : null;
}

// "7 October", "7th of October" or "October 7". Year is the meeting year, or the next one when
// the date would fall more than 60 days before the meeting.
function explicitDate(text: string, heldDay: string): string | null {
  const lower = text.toLowerCase();
  const a = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MONTH_RE})\\b`).exec(lower);
  const b = new RegExp(`\\b(${MONTH_RE})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`).exec(lower);
  const hit = a && b ? (a.index <= b.index ? "a" : "b") : a ? "a" : b ? "b" : null;
  if (!hit) return null;
  const day = Number(hit === "a" ? a![1] : b![2]);
  const month = MONTHS[hit === "a" ? a![2] : b![1]];
  const year = Number(heldDay.slice(0, 4));
  let iso = validDay(year, month, day);
  if (iso && iso < addDays(heldDay, -60)) iso = validDay(year + 1, month, day);
  return iso;
}

function nextWeekday(heldDay: string, target: number): string {
  const dow = new Date(`${heldDay}T00:00:00Z`).getUTCDay();
  return addDays(heldDay, (target - dow + 7) % 7);
}

function splitSentences(body: string): string[] {
  return body.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
}

export type DueResult = { dueOn: string | "missing"; kind: "stated" | "inferred" | "missing"; detail: string };

// Rules are in evals/meetings/README.md. "Today" and "tomorrow" count from the meeting date.
// "By Friday" is the next Friday on or after it. "End of the month" is the last day.
// "Before X" is the day before X. A bare "the 13th" with no by/on/due is not a due date.
export function deriveDue(phrase: string | null, ctx: { heldAt: string; body: string; quote: string }): DueResult {
  const missing: DueResult = { dueOn: "missing", kind: "missing", detail: "no date words" };
  if (!phrase) return missing;
  const heldDay = istDay(ctx.heldAt);
  const text = phrase.toLowerCase();

  const before = new RegExp(`\\bbefore\\s+(?:the\\s+)?(\\d{1,2}(?:st|nd|rd|th)?\\s+(?:of\\s+)?(?:${MONTH_RE})|(?:${MONTH_RE})\\s+\\d)`).exec(text);
  if (before) {
    const d = explicitDate(before[1], heldDay);
    if (d) return { dueOn: addDays(d, -1), kind: "stated", detail: `day before ${d}` };
  }
  const explicit = explicitDate(text, heldDay);
  if (explicit) return { dueOn: explicit, kind: "stated", detail: "date as said" };

  const ord = /\b(?:by|on|due|until)\s+the\s+(\d{1,2})(?:st|nd|rd|th)\b/.exec(text);
  if (ord) {
    const day = Number(ord[1]);
    const [y, m, hd] = heldDay.split("-").map(Number);
    let iso = validDay(y, m, day);
    if (!iso || day < hd) {
      const nm = m === 12 ? 1 : m + 1;
      iso = validDay(m === 12 ? y + 1 : y, nm, day);
    }
    if (iso) return { dueOn: iso, kind: "stated", detail: "day of the month as said" };
  }

  if (/\btomorrow\b/.test(text)) return { dueOn: addDays(heldDay, 1), kind: "inferred", detail: "tomorrow, from the meeting date" };
  if (/\btoday\b/.test(text)) return { dueOn: heldDay, kind: "inferred", detail: "today, from the meeting date" };
  if (/\bend of (?:the |this )?month\b/.test(text)) {
    const [y, m] = heldDay.split("-").map(Number);
    const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    return { dueOn: last, kind: "inferred", detail: "last day of the meeting month" };
  }

  const ev = /\bbefore\s+(?:the\s+)?([a-z][a-z-]*)/.exec(text);
  if (ev) {
    const noun = ev[1];
    for (const s of splitSentences(ctx.body)) {
      if (s.includes(ctx.quote) || !s.toLowerCase().includes(noun)) continue;
      const d = explicitDate(s, heldDay);
      if (d) return { dueOn: addDays(d, -1), kind: "inferred", detail: `day before the ${noun} (${d})` };
    }
    return { dueOn: "missing", kind: "missing", detail: `no date found for the ${noun}` };
  }

  const wd = new RegExp(`\\b(${DAYS.join("|")})\\b`).exec(text);
  if (wd) {
    return { dueOn: nextWeekday(heldDay, DAYS.indexOf(wd[1])), kind: "inferred", detail: `next ${wd[1]} on or after the meeting date` };
  }
  return missing;
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();

// The roster name as said: a full name, or a first name that only one person has.
export function matchOwner(spoken: string | null, roster: RosterEntry[]): RosterEntry | null {
  if (!spoken) return null;
  const s = norm(spoken);
  if (!s) return null;
  const full = roster.filter((r) => norm(r.name) === s);
  if (full.length === 1) return full[0];
  if (full.length > 1) return null;
  if (!s.includes(" ")) {
    const first = roster.filter((r) => norm(r.name).split(" ")[0] === s);
    if (first.length === 1) return first[0];
  }
  return null;
}

const STOP = new Set(["the", "a", "an", "to", "of", "for", "on", "in", "and", "at", "with", "by", "from", "about", "all", "our", "new"]);
export const tokens = (title: string) => new Set(norm(title).split(" ").filter((w) => w.length > 1 && !STOP.has(w)));

// Dice overlap of the title words. No embeddings in v1.
export function titleSimilarity(a: string, b: string): number {
  const A = tokens(a);
  const B = tokens(b);
  if (A.size === 0 || B.size === 0) return 0;
  let shared = 0;
  for (const t of A) if (B.has(t)) shared++;
  if (shared < 2) return 0;
  return (2 * shared) / (A.size + B.size);
}

export const DUPLICATE_THRESHOLD = 0.6;

export type OpenTask = { id: string; title: string; ownerId: string };

export function findDuplicate(title: string, ownerId: string | "missing", open: OpenTask[]): { id: string; score: number } | null {
  const pool = ownerId === "missing" ? open : open.filter((t) => t.ownerId === ownerId);
  let best: { id: string; score: number } | null = null;
  for (const t of pool) {
    const score = titleSimilarity(title, t.title);
    if (score >= DUPLICATE_THRESHOLD && (!best || score > best.score)) best = { id: t.id, score };
  }
  return best;
}

export function runChecks(
  c: DraftCandidate,
  ctx: { body: string; heldAt: string; roster: RosterEntry[]; openTasks: OpenTask[] },
): CheckedDraft {
  const checks: CheckResult[] = [];

  const quoteValid = c.quote.length > 0 && ctx.body.includes(c.quote);
  checks.push({
    name: "quote_in_note",
    pass: quoteValid,
    detail: quoteValid ? "the quote is an exact part of the note" : "the quote is not in the note",
  });

  const owner = matchOwner(c.spokenOwner, ctx.roster);
  const ownerId = owner ? owner.id : "missing";
  checks.push({
    name: "owner_matched",
    pass: !!owner,
    detail: owner ? `matched to ${owner.name}` : c.spokenOwner ? `"${c.spokenOwner}" is not one person on the roster` : "no owner named",
  });

  const due = deriveDue(c.duePhrase, { heldAt: ctx.heldAt, body: ctx.body, quote: c.quote });
  checks.push({ name: "due_derived", pass: due.dueOn !== "missing", detail: due.detail });

  const dup = findDuplicate(c.title, ownerId, ctx.openTasks);
  checks.push({
    name: "no_duplicate",
    pass: !dup,
    detail: dup ? `possible duplicate of ${dup.id} (score ${dup.score.toFixed(2)})` : "no similar open task",
  });

  return { ...c, ownerId, dueOn: due.dueOn, dueKind: due.kind, quoteValid, duplicateOf: dup?.id ?? null, checks };
}
