import type { Tx } from './db';
import type { Task } from './derive';
import { jevAsk, type JevQuestion, type JevResult } from './jev';
import { maskDictFor, type MaskDict } from './redact';

// Status nudge (use case 9). When a person writes a note on a task, Jev reads the words and picks the status they
// imply. If that differs from the current status and Jev is sure enough, the UI offers it. Nothing here writes:
// the person clicks, and the click goes through the normal service rules.

export type StatusKey = 'todo' | 'doing' | 'blocked' | 'done' | 'dropped';
export const WORD: Record<StatusKey, string> = { todo: 'Not started', doing: 'In progress', blocked: 'Blocked', done: 'Done', dropped: 'Dropped' };
const NO_CHANGE = 'No change';

// From evals/jev/run.ts: the probability Jev must give its pick before the UI offers it. In the eval (40 notes,
// masked and raw) the first threshold with no wrong offer was 0.5. This adds 0.15 of room.
export const THRESHOLD = 0.65;

// Same five words as the status menu (statusKey in components/task-ui.tsx, which is a client file).
export function currentStatus(t: Pick<Task, 'statusCategory' | 'blocked' | 'health'>): StatusKey {
  if (t.statusCategory === 'done') return 'done';
  if (t.statusCategory === 'dropped') return 'dropped';
  if (t.blocked) return 'blocked';
  if (!t.health || t.health === 'not_started') return 'todo';
  return 'doing';
}

export function statusQuestion(): JevQuestion {
  return {
    type: 'choice',
    instructions: 'Read `note`, written on the task `task_title`. Which status do its words say the task is in now? Pick No change when the note only gives a detail, a link, a question or a plan and does not say the status changed. `status_now` is only for reference: never pick it just because it is the current one.',
    criteria: {
      [WORD.todo]: 'The note says work has not begun, or the task is waiting for its start.',
      [WORD.doing]: 'The note says someone is working on it, has started it or is part way through.',
      [WORD.blocked]: 'The note says progress is stopped by someone or something else: a person, a decision, an approval, a delivery or access.',
      [WORD.done]: 'The note says the task is finished, sent, shipped, approved or handed over.',
      [WORD.dropped]: 'The note says the task is cancelled, no longer needed or will not be done.',
      [NO_CHANGE]: 'The note does not say the status changed.',
    },
  };
}

export type StatusPick = { choice: StatusKey | null; p: number }; // null is No change
// Reads a Choice answer. p is the probability of the picked option.
export function readPick(a: { choice?: string; probabilities?: Record<string, number> } | undefined): StatusPick | null {
  if (!a || typeof a.choice !== 'string') return null;
  const p = a.probabilities?.[a.choice];
  if (typeof p !== 'number') return null;
  const key = (Object.keys(WORD) as StatusKey[]).find((k) => WORD[k] === a.choice);
  if (key) return { choice: key, p };
  return a.choice === NO_CHANGE ? { choice: null, p } : null;
}

// The decision: offer a status only when it differs from the current one and Jev is sure enough.
export function decide(pick: StatusPick | null, current: StatusKey, threshold = THRESHOLD): StatusKey | null {
  if (!pick || pick.choice === null || pick.choice === current) return null;
  return pick.p >= threshold ? pick.choice : null;
}

export type Suggestion = { status: StatusKey; word: string; p: number } | null;

// Never throws. Null means no offer: Jev off, slow or failed, a closed task, an empty note, or not sure enough.
export async function suggestStatus(db: Tx, teamId: string, t: Task, note: string): Promise<Suggestion> {
  const text = note.trim();
  if (!text || t.statusCategory !== 'open') return null;
  const current = currentStatus(t);
  const dict = await maskDictFor(db, teamId).catch(() => null);
  if (!dict) return null;
  const r = await askStatus(dict, t.title, current, text);
  if (!r.ok) return null;
  const pick = readPick(r.answers.status as never);
  const status = decide(pick, current);
  return status && pick ? { status, word: WORD[status], p: pick.p } : null;
}

// The one place the question is sent from, so the eval measures exactly what the app asks.
export function askStatus(dict: MaskDict, title: string, current: StatusKey, note: string, env?: Record<string, string | undefined>): Promise<JevResult> {
  return jevAsk({ task_title: title, status_now: WORD[current], note }, { status: statusQuestion() }, { dict, env });
}
