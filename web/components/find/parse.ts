// What the FIND field understood. Pure and deterministic: no model, no database. It reads the team roster
// for names (first name or full name, any case) and today's date for days. The field shows the result in
// words before return, so the person can see what return will do.
import { addDays } from "@/lib/db/dates";
import { fmtLong } from "@/components/week/lines";

export type RosterName = { id: string; name: string };
export type AskKind = "late" | "waiting" | "owed" | "owes" | "week";

export type Parsed =
  | { kind: "empty" }
  | { kind: "find"; q: string; line: string }
  | { kind: "ask"; ask: AskKind; personId: string; line: string }
  | { kind: "nobody"; line: string }
  | { kind: "commit"; ownerId: string; ownerName: string; what: string; dueOn: string | null; pastDay: string | null; verb: boolean; line: string; used: number; rest: string };

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

const dowOf = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay();

// The first day on or after `from` that is this weekday. A weekday that is today means today.
export function nextWeekday(from: string, dow: number): string {
  return addDays(from, (dow - dowOf(from) + 7) % 7);
}

// "fri", "friday" and "tues" all count. Three letters at least.
const weekdayIndex = (w: string): number => {
  const k = w.toLowerCase();
  return k.length < 3 ? -1 : DAYS.findIndex((d) => d.startsWith(k));
};
const monthIndex = (w: string): number => {
  const k = w.toLowerCase().replace(/\.$/, "");
  return k.length < 3 ? -1 : MONTHS.findIndex((m) => k.startsWith(m));
};
const pad = (n: number) => String(n).padStart(2, "0");
const real = (y: number, m: number, d: number): string | null => {
  const iso = `${y}-${pad(m + 1)}-${pad(d)}`;
  const t = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(t.getTime()) && t.getUTCMonth() === m && t.getUTCDate() === d ? iso : null;
};

export type Day = { iso: string; past: boolean } | null;

// A day as people write it: today, tomorrow, a weekday, "14 Oct", "Oct 14", "Friday 9 Oct", or 2026-10-14.
export function parseDay(text: string, today: string): Day {
  const s = text.trim().toLowerCase().replace(/[.,]+$/, "").replace(/\s+/g, " ");
  if (!s) return null;
  if (s === "today") return { iso: today, past: false };
  if (s === "tomorrow") return { iso: addDays(today, 1), past: false };
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (iso) {
    const d = real(+iso[1], +iso[2] - 1, +iso[3]);
    return d ? { iso: d, past: d < today } : null;
  }
  // "Friday 9 Oct" and "Fri 9 Oct": the date wins, the weekday is only a word.
  const lead = /^([a-z]{3,9})\.? (.+)$/.exec(s);
  const body = lead && weekdayIndex(lead[1]) >= 0 && /\d/.test(lead[2]) ? lead[2] : s;
  const dm = /^(\d{1,2})(?:st|nd|rd|th)? ([a-z]{3,9})\.?(?: (\d{4}))?$/.exec(body);
  const md = /^([a-z]{3,9})\.? (\d{1,2})(?:st|nd|rd|th)?(?:,? (\d{4}))?$/.exec(body);
  const hit = dm ? { d: +dm[1], m: monthIndex(dm[2]), y: dm[3] } : md ? { d: +md[2], m: monthIndex(md[1]), y: md[3] } : null;
  if (hit && hit.m >= 0) {
    const found = real(hit.y ? +hit.y : +today.slice(0, 4), hit.m, hit.d);
    return found ? { iso: found, past: found < today } : null;
  }
  const w = weekdayIndex(s);
  return w >= 0 ? { iso: nextWeekday(today, w), past: false } : null;
}

// "Orrin Vale" or "Orrin": first name or full name, any case. A short unique start of a name also counts, so the
// understood line is right while the person is still typing. Two people with one first name match nobody.
export function matchName(text: string, roster: RosterName[]): RosterName | null {
  const k = text.trim().toLowerCase().replace(/\s+/g, " ");
  if (!k) return null;
  const firstOf = (p: RosterName) => p.name.toLowerCase().split(" ")[0];
  const exact = roster.filter((p) => p.name.toLowerCase() === k || firstOf(p) === k);
  if (exact.length > 0) return exact.length === 1 ? exact[0] : null;
  if (k.length < 2) return null;
  const start = roster.filter((p) => p.name.toLowerCase().startsWith(k) || firstOf(p).startsWith(k));
  return start.length === 1 ? start[0] : null;
}

