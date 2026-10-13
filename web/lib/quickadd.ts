import { addDays, fmtDate, isDate, mondayOf } from './time';

// Quick add: one line becomes the fields of a new task.
//   "Send deck to vendor fri @sam #launch"  ->  title, due date, owner, project
// A pure function, so every rule is tested. It only suggests: the form shows what it found and every
// field stays editable before save.
//
// Rules, kept small on purpose:
//  - A date counts only at the END of the line (an @ or # word may come after it). A date-like word
//    inside the title ("Plan the Friday launch", "Review sun cream") stays in the title.
//  - "by", "on" and "due" right before the date go with it ("Send deck by fri").
//  - A bare weekday is the next one after today, so "fri" on a Friday is next week's, like the Friday
//    shortcut of the date field. "next fri" is the one in the following week.
//  - "24 Oct", "24th October", "Oct 24", "24 Oct 2026" and "2026-10-24" are dates. With no year, a day
//    that has passed this year means next year.
//  - @word matches a person by first name, then by the start of the name, then by any name word.
//    #word matches a project the same way, against its name ("#spring-hamper" for "Spring hamper").
//  - An @ or # word that matches nobody, or more than one, stays in the title and is reported.

export type Named = { id: string; name: string };

export type Mention<T extends Named> =
  | { word: string; status: 'matched'; item: T }
  | { word: string; status: 'ambiguous'; items: T[] }
  | { word: string; status: 'none' };

export type QuickParse<P extends Named = Named, R extends Named = Named> = {
  title: string;
  dueOn: string | null;
  dueText: string | null; // the words that gave the date, for the preview
  owner: Mention<P> | null;
  project: Mention<R> | null;
};

const WEEKDAYS: Record<string, number> = {
  mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6, sun: 7, sunday: 7,
};
const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};
const CONNECTORS = new Set(['by', 'on', 'due']);
const NOT_BEFORE_A_DAY_WORD = new Set(['the', 'a', 'an', 'my', 'our', 'your', 'of', 'this', 'every']);

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

// First tier that has any hit decides: the whole name, the first word, the start of the name, the start of any word.
export function match<T extends Named>(word: string, items: T[]): Mention<T> {
  const w = norm(word);
  if (!w) return { word, status: 'none' };
  const compact = w.replace(/ /g, '');
  const tiers: ((n: string) => boolean)[] = [
    (n) => n.replace(/ /g, '') === compact,
    (n) => n.split(' ')[0] === w,
    (n) => n.replace(/ /g, '').startsWith(compact),
    (n) => n.split(' ').some((x) => x.startsWith(w)),
  ];
  for (const ok of tiers) {
    const hits = items.filter((i) => ok(norm(i.name)));
    if (hits.length === 1) return { word, status: 'matched', item: hits[0] };
    if (hits.length > 1) return { word, status: 'ambiguous', items: hits };
  }
  return { word, status: 'none' };
}

// For a picker that opens on "@" or "#": the items the typed word points at, best tier first. An empty word lists
// the first few. When no tier hits, any item with the word inside its name still counts.
export function suggest<T extends Named>(word: string, items: T[], limit = 6): T[] {
  const m = match(word, items);
  if (m.status === 'matched') return [m.item];
  if (m.status === 'ambiguous') return m.items.slice(0, limit);
  const w = norm(word);
  return items.filter((i) => !w || norm(i.name).includes(w)).slice(0, limit);
}

function ymd(y: number, m: number, d: number): string | null {
  const s = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return isDate(s) && new Date(`${s}T00:00:00Z`).getUTCDate() === d ? s : null;
}

// A day and month with no year: this year, or next year when it has passed.
function dayMonth(d: number, m: number, today: string): string | null {
  const y = Number(today.slice(0, 4));
  const here = ymd(y, m, d);
  if (!here) return null;
  return here >= today ? here : ymd(y + 1, m, d);
}

const DAY = /^(\d{1,2})(?:st|nd|rd|th)?$/;
const YEAR = /^\d{4}$/;

