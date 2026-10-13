import { addDays, mondayOf } from './time';
import { match, parseQuickAdd, type Named } from './quickadd';

// Quick add, said the way a person talks: "Can you ask Sam to send me the updated design files by Monday for
// the landing page" becomes one task: title, owner, due date and project. A pure function, so every rule is tested. The server
// asks the model first when it is switched on (lib/sentenceRead.ts) and falls back to these rules. Either way it only
// fills the form: every field stays editable and nothing is made until the person presses Add task.
//
// Rules, kept small on purpose:
//  - Polite openers go: "hey", "can you", "could you please", "please", and a closing "please", "thanks" or "?".
//  - "ask / tell / get / remind / have / request NAME to ..." and "NAME to / should / needs to / has to ..." give the
//    owner, when NAME is one person on the roster. Without a match the words stay in the title.
//  - "for / on / in (the) PROJECT (project)" anywhere names the project, when it matches a project the person can see.
//  - The date comes from quick add's own rules (the end of the line), plus "end of (the) week", "this week",
//    "next week", "end of day", "eod" and "tonight".
//  - "send me / give me / share with me / email me / show me" become "... to <writer>", and any other "me" becomes the
//    writer's first name, so the task reads right from the owner's side.
//  - @name and #project still work, as in quick add.

export type SentenceCtx<P extends Named, R extends Named> = { today: string; people: P[]; projects: R[]; meName: string };
export type SentenceRead = { title: string; ownerId: string | null; dueOn: string | null; projectId: string | null; notes: string[] };

// Typos are common when typing fast or dictating, so "yuo", "u" and "cn" count too.
const OPENERS = /^(?:(?:hey|hi|hello|ok|okay)\b[,!.]?\s*)?(?:(?:can|cn|could|would|will)\s+(?:you|yuo|yu|u)\s+)?(?:please\s+|pls\s+|plz\s+|kindly\s+)?/i;
const CLOSERS = /[\s,]*(?:please|pls|thanks|thank you|thx)?[\s.?!]*$/i;
const LEADING_JOINER = /^(?:(?:and|plus)\s+)?(?:then|also|one more thing|one more)?[,:]?\s*/i;
const VOCATIVE_NEXT = new Set(['can', 'cn', 'could', 'would', 'will', 'please', 'pls', 'plz', 'kindly']);
const ASK = /^(?:ask|tell|get|remind|have|request|nudge)\s+(.+?)\s+to\s+(.+)$/i;
const SAYS = /^(.+?)\s+(?:to|should|needs to|need to|has to|must|will|can)\s+(.+)$/i;
const TO_ME = /^(send|give|show|share|email|mail|forward|pass)\s+me\s+(.+)$/i;
const WITH_ME = /\b(share|check|confirm|discuss|align|sync)\s+with\s+me\b/i;

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
const firstName = (s: string) => clean(s).split(' ')[0] ?? s;
const upper = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// One person for a name of one or two words, or nobody. Only whole first names or whole names count here, so an
// ordinary word ("Design to ...") never turns into an owner.
function person<P extends Named>(words: string, people: P[]): P | null {
  const w = clean(words).replace(/^@/, '');
  if (!w || w.split(' ').length > 3) return null;
  const m = match(w, people);
  if (m.status !== 'matched') return null;
  const n = m.item.name.toLowerCase();
  const lw = w.toLowerCase();
  return n === lw || n.split(' ')[0] === lw ? m.item : null;
}