const ASKS: { re: RegExp; ask: AskKind }[] = [
  { re: /^(?:what(?:'s| is)? )?late (?:for|on) (.+)$/i, ask: "late" },
  { re: /^(?:what(?:'s| is)? )?(?:is )?waiting on (.+)$/i, ask: "waiting" },
  { re: /^(?:what(?:'s| is)? )?owed to (.+)$/i, ask: "owed" },
  { re: /^what does (.+?) owe$/i, ask: "owes" },
  { re: /^(?:what(?:'s| is)? )?this week for (.+)$/i, ask: "week" },
];

const ASK_WORDS: Record<AskKind, (n: string) => string> = {
  late: (n) => `late lines for ${n}`,
  waiting: (n) => `lines waiting on ${n}`,
  owed: (n) => `what is owed to ${n}`,
  owes: (n) => `what ${n} owes`,
  week: (n) => `this week for ${n}`,
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Common verbs a commitment starts with. A line whose first word is one of these needs no "will" from us.
// Anything else is left alone: FIND never invents a verb for the person.
const VERBS = new Set(
  `add adjust agree align approve arrange ask audit book brief build call chase check clean close collect compile complete confirm contact copy create decide deliver design determine draft email file finalise finalize finish fix follow forward gather get give handle hire host invite launch list log make merge move name note onboard order organise organize pack pay pick pitch plan post prepare present print publish pull push put raise read record refresh release remove reply report request research resolve review revise run schedule send set share shoot sign sort source start submit sync take talk test track translate update upload validate verify walk write`.split(" "),
);
const isVerb = (w: string) => VERBS.has(w.toLowerCase().replace(/[^a-z]/g, ""));

// The commit grammar: a name, then a comma, a colon, "will" or "to", then what, then "by <day>".
// It is a suggestion. Text that does not fit it is still read as Find.
function commitOf(raw: string, roster: RosterName[], today: string): Parsed | null {
  const words = raw.trim().replace(/\s+/g, " ").split(" ");
  // The name is the longest start of the text that is on the roster: the full name first, then the first name.
  let person: RosterName | null = null;
  let used = 0;
  for (const n of [2, 1]) {
    if (words.length <= n) continue;
    const w = words.slice(0, n).join(" ").replace(/[,:]+$/, "").toLowerCase();
    const hit = roster.filter((r) => r.name.toLowerCase() === w || (n === 1 && r.name.toLowerCase().split(" ")[0] === w));
    if (hit.length === 1) {
      person = hit[0];
      used = n;
      break;
    }
  }
  if (!person) return null;
  const sep = /[,:]$/.test(words[used - 1]);
  let rest = words.slice(used).join(" ").replace(/^[,:]\s*/, "").trim();
  const will = /^(?:will|'ll|is going to|to|should|can)\s+(.+)$/i.exec(rest);
  if (will) rest = will[1];
  // A verb is a lead-in word ("will", "to") or a common verb as the first word. Without one, nothing is added.
  const verb = !!will || isVerb(rest.split(" ")[0] ?? "");
  const byAt = rest.toLowerCase().lastIndexOf(" by ");
  const tail = byAt >= 0 ? rest.slice(byAt + 4) : "";
  const day = byAt >= 0 ? parseDay(tail, today) : null;
  // Without a comma, a colon, a verb word or a day, it is only a search that starts with a name.
  if (!sep && !will && !day) return null;
  const what = (day ? rest.slice(0, byAt) : rest).replace(/[\s,.;]+$/, "").trim();
  if (!what) return null;
  const dueOn = day && !day.past ? day.iso : null;
  const pastDay = day?.past ? tail.trim().replace(/[.,]+$/, "") : null;
  const when = dueOn ? `by ${fmtLong(dueOn)}` : pastDay ? `by ${pastDay}, a day already past` : "by a day not yet set";
  // "Commit: Orrin Vale will write banner copy by Friday 9 Oct." With no verb the field asks for one and adds none.
  const line = verb
    ? `Commit: ${person.name} will ${what} ${when}.`
    : `Commit: what will ${person.name} do? ${person.name} will \u2026 ${what} ${when}.`;
  return { kind: "commit", ownerId: person.id, ownerName: person.name, what, dueOn, pastDay, verb, line, used, rest: words.slice(used).join(" ").replace(/^[,:]\s*/, "").trim() };
}

export function parseFind(raw: string, roster: RosterName[], today: string): Parsed {
  const text = raw.trim().replace(/\s+/g, " ");
  if (!text) return { kind: "empty" };
  const plain = text.replace(/[?.!]+$/, "").trim();
  for (const { re, ask } of ASKS) {
    const m = re.exec(plain);
    if (!m) continue;
    const p = matchName(m[1], roster);
    if (!p) return { kind: "nobody", line: `No one on the team is called ${cap(m[1].trim())}.` };
    return { kind: "ask", ask, personId: p.id, line: `Ask: ${ASK_WORDS[ask](p.name)}` };
  }
  return commitOf(text, roster, today) ?? { kind: "find", q: text, line: `Find lines with "${text}"` };
}

// What Tab adds. null when there is nothing to suggest. Never applied unless the person presses Tab.
export type Completion = { text: string; hint: string; caret?: number } | null;

// A commitment with no verb: "Orrin, banner copy by Friday" becomes "Orrin will  banner copy by Friday", with the
// caret after "will " so the person types the verb. Return does the same instead of making a draft.
export function verbSlot(raw: string, roster: RosterName[], today: string): { text: string; caret: number } | null {
  const text = raw.replace(/^\s+/, "");
  const c = commitOf(text, roster, today);
  if (!c || c.kind !== "commit" || c.verb) return null;
  const head = `${text.trim().replace(/\s+/g, " ").split(" ").slice(0, c.used).join(" ").replace(/[,:]+$/, "")} will `;
  return { text: `${head} ${c.rest}`, caret: head.length };
}

const ASK_HEAD = /^((?:what(?:'s| is)? )?(?:late (?:for|on)|(?:is )?waiting on|owed to|this week for) |what does )([A-Za-z'-]+)$/i;

export function completeFind(raw: string, roster: RosterName[], today: string): Completion {
  const text = raw.replace(/^\s+/, "");
  if (!text.trim()) return null;
  // A name being typed at the start, or after an Ask phrase: Tab finishes it.
  const ask = ASK_HEAD.exec(text);
  const start = /^([A-Za-z'-]{2,})$/.exec(text);
  const typed = ask ? ask[2] : start ? start[1] : null;
  if (typed) {
    const p = matchName(typed, roster);
    const first = p?.name.split(" ")[0] ?? "";
    if (p && first.toLowerCase().startsWith(typed.toLowerCase())) {
      const same = first.toLowerCase() === typed.toLowerCase();
      if (ask) return same ? null : { text: `${ask[1]}${first}`, hint: `Tab completes ${first}` };
      return { text: `${first}, `, hint: same ? `Tab starts a commitment for ${p.name}` : `Tab completes ${first}` };
    }
  }
  // A commitment with no verb: Tab adds "will" and leaves the caret for the verb.
  const slot = verbSlot(text, roster, today);
  if (slot) return { text: slot.text, caret: slot.caret, hint: "Tab adds will, then type the verb" };
  // A commitment with a name and a thing but no day: Tab adds the Friday of this week as a suggestion.
  const c = commitOf(text, roster, today);
  if (c && c.kind === "commit" && !c.dueOn && !c.pastDay) {
    const fri = nextWeekday(today, 5);
    return { text: `${text.replace(/[\s,.;]+$/, "")} by Friday`, hint: `Tab adds by ${fmtLong(fri)}` };
  }
  return null;
}
