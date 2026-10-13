import type { Tx } from './db';
import type { Task } from './derive';
import { daysTo, flagKeyOf, RISK_DAYS } from './flags';
import { tokensOf } from './fuzzy';
import { jevAsk, jevOn, type JevAnswer, type JevQuestion, type JevResult } from './jev';
import { planState, type Project } from './plan';
import { lineLate } from './planUtil';
import { maskDictFor, type MaskDict } from './redact';
import { today as todayIst, addDays } from './time';

// More uses of Jev (TypeSafe System One), after search (jevSearch.ts) and the status nudge (jevStatus.ts). SERVER ONLY.
//
//   Suggested order   a sort option on Home. Jev scores the words of each task, code adds the date facts and combines.
//   Project health    a labelled suggestion for a project's lead: on track, at risk or slipping.
//   Check drafts      for draft tasks from meeting minutes: how clear the wording is, and an open task it may repeat.
//   Project guess     a project for a new task, picked from a fixed list.
//
// The rules every function here keeps:
//   - Jev suggests. Nothing here writes a task, a status, a project's stored status or a draft. A person decides.
//   - Code does the date maths and the rules (owner, date). Jev reads words only.
//   - An answer counts only above the floor: 0.6 for a Score or Choice (its own confidence), 0.65 for a yes/no.
//   - Off, slow, failed or unsure: the function says so and the caller keeps today's behaviour. Nothing throws.
//   - Everything sent goes through jevAsk, which masks it (lib/redact.ts).

export const FLOOR = 0.6; // a Score or Choice answer is used only at or above this confidence
export const YESNO = 0.65; // a yes/no answer is used only at or above this probability

type Env = Record<string, string | undefined>;

// ---------- reading answers ----------

// A Score answer: { score: 0..levels-1, confidence }. Null when it is missing, malformed or below the floor.
export function readScore(a: JevAnswer | undefined, levels: number): number | null {
  if (!a) return null;
  const s = a.score;
  const c = a.confidence;
  if (typeof s !== 'number' || typeof c !== 'number' || !Number.isFinite(s)) return null;
  if (c < FLOOR) return null;
  return Math.min(levels - 1, Math.max(0, s));
}

// A yes/no answer that is sure enough to say yes. Below the line it is no answer at all, not a "no".
export const isYes = (a: JevAnswer | undefined): boolean => typeof a?.noul === 'number' && a.noul >= YESNO;

// Never overwrite what a person set: a suggestion fills a field only while it is empty.
export const fillIfEmpty = <T>(current: T | null | undefined | '', suggestion: T): T | null => (current ? null : suggestion);

