// Pure helpers for plan boards, shared by the server and the browser. Dates are 'YYYY-MM-DD'.

import { PRONOUN, readBlocks } from './blocks';

export type Checkpoint = {
  id: string; label: string; dueOn: string | null; origDueOn: string | null; pushCount: number; done: boolean; doneOn: string | null;
};

export type PlanLine = {
  id: string; num: number; pillar: string; what: string; doneDef: string; note: string;
  ownerId: string | null; ownerWith: string; partner: string; partnerRole: string; mode: 'coaching' | 'hands-on';
  dueOn: string | null; origDueOn: string | null; pushCount: number; byLabel: string;
  status: 'Not started' | 'In progress' | 'Blocked' | 'Done'; completedOn: string | null;
  removed: boolean; removedBy: string | null; removedAt: string | null; removeReason: string | null;
  lastDateBy: string | null; lastDateAt: string | null; updatedAt: string;
  checkpoints: Checkpoint[];
};

export type PlanAction = {
  id: string; lineId: string | null; ownerName: string; ownerWith: string; task: string; dueOn: string | null;
  done: boolean; doneOn: string | null; source: { title?: string; date?: string; link?: string };
};

export type PlanAsk = {
  id: string; short: string; text: string; ownerName: string; dueOn: string | null;
  checkpoints: { label: string; date: string }[]; done: boolean; doneOn: string | null;
};

export type Proposal = {
  id: string; batch: string; position: number; meeting: { title: string; date: string; link?: string };
  ownerName: string; ownerWith: string; task: string; dueOn: string | null; lineId: string | null;
  ownerId: string | null; workstream: string | null;
  details: string; // the description under the task heading (20 Nov)
  confidence: 'sure' | 'unsure'; alt: string[]; why: string;
};

export const STATUSES = ['Not started', 'In progress', 'Blocked', 'Done'] as const;

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

export function sortedCheckpoints(l: PlanLine): Checkpoint[] {
  return [...l.checkpoints].sort((a, b) => (a.dueOn ?? '9999').localeCompare(b.dueOn ?? '9999'));
}

// The checkpoint that matters now: the earliest unticked one, else the line's own date.
export function nextCheckpoint(l: PlanLine): { date: string; label: string; cpId: string | null } | null {
  const open = sortedCheckpoints(l).filter((c) => !c.done && c.dueOn);
  if (open.length) return { date: open[0].dueOn!, label: open[0].label, cpId: open[0].id };
  if (l.dueOn) return { date: l.dueOn, label: '', cpId: null };
  return null;
}

export function lineLate(l: PlanLine, today: string): boolean {
  if (l.status === 'Done') return false;
  const n = nextCheckpoint(l);
  return !!n && n.date < today;
}

export const ownerPending = (l: PlanLine) => !l.ownerId || !l.partner;

// A line's target is its own first date, else its last checkpoint's first date.
export function targetDate(l: PlanLine): string | null {
  if (l.dueOn) return l.origDueOn ?? l.dueOn;
  const ds = l.checkpoints.filter((c) => c.dueOn).sort((a, b) => a.dueOn!.localeCompare(b.dueOn!));
  const last = ds.at(-1);
  return last ? last.origDueOn ?? last.dueOn : null;
}

export const totalPushes = (l: PlanLine) => l.pushCount + l.checkpoints.reduce((n, c) => n + c.pushCount, 0);

// "2 days late" / "1 day early" / "on time", judged against the date first given.
export function stampRel(doneOn: string, dueOn: string | null): { rel: string; kind: 'early' | 'ontime' | 'late' | '' } {
  if (!dueOn) return { rel: '', kind: '' };
  const n = daysBetween(dueOn, doneOn);
  if (n === 0) return { rel: 'on time', kind: 'ontime' };
  const m = Math.abs(n);
  return { rel: `${m} day${m === 1 ? '' : 's'} ${n > 0 ? 'late' : 'early'}`, kind: n > 0 ? 'late' : 'early' };
}

export function dueWords(date: string, today: string): string {
  const n = daysBetween(today, date);
  if (n < 0) return `${-n} day${n === -1 ? '' : 's'} late`;
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  return `In ${n} days`;
}

// Months and days to (or since) a launch date, for the header countdown.
export function countdown(today: string, launch: string): { months: number; days: number; past: boolean } {
  const past = today > launch;
  const [a, b] = past ? [launch, today] : [today, launch];
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  let months = (by - ay) * 12 + (bm - am);
  const at = (k: number) => new Date(Date.UTC(ay, am - 1 + k, ad));
  if (at(months) > new Date(Date.UTC(by, bm - 1, bd))) months -= 1;
  const days = Math.round((Date.UTC(by, bm - 1, bd) - at(months).getTime()) / 86400000);
  return { months, days, past };
}

