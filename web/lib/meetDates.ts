import type { MeetEvery, Project } from './plan';
import { addDays, fmtDate } from './time';

// The pure part of the meeting rhythm: the words, and the date maths. No database and no server imports, so the browser
// can use it too (components/MeetingSection.tsx). Every function takes `today`, so tests pin it. lib/meetings.ts re-exports this.

export const MEET_EVERY = ['weekly', 'fortnightly', 'monthly', 'as_needed'] as const;
export const EVERY_WORDS: Record<MeetEvery, string> = {
  weekly: 'Every week', fortnightly: 'Every two weeks', monthly: 'Every month', as_needed: 'As needed',
};
export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
const SHORT_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export type Rhythm = Pick<Project, 'meetEvery' | 'meetDay' | 'meetNext' | 'meetLast'>;

// ---------- dates (pure) ----------

// ISO weekday of a date: 1 Monday ... 7 Sunday.
export const weekdayOf = (date: string): number => new Date(`${date}T00:00:00Z`).getUTCDay() || 7;

// The first date on or after `date` that falls on weekday `day`.
export function snapToDay(date: string, day: number | null): string {
  if (!day) return date;
  return addDays(date, (day - weekdayOf(date) + 7) % 7);
}

// Add whole months and keep the day of the month, or the last day of a shorter month: 31 Jan + 1 month is 28 Feb (29 in a leap year).
// `anchorDay` lets a run of months return to the 31st after a short month.
export function addMonths(date: string, n: number, anchorDay = Number(date.slice(8, 10))): string {
  const y0 = Number(date.slice(0, 4));
  const m0 = Number(date.slice(5, 7)) - 1 + n;
  const y = y0 + Math.floor(m0 / 12);
  const m = ((m0 % 12) + 12) % 12;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return `${String(y).padStart(4, '0')}-${String(m + 1).padStart(2, '0')}-${String(Math.min(anchorDay, last)).padStart(2, '0')}`;
}

// The kth meeting after `anchor` (k = 0 is the anchor itself), snapped to the weekday when one is set.
function occurrence(anchor: string, every: MeetEvery, day: number | null, k: number): string {
  const raw = every === 'weekly' ? addDays(anchor, 7 * k) : every === 'fortnightly' ? addDays(anchor, 14 * k) : addMonths(anchor, k);
  return snapToDay(raw, day);
}

const INTERVAL_DAYS: Record<Exclude<MeetEvery, 'as_needed'>, number> = { weekly: 7, fortnightly: 14, monthly: 28 };
const MAX_STEPS = 2000;

// The first meeting when a rhythm is set with no date: the next matching weekday on or after today, else one step on from today.
export function firstMeetingDate(every: MeetEvery, day: number | null, today: string): string | null {
  if (every === 'as_needed') return null;
  if (day) return snapToDay(today, day);
  return occurrence(today, every, null, 1);
}

// The next meeting as it should show today. A stored date still ahead is kept. A past one rolls forward by the frequency until
// it reaches today or later. "As needed" has no automatic date: only a date set by hand, and only while it is still ahead.
export function nextMeetingDate(r: Rhythm, today: string): string | null {
  if (!r.meetEvery) return null;
  if (r.meetEvery === 'as_needed') return r.meetNext && r.meetNext >= today ? r.meetNext : null;
  const anchor = r.meetNext ?? (r.meetLast ? occurrence(r.meetLast, r.meetEvery, r.meetDay, 1) : null);
  if (!anchor) return firstMeetingDate(r.meetEvery, r.meetDay, today);
  for (let k = 0; k < MAX_STEPS; k++) {
    const c = occurrence(anchor, r.meetEvery, r.meetDay, k);
    if (c >= today) return c;
  }
  return null;
}

// The next date once a meeting is held today: the first one after today. A stored date still more than a whole step ahead
// stays (this was an extra meeting); a nearer one is the meeting just held, so it moves on one step.
export function nextAfterHeld(r: Rhythm, today: string): string | null {
  if (!r.meetEvery || r.meetEvery === 'as_needed') return null;
  const anchor = r.meetNext ?? today;
  const gap = Math.round((Date.parse(`${anchor}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  const from = anchor > today && gap >= INTERVAL_DAYS[r.meetEvery] ? 0 : 1;
  for (let k = anchor > today ? from : 0; k < MAX_STEPS; k++) {
    const c = occurrence(anchor, r.meetEvery, r.meetDay, k);
    if (c > today) return c;
  }
  return null;
}

// "Meets Thu, next 16 Oct": the line the project list and the Team page show.
export function meetsWords(r: Rhythm, today: string): string | null {
  if (!r.meetEvery) return null;
  const d = r.meetDay ? SHORT_DAYS[r.meetDay - 1] : null;
  const rhythm = r.meetEvery === 'weekly' ? (d ? `Meets ${d}` : 'Meets weekly')
    : r.meetEvery === 'fortnightly' ? (d ? `Meets every other ${d}` : 'Meets every two weeks')
    : r.meetEvery === 'monthly' ? 'Meets monthly' : 'Meets as needed';
  const next = nextMeetingDate(r, today);
  return next ? `${rhythm}, next ${next === today ? 'today' : fmtDate(next)}` : rhythm;
}