const dictOf = (db: Tx, teamId: string): Promise<MaskDict | null> => maskDictFor(db, teamId).catch(() => null);
const clip = (s: string | null | undefined, n: number) => (s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

// ---------- Suggested order (Home) ----------

export const MAX_ORDERED = 40; // tasks sent to Jev; the rest follow in the default order

// What the dates say, in points. Late counts most and grows with the days late. Then due today, soon, later.
// Blocked and unstarted close to the date (at risk) and a high priority add a little. All from the stored dates.
export function dateFacts(t: Task, today: string): { points: number; why: string[] } {
  const n = daysTo(t.dueOn, today);
  const why: string[] = [];
  let points = 0;
  if (n < 0) { points += 3 + Math.min(-n, 14) / 14; why.push(n === -1 ? 'Late by 1 day' : `Late by ${-n} days`); }
  else {
    points += Math.max(0, 2.5 - n * 0.25);
    if (n === 0) why.push('Due today');
    else if (n <= 7) why.push(n === 1 ? 'Due tomorrow' : `Due in ${n} days`);
  }
  if (flagKeyOf(t, today) === 'at_risk') { points += 0.5; if (t.blocked) why.push('Blocked'); else why.push('At risk'); }
  else if (t.blocked) why.push('Blocked');
  if (t.priority?.value === 'high') { points += 0.5; why.push('High priority'); }
  else if (t.priority?.value === 'low') points -= 0.5;
  return { points, why };
}

export const ORDER_LEVELS = [
  'Routine work that can wait',
  'Worth doing soon',
  'Needs attention now: others depend on it, or it carries a risk',
];

export function orderQuestion(t: Task): JevQuestion {
  return {
    type: 'score',
    instructions: {
      task: clip(t.title, 200),
      note: clip(t.note, 200) || undefined,
      blocked_reason: t.blocked ? clip(t.blocked.ask, 200) : undefined,
      question: 'How much does this task need its owner\'s attention now, judging only by what it says? Ignore dates: they are handled elsewhere.',
    },
    criteria: ORDER_LEVELS,
  };
}

export type OrderOut = { ids: string[]; why: Record<string, string>; scored: number };

// Pure. `tasks` are in the default order; ties keep it. wordScore: task id -> 0..2, only for sure answers.
export function combineOrder(tasks: Task[], wordScore: Map<string, number>, today: string): OrderOut {
  const rows = tasks.map((t, i) => {
    const f = dateFacts(t, today);
    const w = wordScore.get(t.id);
    const why = [...f.why];
    if (w !== undefined && w >= 1.5) why.push('Wording reads as pressing');
    return { t, i, v: f.points + (w !== undefined ? w / 2 : 0), why: why.join(' · ') };
  });
  rows.sort((a, b) => b.v - a.v || a.i - b.i);
  return { ids: rows.map((r) => r.t.id), why: Object.fromEntries(rows.filter((r) => r.why).map((r) => [r.t.id, r.why])), scored: wordScore.size };
}

export type OrderResult = ({ ok: true } & OrderOut) | { ok: false; reason: 'off' | 'unavailable' };

// Never throws. Not ok means "keep the default order and say so".
export async function suggestedOrder(db: Tx, teamId: string, tasks: Task[], today = todayIst(), env?: Env): Promise<OrderResult> {
  const open = tasks.filter((t) => t.statusCategory === 'open');
  if (!jevOn(env) || open.length < 2) return { ok: false, reason: jevOn(env) ? 'unavailable' : 'off' };
  try {
    const dict = await dictOf(db, teamId);
    if (!dict) return { ok: false, reason: 'unavailable' };
    // The tasks closest to their date are the ones worth reading; the others follow by the dates alone.
    const sent = [...open].sort((a, b) => a.dueOn.localeCompare(b.dueOn)).slice(0, MAX_ORDERED);
    const questions: Record<string, JevQuestion> = {};
    sent.forEach((t, i) => { questions[`t${i}`] = orderQuestion(t); });
    const r = await jevAsk({ today }, questions, { dict, env });
    if (!r.ok) return { ok: false, reason: 'unavailable' };
    const words = new Map<string, number>();
    sent.forEach((t, i) => { const s = readScore(r.answers[`t${i}`], ORDER_LEVELS.length); if (s !== null) words.set(t.id, s); });
    if (!words.size) return { ok: false, reason: 'unavailable' };
    return { ok: true, ...combineOrder(open, words, today) };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}

// ---------- Project health ----------

export type HealthKey = 'on_track' | 'at_risk' | 'slipping';
export const HEALTH_WORD: Record<HealthKey, string> = { on_track: 'On track', at_risk: 'At risk', slipping: 'Slipping' };
const HEALTH_LEVELS = [
  'On track: work moves, nothing is stuck, dates are met',
  'At risk: some work is stuck or late, or people raise worries, but it can still be fixed',
  'Slipping: key work is late or blocked, and the notes say the plan will not hold',
];
export const HEALTH_DAYS = 14; // how far back the notes and comments are read
export const HEALTH_MIN_NOTES = 3; // fewer recent notes than this is not enough to judge
const MAX_NOTES = 20;

export function healthKeyOf(score: number): HealthKey {
  return (['on_track', 'at_risk', 'slipping'] as const)[Math.min(2, Math.max(0, Math.round(score)))];
}

export type HealthFacts = { open: number; late: number; at_risk: number; blocked: number; done_last_14_days: number; days_to_launch?: number };

// The numbers come from the dates, in code. They go to Jev as facts, and the page shows the same ones as flags.
export function taskFacts(tasks: Task[], today: string, launchOn: string | null): HealthFacts {
  const since = addDays(today, -HEALTH_DAYS);
  const f: HealthFacts = { open: 0, late: 0, at_risk: 0, blocked: 0, done_last_14_days: 0 };
  for (const t of tasks) {
    if (t.statusCategory === 'done' && t.closedAt && t.closedAt.slice(0, 10) >= since) f.done_last_14_days++;
    if (t.statusCategory !== 'open') continue;
    f.open++;
    const k = flagKeyOf(t, today);
    if (k === 'late') f.late++;
    if (k === 'at_risk') f.at_risk++;
    if (t.blocked) f.blocked++;
  }
  if (launchOn) f.days_to_launch = daysTo(launchOn, today);
  return f;
}

const stripTokens = (s: string) => s.replace(/\[\[(person|task|project):[^\]]+\]\]/g, 'someone');

export async function recentNotes(db: Tx, project: Project, today = todayIst()): Promise<string[]> {
  const since = `${addDays(today, -HEALTH_DAYS)}T00:00:00Z`;
  const out: { at: string; text: string }[] = [];
  const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));
  if (project.kind === 'plan') {
    const { rows } = await db.query<{ at: string; summary: string }>(
      `SELECT at, summary FROM plan_activity WHERE project_id = $1 AND at >= $2 ORDER BY at DESC LIMIT $3`, [project.id, since, MAX_NOTES]);
    for (const r of rows) out.push({ at: iso(r.at), text: r.summary });
  } else {
    const { rows } = await db.query<{ at: string; after: unknown }>(
      `SELECT e.at, e.after FROM events e JOIN tasks t ON t.id = e.entity_id AND e.entity_type = 'task'
       WHERE t.project_id = $1 AND e.field = '_update' AND e.at >= $2 ORDER BY e.at DESC LIMIT $3`, [project.id, since, MAX_NOTES]);
    for (const r of rows) if (typeof r.after === 'string') out.push({ at: iso(r.at), text: r.after });
  }
  const { rows: cm } = await db.query<{ at: string; body: string }>(
    `SELECT c.created_at AS at, c.body FROM comments c
     WHERE c.deleted_at IS NULL AND c.created_at >= $2
       AND ((c.subject_kind = 'project' AND c.subject_id = $1)
         OR (c.subject_kind = 'task' AND c.subject_id IN (SELECT id FROM tasks WHERE project_id = $1)))
     ORDER BY c.created_at DESC LIMIT $3`, [project.id, since, MAX_NOTES]);
  for (const r of cm) out.push({ at: iso(r.at), text: stripTokens(r.body) });
  return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, MAX_NOTES).map((n) => `${n.at.slice(0, 10)}: ${clip(n.text, 240)}`);
}