// ---------- meeting minutes ----------

// The "Next Steps" section of a meeting summary, or the whole text if there is none.
// Granola, Fireflies and Fathom also call it "Action items" or "To-dos", as a heading or in bold.
export function nextStepsOf(text: string): string {
  const head = /(?:^|\n)\s*(?:#+\s*|\*\*)?(?:next steps|action items|to-?dos|follow-?ups)(?:\*\*)?:?\s*\n([\s\S]*?)(?=\n\s*#+\s|$)/i;
  const m = text.match(head);
  return (m ? m[1] : text).trim();
}

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

export type ParsedStep = { owner: string; with: string[]; task: string; details?: string; due: string; line: number | null; confidence: 'sure' | 'unsure'; alt: number[]; why: string };

// A due date said relative to the meeting (20 Nov, the PM's ask): "in 18 days", "18 days later", "within 2 weeks",
// "by Friday", "next Monday", "next week", "end of the week", "end of the month". Counted from the meeting date.
const NUM: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, a: 1, an: 1 };
const WEEKDAY = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const plusDays = (d: string, n: number) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
export const RELATIVE_DUE = /\b(?:(?:in|within|after)\s+(\d{1,3}|[a-z]+)\s+(days?|weeks?|months?)(?:\s+(?:from\s+(?:now|today|the\s+meeting)|time))?|(\d{1,3}|[a-z]+)\s+(days?|weeks?|months?)\s+(?:later|from\s+(?:now|today|the\s+meeting)|after\s+the\s+meeting)|(?:(?:by|on|for|before|till|until)\s+)?(next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)|next\s+week|(?:by\s+)?(?:the\s+)?end\s+of\s+(?:the\s+|this\s+)?(week|month))\b/i;
export function relativeDue(text: string, meetingDate: string): string {
  const m = RELATIVE_DUE.exec(text);
  if (!m) return '';
  const num = (w: string) => (/^\d+$/.test(w) ? Number(w) : NUM[w.toLowerCase()] ?? NaN);
  const span = (n: number, unit: string) => {
    const u = unit.toLowerCase();
    if (u.startsWith('day')) return plusDays(meetingDate, n);
    if (u.startsWith('week')) return plusDays(meetingDate, 7 * n);
    const x = new Date(`${meetingDate}T00:00:00Z`); x.setUTCMonth(x.getUTCMonth() + n); return x.toISOString().slice(0, 10);
  };
  if (m[1] && m[2]) { const n = num(m[1]); return Number.isNaN(n) ? '' : span(n, m[2]); }
  if (m[3] && m[4]) { const n = num(m[3]); return Number.isNaN(n) ? '' : span(n, m[4]); }
  const dow = new Date(`${meetingDate}T00:00:00Z`).getUTCDay();
  if (m[6]) {
    const want = WEEKDAY.indexOf(m[6].toLowerCase());
    let ahead = (want - dow + 7) % 7 || 7; // the next one after the meeting day
    if (m[5] && ahead < 7 && dow !== 0 && want > dow) ahead += 7; // "next Friday" said on a Monday: the Friday after this one
    return plusDays(meetingDate, ahead);
  }
  if (/next\s+week/i.test(m[0])) return plusDays(meetingDate, ((8 - dow) % 7 || 7)); // the coming Monday
  if (m[7]?.toLowerCase() === 'week') return plusDays(meetingDate, ((5 - dow + 7) % 7)); // this Friday
  if (m[7]?.toLowerCase() === 'month') { const x = new Date(`${meetingDate}T00:00:00Z`); return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0)).toISOString().slice(0, 10); }
  return '';
}