// Phrases quick add does not know, turned into an ISO date at the end of the line, where it reads dates.
function datePhrases(input: string, today: string): string {
  // @ and # words at the end are set aside, as quick add does, so "by eod @sam" still finds the date.
  const tail = /(?:\s+[@#][^\s]+)+$/.exec(input)?.[0] ?? '';
  const s = tail ? input.slice(0, -tail.length) : input;
  const friday = addDays(mondayOf(today), 4);
  const rules: [RegExp, string][] = [
    [/\s+(?:by\s+)?(?:the\s+)?end\s+of\s+(?:the\s+)?(?:this\s+)?week$/i, friday >= today ? friday : addDays(friday, 7)],
    [/\s+(?:by\s+)?(?:eow|this\s+week)$/i, friday >= today ? friday : addDays(friday, 7)],
    [/\s+(?:by\s+)?next\s+week$/i, addDays(mondayOf(today), 7)],
    [/\s+(?:by\s+)?(?:the\s+)?(?:end\s+of\s+(?:the\s+)?day|eod|tonight)$/i, today],
  ];
  for (const [re, d] of rules) if (re.test(s)) return s.replace(re, ` ${d}`) + tail;
  return input;
}

export function readSentenceRules<P extends Named, R extends Named>(input: string, ctx: SentenceCtx<P, R>): SentenceRead {
  const notes: string[] = [];
  let s = clean(input).replace(LEADING_JOINER, '').replace(CLOSERS, '');

  // Spoken to a person first: "Sam, can you ...", "Sam please ...". The name is the owner.
  let ownerId: string | null = null;
  const w = s.split(' ');
  for (const n of [2, 1]) {
    const said = w.slice(0, n).join(' ');
    const next = (w[n] ?? '').toLowerCase();
    const who = w.length > n ? person(said.replace(/[,:]$/, ''), ctx.people) : null;
    if (who && (/[,:]$/.test(said) || VOCATIVE_NEXT.has(next))) { ownerId = who.id; s = w.slice(n).join(' '); break; }
  }
  s = s.replace(OPENERS, '');

  // The project, anywhere: the longest name first, so "AI studio" wins over "AI".
  let projectId: string | null = null;
  for (const p of [...ctx.projects].sort((a, b) => b.name.length - a.name.length)) {
    const re = new RegExp(`\\s*\\b(?:for|on|in|under)\\s+(?:the\\s+)?${escape(p.name)}(?:\\s+project)?\\b`, 'i');
    if (re.test(s)) { projectId = p.id; s = clean(s.replace(re, ' ')); break; }
  }

  // A project named anywhere else ("a Spring hamper strategy meeting") counts too, and stays in the title.
  if (!projectId) {
    for (const p of [...ctx.projects].sort((a, b) => b.name.length - a.name.length)) {
      if (new RegExp(`(?<![\\p{L}\\p{N}])${escape(p.name)}(?![\\p{L}\\p{N}])`, 'iu').test(s)) { projectId = p.id; break; }
    }
  }

  // The owner: "ask Sam to ..." or "Sam to ...".
  const ask = ownerId ? null : ASK.exec(s);
  if (ownerId) { /* named first */ } else if (ask) {
    const who = person(ask[1], ctx.people);
    if (who) { ownerId = who.id; s = ask[2]; } else notes.push(`No one on the team is called "${clean(ask[1])}", so pick the owner below.`);
  } else {
    const says = SAYS.exec(s);
    const who = says ? person(says[1], ctx.people) : null;
    if (says && who) { ownerId = who.id; s = says[2]; }
  }

  // "I need to ..." is the writer's own task.
  const self = /^(?:i|we)\s+(?:need|have|want|will|should|must|got)\s+to\s+|^i(?:'ll|\s+will)\s+/i;
  if (!ownerId && self.test(s)) {
    const mine = ctx.people.find((p) => p.name.toLowerCase() === ctx.meName.toLowerCase());
    if (mine) ownerId = mine.id;
    s = s.replace(self, '');
  }

  // "me" is the writer, seen from the owner's side.
  const me = firstName(ctx.meName);
  const toMe = TO_ME.exec(s);
  if (toMe) {
    const rest = datePhrases(toMe[2], ctx.today);
    const q = parseQuickAdd(rest, ctx);
    s = `${toMe[1]} ${q.title} to ${me}${q.dueOn ? ` ${q.dueOn}` : ''}`;
  }
  s = s.replace(WITH_ME, `$1 with ${me}`).replace(/\bme\b/gi, me).replace(/\bmy\b/gi, `${me}'s`);

  const q = parseQuickAdd(datePhrases(s, ctx.today), ctx);
  if (!ownerId && q.owner?.status === 'matched') ownerId = q.owner.item.id;
  if (!projectId && q.project?.status === 'matched') projectId = q.project.item.id;
  const title = upper(clean(q.title).replace(/^(?:to|and)\s+/i, ''));
  return { title, ownerId, dueOn: q.dueOn, projectId, notes };
}

// ---------- several tasks in one go ----------
//
// "Sam, can you schedule the strategy meeting by Friday? And then Kabir, can you get back to the vendor by Monday."
// Pieces come from lines, list markers ("1.", "-"), sentence ends, and joining words ("and also", "and then", "also",
// "then", "one more") when what follows starts like a new task: a name, an ask word, or "I / we need to". A joining word
// inside one task ("send the deck and then the prices") stays, because what follows does not start a new task.

export const MAX_TASKS_AT_ONCE = 10;
const LIST_MARK = /^\s*(?:\d+[.)]|[-*•])\s+/;
const JOINER = /,?\s+(?:and\s+also|and\s+then|and|also|then|plus|one\s+more(?:\s+thing)?)[,:]?\s+/gi;
const STARTS_TASK = /^(?:ask|tell|get|remind|have|request|nudge|can|cn|could|would|please|pls|i\s+need|i\s+have|we\s+need|i\s+want|i'll|i\s+will)\b/i;

export function splitTasks<P extends Named>(input: string, people: P[]): string[] {
  const out: string[] = [];
  const startsTask = (t: string) => {
    const w = clean(t).split(' ');
    return STARTS_TASK.test(t) || !!person(w[0].replace(/[,:]$/, ''), people) || (w.length > 1 && !!person(`${w[0]} ${w[1]}`.replace(/[,:]$/, ''), people));
  };
  for (const line of input.split(/\n+/)) {
    for (const sentence of line.replace(LIST_MARK, '').split(/(?<=[.?!])\s+/)) {
      let rest = clean(sentence).replace(LEADING_JOINER, '');
      let piece = '';
      let m: RegExpExecArray | null;
      JOINER.lastIndex = 0;
      const parts: string[] = [];
      let from = 0;
      while ((m = JOINER.exec(rest))) {
        const after = rest.slice(m.index + m[0].length);
        if (startsTask(after)) { parts.push(rest.slice(from, m.index)); from = m.index + m[0].length; }
      }
      parts.push(rest.slice(from));
      for (piece of parts) {
        const t = clean(piece).replace(/^[,;:\s]+|[,;\s]+$/g, '');
        if (t.replace(/[^\p{L}\p{N}]/gu, '').length >= 3 && !/^(?:and|then|also|plus)$/i.test(t)) out.push(t);
      }
      rest = '';
    }
  }
  return out.slice(0, MAX_TASKS_AT_ONCE);
}

export function readTasksRules<P extends Named, R extends Named>(input: string, ctx: SentenceCtx<P, R>): SentenceRead[] {
  return splitTasks(input, ctx.people).map((t) => readSentenceRules(t, ctx)).filter((r) => r.title.length >= 3);
}