export function healthQuestion(): JevQuestion {
  return {
    type: 'score',
    instructions: 'Read `recent_notes`, the updates and comments written on this project in the last two weeks. `facts` are counts worked out from the dates: use them as given. How is the project going?',
    criteria: HEALTH_LEVELS,
  };
}

export type HealthOut =
  | { state: 'suggestion'; key: HealthKey; word: string; notes: number }
  | { state: 'unsure' | 'few' | 'off' | 'unavailable'; notes: number };

// Pure: the answer to a label, or "unsure" below the floor.
export function readHealth(a: JevAnswer | undefined, notes: number): HealthOut {
  const s = readScore(a, HEALTH_LEVELS.length);
  if (s === null) return { state: 'unsure', notes };
  const key = healthKeyOf(s);
  return { state: 'suggestion', key, word: HEALTH_WORD[key], notes };
}

// Never throws and never writes. The result is shown to the lead as a suggestion beside the date flags. It is not stored.
export async function projectHealth(db: Tx, teamId: string, project: Project, tasks: Task[], today = todayIst(), env?: Env): Promise<HealthOut> {
  if (!jevOn(env)) return { state: 'off', notes: 0 };
  try {
    const notes = await recentNotes(db, project, today);
    if (notes.length < HEALTH_MIN_NOTES) return { state: 'few', notes: notes.length };
    const facts: HealthFacts | Record<string, number> = project.kind === 'plan' ? await planFacts(db, project, today) : taskFacts(tasks, today, project.launchOn);
    const dict = await dictOf(db, teamId);
    if (!dict) return { state: 'unavailable', notes: notes.length };
    const r = await jevAsk({ project: project.name, facts, recent_notes: notes }, { health: healthQuestion() }, { dict, env });
    if (!r.ok) return { state: 'unavailable', notes: notes.length };
    return readHealth(r.answers.health, notes.length);
  } catch {
    return { state: 'unavailable', notes: 0 };
  }
}