// Works without a model: "(Name) task (Oct 7, 2026)", "Name: task" or "Name to task" give owner, task and date.
// Pasted lines are read as blocks (lib/blocks.ts): a name heading owns the steps under it, sub-bullets and plain
// statements fold into the step above, wrapped lines join, and greetings and labels are skipped. "He should also ..."
// keeps the owner of the step before. Lines are suggested by shared words and always marked unsure, so a person picks.
export function plainParse(steps: string, meetingDate: string, lines: { num: number; what: string; doneDef: string }[] = []): ParsedStep[] {
  const dateIn = (l: string) => {
    const dm = l.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:,?\s*(\d{4}))?/i)
      ?? l.match(/\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?(?:,?\s*(\d{4}))?/i);
    if (dm) {
      const [mon, day] = /\d/.test(dm[1]) ? [dm[2], dm[1]] : [dm[1], dm[2]];
      const y = dm[3] || meetingDate.slice(0, 4);
      return `${y}-${String(MONTHS[mon.toLowerCase().slice(0, 3)]).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    if (/\btoday\b/i.test(l)) return meetingDate;
    const rel = relativeDue(l, meetingDate);
    if (rel) return rel;
    if (/\btomorrow\b/i.test(l)) {
      const d = new Date(`${meetingDate}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10);
    }
    return '';
  };
  const NAME = /^[A-Z][\p{L}'-]+(?: [A-Z][\p{L}'-]+){0,2}$/u;
  let prev = '';
  return readBlocks(steps)
    .map((b) => {
      let l = b.text;
      let owner = NAME.test(b.heading) ? b.heading : '';
      const m = PRONOUN.test(l) ? null : l.match(/^\(([^)]+)\)\s*(.*)$/) ?? l.match(/^([A-Z][a-z]+(?: [A-Z][a-z]+)*)\s*[:\-–]\s+(.*)$/)
        ?? l.match(/^([A-Z][a-z]+(?: [A-Z][a-z]+)?)\s+(?:to|should|will|must|needs?\s+to|has\s+to)\s+(?!be\b)(.*)$/);
      if (m) { owner = m[1].trim(); l = m[2].trim(); } else if (PRONOUN.test(l)) {
        owner = owner || prev;
        l = l.replace(PRONOUN, '').replace(/^(?:should|will|must|can|needs?\s+to|has\s+to|have\s+to|is\s+to)\s+/i, '').replace(/^also\s+/i, '');
      }
      prev = owner;
      const due = dateIn(l) || (b.due ? dateIn(b.due) : '');
      const stripped = l
        .replace(/\s*\((?:by\s+)?[^)]*\d[^)]*\)\s*$/i, '')
        .replace(/\s+(?:by|on|before)\s+(?:\d{1,2}\s+[a-z]{3,9}|[a-z]{3,9}\.?\s+\d{1,2})(?:,?\s*\d{4})?\.?\s*$/i, '')
        .replace(/\s+(?:by\s+)?(?:today|tomorrow)\.?\s*$/i, '')
        .replace(new RegExp(`[,\\s]*${RELATIVE_DUE.source}[.,]?`, 'i'), ' ')
        .replace(/\s+/g, ' ')
        .trim() || l;
      const head = stripped.charAt(0).toUpperCase() + stripped.slice(1);
      // The heading is the task; lines under it are its description (20 Nov), no longer glued onto the title.
      const task = head;
      const details = b.details.map((d) => d.trim()).filter(Boolean).map((d) => d.charAt(0).toUpperCase() + d.slice(1)).join('\n');
      const words = new Set(task.toLowerCase().match(/[a-z]{4,}/g) ?? []);
      const scored = lines
        .map((ln) => ({ num: ln.num, score: (`${ln.what} ${ln.doneDef}`.toLowerCase().match(/[a-z]{4,}/g) ?? []).filter((w) => words.has(w)).length }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score);
      return { owner, with: [], task, details, due, line: scored[0]?.num ?? null, confidence: 'unsure' as const, alt: scored.slice(1, 3).map((x) => x.num), why: '' };
    });
}

// Plan lines follow the task rule: a reason for blocked, back to not started, or reopening done.
export const needsWhy = (from: string, to: string) => to === 'Blocked' || (to === 'Not started' && from !== 'Not started') || from === 'Done';

// Header counts for one person on /team: every open task (this week and coming up), and how many of those are past due.
// "Ahead" is a flag for tasks closed before their first date, so it is never a count of open work.
export function personCounts(open: { dueOn: string }[], comingUp: unknown[], today: string) {
  return { open: open.length + comingUp.length, late: open.filter((t) => t.dueOn < today).length };
}

// The project lead is shown once, as "Project lead", so their project_members row is left out of the member list.
export const membersExceptLead = <M extends { personId: string }>(members: M[], ownerId: string): M[] => members.filter((m) => m.personId !== ownerId);

// A partner project: an old plan board, or (since 1 Nov) a task board with a partner named. Both show Nicobar and Partner
// people in the header; only the old kind shows the plan board.
export const isPartnerProject = (p: { kind: string; partnerName: string | null }) => p.kind === 'plan' || !!p.partnerName;