// The date at the end of `w` (lower-case words), and how many words it takes. Longest form first.
function trailingDate(w: string[], today: string): { dueOn: string; len: number } | null {
  const at = (back: number) => w[w.length - back];
  const n = w.length;
  const isDay = (s?: string) => !!s && DAY.test(s);
  const dayOf = (s: string) => Number(DAY.exec(s)![1]);

  if (n >= 3 && YEAR.test(at(1)) && isDay(at(3)) && MONTHS[at(2)]) {
    const d = ymd(Number(at(1)), MONTHS[at(2)], dayOf(at(3)));
    if (d) return { dueOn: d, len: 3 };
  }
  if (n >= 3 && YEAR.test(at(1)) && isDay(at(2)) && MONTHS[at(3)]) {
    const d = ymd(Number(at(1)), MONTHS[at(3)], dayOf(at(2)));
    if (d) return { dueOn: d, len: 3 };
  }
  if (n >= 2 && isDay(at(2)) && MONTHS[at(1)]) {
    const d = dayMonth(dayOf(at(2)), MONTHS[at(1)], today);
    if (d) return { dueOn: d, len: 2 };
  }
  if (n >= 2 && MONTHS[at(2)] && isDay(at(1))) {
    const d = dayMonth(dayOf(at(1)), MONTHS[at(2)], today);
    if (d) return { dueOn: d, len: 2 };
  }
  if (n >= 2 && at(2) === 'next' && WEEKDAYS[at(1)]) {
    return { dueOn: addDays(mondayOf(today), 7 + WEEKDAYS[at(1)] - 1), len: 2 };
  }
  if (n >= 1) {
    const last = at(1);
    const before = n >= 2 ? at(2) : '';
    if (isDate(last)) return { dueOn: last, len: 1 };
    // "the friday", "my sun": the word belongs to the title.
    if (NOT_BEFORE_A_DAY_WORD.has(before)) return null;
    if (last === 'today') return { dueOn: today, len: 1 };
    if (last === 'tomorrow' || last === 'tmrw') return { dueOn: addDays(today, 1), len: 1 };
    if (WEEKDAYS[last]) {
      const dow = new Date(`${today}T00:00:00Z`).getUTCDay() || 7;
      const ahead = (WEEKDAYS[last] - dow + 7) % 7 || 7;
      return { dueOn: addDays(today, ahead), len: 1 };
    }
  }
  return null;
}

const MENTION = /^([@#])([\p{L}\p{N}][\p{L}\p{N}._'-]*)$/u;

export function parseQuickAdd<P extends Named, R extends Named>(
  input: string,
  ctx: { today: string; people: P[]; projects: R[] },
): QuickParse<P, R> {
  const words = input.trim().split(/\s+/).filter(Boolean);
  const drop = new Set<number>();
  let owner: Mention<P> | null = null;
  let project: Mention<R> | null = null;

  // @ and # words, anywhere. The first of each kind counts; a second one stays in the title.
  words.forEach((raw, i) => {
    const m = MENTION.exec(raw.replace(/[.,;:!?)]+$/, ''));
    if (!m) return;
    if (m[1] === '@' && !owner) {
      owner = match(m[2], ctx.people);
      if (owner.status === 'matched') drop.add(i);
    } else if (m[1] === '#' && !project) {
      project = match(m[2], ctx.projects);
      if (project.status === 'matched') drop.add(i);
    }
  });

  // The date: the end of what is left once @ and # words (matched or not) are set aside.
  const isMention = (raw: string) => MENTION.test(raw.replace(/[.,;:!?)]+$/, ''));
  const body = words.map((raw, i) => ({ raw, i })).filter((x) => !isMention(x.raw));
  const lower = body.map((x) => x.raw.toLowerCase().replace(/[.,;:!?]+$/, ''));
  let dueOn: string | null = null;
  let dueText: string | null = null;
  const found = trailingDate(lower, ctx.today);
  if (found) {
    let start = body.length - found.len;
    while (start > 0 && CONNECTORS.has(lower[start - 1])) start--;
    // A date alone is not a task: keep at least one word for the title.
    if (start > 0) {
      dueOn = found.dueOn;
      dueText = body.slice(body.length - found.len).map((x) => x.raw.replace(/[.,;:!?]+$/, '')).join(' ');
      for (let k = start; k < body.length; k++) drop.add(body[k].i);
    }
  }

  const title = words.filter((_, i) => !drop.has(i)).join(' ');
  return { title, dueOn, dueText, owner, project };
}

// One line for the preview under the field: what was found, and what was not.
export function describeQuick(p: QuickParse): string[] {
  const out: string[] = [];
  if (p.dueOn) out.push(`Due ${fmtDate(p.dueOn)}`);
  if (p.owner) {
    out.push(p.owner.status === 'matched' ? `Owner ${p.owner.item.name}`
      : p.owner.status === 'ambiguous' ? `@${p.owner.word} fits ${p.owner.items.map((i) => i.name).join(' and ')}, so pick one`
      : `No one matches @${p.owner.word}`);
  }
  if (p.project) {
    out.push(p.project.status === 'matched' ? `Project ${p.project.item.name}`
      : p.project.status === 'ambiguous' ? `#${p.project.word} fits ${p.project.items.map((i) => i.name).join(' and ')}, so pick one`
      : `No project matches #${p.project.word}`);
  }
  return out;
}