async function planFacts(db: Tx, project: Project, today: string): Promise<Record<string, number>> {
  const s = await planState(db, project.id);
  const lines = s.lines.filter((l) => !l.removed);
  const f: Record<string, number> = {
    open_lines: lines.filter((l) => l.status !== 'Done').length,
    late_lines: lines.filter((l) => lineLate(l, today)).length,
    blocked_lines: lines.filter((l) => l.status === 'Blocked').length,
  };
  if (project.launchOn) f.days_to_end = daysTo(project.launchOn, today);
  return f;
}

// ---------- Check drafts (minutes approval queue) ----------

export type Draft = { id: string; task: string; ownerId: string | null; dueOn: string | null };
export type OpenTask = { id: string; title: string; note?: string | null };

// The rules, in code. Jev never decides whether a draft has an owner or a date.
export type Readiness = 'ready' | 'needs_owner' | 'needs_date' | 'needs_both';
export const readinessOf = (d: Pick<Draft, 'ownerId' | 'dueOn'>): Readiness =>
  !d.ownerId && !d.dueOn ? 'needs_both' : !d.ownerId ? 'needs_owner' : !d.dueOn ? 'needs_date' : 'ready';

export const CLARITY_LEVELS = [
  'Not a task: a remark, a topic or background',
  'A task, but vague: it is not clear what to do or what done looks like',
  'A clear task that one person can do and finish',
];
export type Wording = 'not_a_task' | 'vague' | 'clear';
export const WORDING = ['not_a_task', 'vague', 'clear'] as const;

const STOP = new Set(['the', 'and', 'for', 'with', 'from', 'that', 'this', 'will', 'our', 'new', 'task', 'check', 'send']);
const words = (s: string) => new Set(tokensOf(s).filter((w) => w.length >= 3 && !STOP.has(w)));

// Candidates are found by code first: open tasks that share enough of the draft's words. Jev only judges those few.
export const DUP_SHARE = 0.34;
export const DUP_PER_DRAFT = 2;
export const MAX_DRAFTS = 20;
export function duplicateCandidates(draft: string, open: OpenTask[], per = DUP_PER_DRAFT): OpenTask[] {
  const a = words(draft);
  if (!a.size) return [];
  return open
    .map((o) => { const b = words(o.title); let hit = 0; for (const w of a) if (b.has(w)) hit++; return { o, share: hit / Math.min(a.size, Math.max(1, b.size)) }; })
    .filter((x) => x.share >= DUP_SHARE)
    .sort((x, y) => y.share - x.share)
    .slice(0, per)
    .map((x) => x.o);
}

export type DraftCheck = {
  id: string; readiness: Readiness; wording: Wording | null; // null: Jev was not sure, or not asked
  duplicate: { taskId: string; title: string } | null;
};
export type CheckOut = { ok: true; checks: DraftCheck[] } | { ok: false; reason: 'off' | 'unavailable' };

export function draftQuestions(drafts: Draft[], open: OpenTask[]): { questions: Record<string, JevQuestion>; cands: Record<string, OpenTask[]> } {
  const questions: Record<string, JevQuestion> = {};
  const cands: Record<string, OpenTask[]> = {};
  drafts.forEach((d, i) => {
    questions[`w${i}`] = {
      type: 'score',
      instructions: { draft_task: clip(d.task, 300), question: 'How clear is `draft_task` as a task to put on a list? Judge the wording only. Who does it and by when are checked elsewhere.' },
      criteria: CLARITY_LEVELS,
    };
    cands[`d${i}`] = duplicateCandidates(d.task, open);
    cands[`d${i}`].forEach((o, j) => {
      questions[`d${i}_${j}`] = {
        type: 'noul',
        instructions: { draft_task: clip(d.task, 300), existing_task: clip(o.title, 200), question: 'Is `draft_task` the same piece of work as `existing_task`? The same work, not just the same subject.' },
        criteria: { true: 'Both describe the same piece of work.', false: 'They are different pieces of work.' },
      };
    });
  });
  return { questions, cands };
}

