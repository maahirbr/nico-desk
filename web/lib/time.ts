// Days are judged in Asia/Kolkata (SPEC.md 3.4). Dates are 'YYYY-MM-DD' strings throughout.

const IST = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function istDate(at: string | Date): string {
  return IST.format(typeof at === 'string' ? new Date(at) : at);
}

// NICO_TODAY pins "today" for demos and tests, e.g. the fixtures' as-of date 2026-10-09.
export function today(): string {
  return process.env.NICO_TODAY || istDate(new Date());
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function mondayOf(date: string): string {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(date, dow === 0 ? -6 : 1 - dow);
}

// The shortcut dates of a date field, counted from `from` (a local day). Weeks run Monday to Sunday:
// Friday is this week's, or next week's once `from` is Friday or later; Next Monday is the first
// Monday after `from`.
export function quickDates(from: string) {
  const dow = new Date(`${from}T00:00:00Z`).getUTCDay() || 7; // Monday 1 ... Sunday 7
  return {
    today: from,
    tomorrow: addDays(from, 1),
    friday: addDays(from, dow < 5 ? 5 - dow : 12 - dow),
    nextMonday: addDays(mondayOf(from), 7),
  };
}

// The chips a date field shows: one per shortcut word, a repeated date dropped (on a Thursday Friday is
// tomorrow, so only Tomorrow shows), and a chip off when its date falls outside min and max.
const QUICK_WORDS = [['today', 'Today'], ['tomorrow', 'Tomorrow'], ['friday', 'Friday'], ['nextMonday', 'Next Monday']] as const;
export function quickChips(from: string, min = '', max = '') {
  const days = quickDates(from);
  const seen = new Set<string>();
  return QUICK_WORDS.filter(([k]) => !seen.has(days[k]) && seen.add(days[k]))
    .map(([key, word]) => ({ key, word, date: days[key], off: (!!min && days[key] < min) || (!!max && days[key] > max) }));
}

export function isDate(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "26 Sep": fixed words, so it reads the same in every browser locale.
export function fmtDate(date: string): string {
  return `${Number(date.slice(8, 10))} ${MONTHS[Number(date.slice(5, 7)) - 1]}`;
}

const STAMP = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata',
});
export function fmtStamp(at: string): string {
  return STAMP.format(new Date(at)).replace('Sept', 'Sep');
}

const CLOCK = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });
// "14:05": the time of day in IST, for a chat message.
export function fmtClock(at: string): string {
  return CLOCK.format(new Date(at));
}
