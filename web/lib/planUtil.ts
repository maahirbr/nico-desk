// Pure helpers for plan boards, shared by the server and the browser. Dates are 'YYYY-MM-DD'.

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
// Granola and Fireflies also call it "Action items" or "To-dos", as a heading or in bold.
export function nextStepsOf(text: string): string {
  const head = /(?:^|\n)\s*(?:#+\s*|\*\*)?(?:next steps|action items|to-?dos|follow-?ups)(?:\*\*)?:?\s*\n([\s\S]*?)(?=\n\s*#+\s|$)/i;
  const m = text.match(head);
  return (m ? m[1] : text).trim();
}

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

export type ParsedStep = { owner: string; with: string[]; task: string; due: string; line: number | null; confidence: 'sure' | 'unsure'; alt: number[]; why: string };

// Works without a model: "(Name) task (Oct 7, 2026)" gives owner, task and date. Lines are
// suggested by shared words and always marked unsure, so a person picks.
export function plainParse(steps: string, meetingDate: string, lines: { num: number; what: string; doneDef: string }[] = []): ParsedStep[] {
  // A bold name on its own line ("**Kabir Sethi**") owns the lines under it.
  let group = '';
  const rows: { line: string; group: string }[] = [];
  for (const raw of steps.split(/\n/)) {
    const t = raw.trim();
    const head = t.match(/^(?:#+\s*)?\*\*(.+?)\*\*:?$/);
    if (head) { group = head[1].trim(); continue; }
    const line = t.replace(/^\s*[-*•\d.)]+\s*/, '').replace(/\*\*/g, '').trim();
    if (line) rows.push({ line, group });
  }
  return rows
    .map(({ line: l, group: g }) => {
      let owner = g;
      const m = l.match(/^\(([^)]+)\)\s*(.*)$/) ?? l.match(/^([A-Z][a-z]+(?: [A-Z][a-z]+)*)\s*[:\-–]\s+(.*)$/);
      if (m) { owner = m[1].trim(); l = m[2].trim(); }
      let due = '';
      const dm = l.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:,?\s*(\d{4}))?/i)
        ?? l.match(/\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?(?:,?\s*(\d{4}))?/i);
      if (dm) {
        const [mon, day] = /\d/.test(dm[1]) ? [dm[2], dm[1]] : [dm[1], dm[2]];
        const y = dm[3] || meetingDate.slice(0, 4);
        due = `${y}-${String(MONTHS[mon.toLowerCase().slice(0, 3)]).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      } else if (/\btoday\b/i.test(l)) due = meetingDate;
      else if (/\btomorrow\b/i.test(l)) {
        const d = new Date(`${meetingDate}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); due = d.toISOString().slice(0, 10);
      }
      const stripped = l
        .replace(/\s*\((?:by\s+)?[^)]*\d[^)]*\)\s*$/i, '')
        .replace(/\s+(?:by|on|before)\s+(?:\d{1,2}\s+[a-z]{3,9}|[a-z]{3,9}\.?\s+\d{1,2})(?:,?\s*\d{4})?\.?\s*$/i, '')
        .replace(/\s+(?:by\s+)?(?:today|tomorrow)\.?\s*$/i, '')
        .trim() || l;
      const task = stripped.charAt(0).toUpperCase() + stripped.slice(1);
      const words = new Set(task.toLowerCase().match(/[a-z]{4,}/g) ?? []);
      const scored = lines
        .map((ln) => ({ num: ln.num, score: (`${ln.what} ${ln.doneDef}`.toLowerCase().match(/[a-z]{4,}/g) ?? []).filter((w) => words.has(w)).length }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score);
      return { owner, with: [], task, due, line: scored[0]?.num ?? null, confidence: 'unsure' as const, alt: scored.slice(1, 3).map((x) => x.num), why: '' };
    });
}

// Plan lines follow the task rule: a reason for blocked, back to not started, or reopening done.
export const needsWhy = (from: string, to: string) => to === 'Blocked' || (to === 'Not started' && from !== 'Not started') || from === 'Done';