// Pure: answers to checks. Rules from code, wording and duplicate only when sure.
export function combineChecks(drafts: Draft[], cands: Record<string, OpenTask[]>, answers: Record<string, JevAnswer>): DraftCheck[] {
  return drafts.map((d, i) => {
    const s = readScore(answers[`w${i}`], CLARITY_LEVELS.length);
    const dup = (cands[`d${i}`] ?? []).find((_, j) => isYes(answers[`d${i}_${j}`]));
    return {
      id: d.id,
      readiness: readinessOf(d),
      wording: s === null ? null : WORDING[Math.round(s)],
      duplicate: dup ? { taskId: dup.id, title: dup.title } : null,
    };
  });
}

export async function checkDrafts(db: Tx, teamId: string, drafts: Draft[], open: OpenTask[], env?: Env): Promise<CheckOut> {
  if (!jevOn(env)) return { ok: false, reason: 'off' };
  const list = drafts.slice(0, MAX_DRAFTS);
  if (!list.length) return { ok: false, reason: 'unavailable' };
  try {
    const dict = await dictOf(db, teamId);
    if (!dict) return { ok: false, reason: 'unavailable' };
    const { questions, cands } = draftQuestions(list, open);
    const r: JevResult = await jevAsk({ draft_count: list.length }, questions, { dict, env });
    if (!r.ok) return { ok: false, reason: 'unavailable' };
    return { ok: true, checks: combineChecks(list, cands, r.answers) };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}

// ---------- Project guess (a new task) ----------

export const MAX_PROJECTS = 25;
export type ProjectOpt = { id: string; department: string; intro: string | null; workstreams: string[] };
export const NONE_OF_THESE = 'None of these';

// Options are labelled P1, P2 ...: project names are masked before they leave, so the label carries no name.
// What helps Jev is the department, the workstreams and the first lines of what the project is for.
export function projectQuestion(projects: ProjectOpt[]): JevQuestion {
  const criteria: Record<string, string | null> = {};
  projects.forEach((p, i) => {
    criteria[`P${i + 1}`] = [`Department: ${p.department}`, p.workstreams.length ? `Sub-projects: ${p.workstreams.join(', ')}` : '', p.intro ? `About: ${clip(p.intro, 160)}` : ''].filter(Boolean).join('. ');
  });
  criteria[NONE_OF_THESE] = 'The task does not clearly belong to any of the projects listed.';
  return {
    type: 'choice',
    instructions: 'Which of the listed projects does `task` belong to? Pick None of these when it is not clear.',
    criteria,
  };
}

// Pure. A pick counts above the floor and when it is a real option. Otherwise no suggestion.
export function readProject(a: JevAnswer | undefined, projects: ProjectOpt[]): string | null {
  if (!a || typeof a.choice !== 'string') return null;
  const p = a.probabilities?.[a.choice];
  if (typeof p !== 'number' || p < FLOOR) return null;
  const m = /^P(\d+)$/.exec(a.choice);
  return m ? projects[Number(m[1]) - 1]?.id ?? null : null;
}

export async function guessProject(db: Tx, teamId: string, title: string, projects: ProjectOpt[], env?: Env): Promise<string | null> {
  const text = title.trim();
  const list = projects.slice(0, MAX_PROJECTS);
  if (!jevOn(env) || text.length < 3 || list.length < 2) return null;
  try {
    const dict = await dictOf(db, teamId);
    if (!dict) return null;
    const r = await jevAsk({ task: clip(text, 200) }, { project: projectQuestion(list) }, { dict, env });
    return r.ok ? readProject(r.answers.project, list) : null;
  } catch {
    return null;
  }
}

export { RISK_DAYS };
