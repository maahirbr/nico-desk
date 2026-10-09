import { addDays, isDate, mondayOf } from './time';

// v2 commit field. The top search field reads two sentence shapes and turns them into a draft:
//   "ask <person> to <thing> by <date>"   an ask for a teammate
//   "I'll <thing> by <date>"              a task for yourself ("I will" also works)
// Anything else is a normal search. This is a fixed parser, no model: the same text always gives
// the same draft, and the draft shows the date it chose so the person can see it before one click.
// Pure on purpose (no server imports), so the browser and the tests use the same code.

export type Person = { id: string; name: string };

export type Draft =
  | { kind: 'ask'; toId: string; toName: string; title: string; dueOn: string; problem?: string }
  | { kind: 'mine'; title: string; dueOn: string };

const WEEKDAYS: Record<string, number> = {
  sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2, tues: 2, wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4, friday: 5, fri: 5, saturday: 6, sat: 6,
};
const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10,
  nov: 11, november: 11, dec: 12, december: 12,
};

const dow = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();
const pad = (n: number) => String(n).padStart(2, '0');

// A real calendar day, or null ("31 Feb" is not one).
function ymd(y: number, m: number, d: number): string | null {
  const s = `${y}-${pad(m)}-${pad(d)}`;
  return isDate(s) && new Date(`${s}T00:00:00Z`).getUTCDate() === d ? s : null;
}

// A day and month with no year means the next time that day comes round, today included.
function nextDayMonth(day: number, month: number, today: string): string | null {
  const y = Number(today.slice(0, 4));
  const this_ = ymd(y, month, day);
  if (this_ && this_ >= today) return this_;
  return ymd(y + 1, month, day);
}

// Words to a date, or null. "Friday" is the next Friday after today. "this Friday" may be today.
// "next Friday" is that day in next week (the week that starts on the coming Monday).
// "next week" is the Friday of next week. A day and month is the next time it comes round.
export function parseDate(raw: string, today: string): string | null {
  const s = raw.trim().toLowerCase().replace(/[.,]+$/, '').replace(/\s+/g, ' ');
  if (!s) return null;
  if (s === 'today') return today;
  if (s === 'tomorrow') return addDays(today, 1);
  if (s === 'next week') return addDays(mondayOf(today), 7 + 4);
  if (isDate(s)) return s;

  let m = /^(this |next )?([a-z]+)$/.exec(s);
  if (m && m[2] in WEEKDAYS) {
    const want = WEEKDAYS[m[2]];
    if (m[1] === 'next ') return addDays(mondayOf(today), 7 + ((want + 6) % 7));
    const ahead = (want - dow(today) + 7) % 7;
    return addDays(today, m[1] === 'this ' ? ahead : ahead === 0 ? 7 : ahead);
  }

  // "12 oct", "12th october", "the 12th of oct"
  m = /^(?:the )?(\d{1,2})(?:st|nd|rd|th)?(?: of)? ([a-z]+)$/.exec(s);
  if (m && m[2] in MONTHS) return nextDayMonth(Number(m[1]), MONTHS[m[2]], today);
  // "oct 12", "october 12th"
  m = /^([a-z]+) (\d{1,2})(?:st|nd|rd|th)?$/.exec(s);
  if (m && m[1] in MONTHS) return nextDayMonth(Number(m[2]), MONTHS[m[1]], today);
  // "12/10" is the 12th of October, the way the team writes it.
  m = /^(\d{1,2})\/(\d{1,2})$/.exec(s);
  if (m) return nextDayMonth(Number(m[1]), Number(m[2]), today);
  return null;
}

// Splits "<thing> by <date>" at the last " by " that leaves a date on the right.
function thingAndDate(rest: string, today: string): { title: string; dueOn: string } | null {
  const bys = [...rest.matchAll(/\s+by\s+/gi)];
  for (let i = bys.length - 1; i >= 0; i--) {
    const at = bys[i].index!;
    const dueOn = parseDate(rest.slice(at + bys[i][0].length), today);
    if (!dueOn) continue;
    const title = tidy(rest.slice(0, at));
    return title.length >= 3 ? { title, dueOn } : null;
  }
  return null;
}

function tidy(s: string): string {
  const t = s.trim().replace(/[.,;:]+$/, '').trim();
  return t ? t[0].toUpperCase() + t.slice(1) : t;
}

export function parseCommit(text: string, today: string, people: Person[], meId: string): Draft | null {
  const q = text.trim().replace(/\s+/g, ' ');

  const mine = /^i(?:'|’)ll\s+(.+)$/i.exec(q) ?? /^i will\s+(.+)$/i.exec(q);
  if (mine) {
    const r = thingAndDate(mine[1], today);
    return r ? { kind: 'mine', ...r } : null;
  }

  // The person is the words before the first " to " that names someone: a first name or a full name.
  const ask = /^ask\s+(.+)$/i.exec(q);
  if (ask) {
    const tos = [...ask[1].matchAll(/\s+to\s+/gi)];
    for (const t of tos) {
      const who = ask[1].slice(0, t.index!).trim().toLowerCase();
      const found = people.filter((p) => p.name.toLowerCase() === who || p.name.split(/\s+/)[0].toLowerCase() === who);
      if (found.length === 0) continue;
      const r = thingAndDate(ask[1].slice(t.index! + t[0].length), today);
      if (!r) return null;
      if (found.length > 1) return { kind: 'ask', toId: '', toName: ask[1].slice(0, t.index!).trim(), ...r, problem: `More than one person is called ${found[0].name.split(/\s+/)[0]}. Use the full name.` };
      const p = found[0];
      if (p.id === meId) return { kind: 'ask', toId: p.id, toName: p.name, ...r, problem: 'That is you. Start with I’ll instead.' };
      return { kind: 'ask', toId: p.id, toName: p.name, ...r };
    }
  }
  return null;
}
