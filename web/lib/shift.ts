import { addDays, fmtDate, isDate, mondayOf, today } from './time';

// The fixtures are written as of one Friday. At seed time every date moves forward by whole weeks,
// so the demo's "this week" is the current week and each date keeps its weekday.
export const FIXTURE_ANCHOR = '2026-10-09';

// Days to add: the weeks between the anchor's Monday and this week's Monday, times seven.
export function shiftDays(now: string = today(), anchor: string = FIXTURE_ANCHOR): number {
  const days = (Date.parse(`${mondayOf(now)}T00:00:00Z`) - Date.parse(`${mondayOf(anchor)}T00:00:00Z`)) / 86_400_000;
  return Math.round(days / 7) * 7;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// "30 Oct 2026" or "10 Oct" inside free text, such as a project pill or an activity line.
const TEXT_DATE = new RegExp(`\\b(\\d{1,2}) (${MONTHS.join('|')})\\b( \\d{4})?`, 'g');

function shiftString(s: string, days: number, anchor: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return addDays(s, days);
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return addDays(s.slice(0, 10), days) + s.slice(10);
  return s.replace(TEXT_DATE, (m, d: string, mon: string, yr?: string) => {
    const from = `${yr ? yr.trim() : anchor.slice(0, 4)}-${String(MONTHS.indexOf(mon) + 1).padStart(2, '0')}-${d.padStart(2, '0')}`;
    if (!isDate(from)) return m;
    const to = addDays(from, days);
    return fmtDate(to) + (yr ? ` ${to.slice(0, 4)}` : '');
  });
}

// Moves every date and timestamp in a parsed fixture. Structure and other values are untouched.
export function shiftJson<T>(v: T, days: number, anchor: string = FIXTURE_ANCHOR): T {
  if (days === 0) return v;
  const walk = (x: unknown): unknown => {
    if (typeof x === 'string') return shiftString(x, days, anchor);
    if (Array.isArray(x)) return x.map(walk);
    if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x).map(([k, val]) => [k, walk(val)]));
    return x;
  };
  return walk(v) as T;
}
