// Pasted notes, read as blocks: one block per task, with the lines that belong to it. Quick Add (lib/sentence.ts) and
// the minutes reader (plainParse in lib/planUtil.ts) both read pasted lines here, so neither makes a task of every line.
//
// Rules, kept small on purpose:
//  - A sentence broken across lines is one line again: the next line goes on when the line before ends mid-sentence
//    ("for the", a comma) or the next line starts in lower case and does not start a task.
//  - Greetings, sign-offs and labels ("Hi team", "Thanks all", "Attendees: ...", "Agenda", "Notes from ...") are noise.
//  - A heading names the context for the lines under it: a line ending in ":", a **bold** or # line, or a short line
//    that is not a task and has bullets or deeper lines under it. Labels like "Next steps" give no context.
//  - A line deeper than the task above it is a detail of that task. So is a plain statement ("The vendor said ...").
//  - "All by Friday" dates every task in its section that has no date of its own.
//  - If nothing reads as a task, every line that is not noise is one, as before.

export type Block = { text: string; details: string[]; heading: string; due: string };
type Named = (words: string) => boolean;
type Line = { indent: number; marked: boolean; text: string; raw: string };

const MARK = /^(?:\d{1,3}[.)]|[a-z][.)]|[-*•●○■▪◦‣–]|\[[ xX]?\])\s+/;
const VERBS = new Set(('add agree align approve arrange ask assign book brief build buy call cancel change chase check circulate clean '
  + 'close collect compile complete confirm contact coordinate create decide define deliver design discuss do draft edit email '
  + 'ensure estimate finalise finalize find fix follow forward gather get give go handle hire implement inform invite investigate '
  + 'launch list look mail make map meet message move order organise organize outline pay phone ping pick plan post prepare '
  + 'present price print prioritise prioritize publish pull push put raise reach read reconcile record reply report request '
  + 'research reschedule reserve resolve review revise rewrite run schedule send set settle share ship shortlist sign sort '
  + 'source speak start submit summarise summarize sync take talk test track update upload verify visit write').split(' '));
const ASKS = /^(?:ask|tell|get|remind|have|request|nudge|can|cn|could|would|please|pls|kindly|i\s+need|i\s+have|i\s+want|i\s+must|i\s+should|we\s+need|we\s+have|we\s+should|i'll|i\s+will|we'll|we\s+will|let's|let\s+us)\b/i;
const SAYS = /^[A-Z][\p{L}'.-]*(?:\s+[A-Z][\p{L}'.-]*)?(?::\s|\s+(?:to|should|will|must|can|needs?\s+to|has\s+to|is\s+to)\s)/u;
export const PRONOUN = /^((?:he|she|they)\s+)(?=(?:should|will|must|can|needs?\s+to|has\s+to|have\s+to|is\s+to|also)\b)/i;
const STATEMENT = /\b(?:is|are|was|were|said|says|agreed|decided|mentioned|noted|wants|wanted|felt|feels|thinks|thought|went|came|seems|looks|has\s+been|have\s+been|had)\b/i;
const ASIDE = /^(?:fyi|nb|note|context|background)\b/i;
const NOISE = [
  /^(?:thanks|thank\s+you|thx|ty|cheers|regards|best|kind\s+regards|warm\s+regards)\b[^.?]{0,24}[.!]?$/i,
  /^sent\s+from\s+my\b/i,
  /^(?:attendees|present|participants|absent|apologies|agenda|date|time|location|duration)\b\s*(?::|$)/i,
];
const GREETING = /^(?:hi|hey|hello|dear|good\s+(?:morning|afternoon|evening))\b(?:\s+(?:team|all|everyone|folks|guys|there|both))?[,!.:]?\s*/i;
const RECAP = /\b(?:notes|minutes|recap|summary)\b(?:\s+(?:from|for|of|on)\b|[\s:.]*$)/i;
const LABEL = /^(?:next\s+steps|action\s+items|actions|to-?dos?|follow-?ups|tasks|decisions|notes|summary|agenda)$/i;
const SHARED_DUE = /^(?:all|both|everything|each|all\s+of\s+(?:this|these|them|the\s+above))\s+(?:(?:is|are|should\s+be|to\s+be)\s+)?(?:done\s+)?((?:due\s+)?(?:by|before|on)\s+.+?|due\s+.+?)[.!]?$/i;
const WRAP_END = /(?:,|\b(?:the|a|an|to|for|of|and|or|with|on|in|at|by|from|about|into|our|their|his|her|its|this|that|these|those|be|as))$/i;

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
const words = (s: string) => clean(s).split(' ').filter(Boolean);
export const startsWithVerb = (t: string) => VERBS.has((words(t)[0] ?? '').toLowerCase().replace(/[^a-z]/g, ''));

// Reads as a job someone does: an ask, a verb first, "Name to ...", "(Name) ...", "he should ...", or a name and more.
export function actsLike(t: string, named?: Named): boolean {
  const s = clean(t);
  if (ASKS.test(s) || startsWithVerb(s) || SAYS.test(s) || PRONOUN.test(s) || /^\([^)]+\)\s*\S/.test(s)) return true;
  if (!named || named(s.replace(/[,:]$/, ''))) return false;
  const w = words(s);
  return named(w[0].replace(/[,:]$/, '')) || (w.length > 2 && named(`${w[0]} ${w[1]}`.replace(/[,:]$/, '')));
}

// A plain statement or an aside: context for a task, not a task.
export const isContext = (t: string, named?: Named) => !actsLike(t, named) && (STATEMENT.test(t) || ASIDE.test(clean(t)));

function isNoise(t: string, named?: Named): boolean {
  if (NOISE.some((r) => r.test(t))) return true;
  const g = GREETING.exec(t);
  if (g && g[0].length) {
    const rest = t.slice(g[0].length);
    if (!rest || (!actsLike(rest, named) && words(rest).length <= 8)) return true;
  }
  return words(t).length <= 8 && RECAP.test(t) && !actsLike(t, named);
}

function lines(input: string): (Line | null)[] {
  return input.replace(/\r\n?/g, '\n').split('\n').map((raw) => {
    if (!raw.trim()) return null;
    const lead = /^[ \t]*/.exec(raw)![0];
    const indent = [...lead].reduce((n, c) => n + (c === '\t' ? 4 : 1), 0);
    const body = raw.slice(lead.length);
    const marked = MARK.test(body);
    return { indent, marked, raw: body.trim(), text: clean(body.replace(MARK, '')) };
  });
}

// Physical lines into logical ones: a wrapped sentence is joined back.
function unwrap(ls: (Line | null)[], named?: Named): (Line | null)[] {
  const out: (Line | null)[] = [];
  for (const l of ls) {
    const prev = out.at(-1);
    if (l && prev && !l.marked && !/[.?!:;]$/.test(prev.text) && !/^(?:#|\*\*)/.test(l.raw)
      && (WRAP_END.test(prev.text) || (/^[a-z]/.test(l.text) && !actsLike(l.text, named)) || (prev.marked && l.indent > prev.indent && !actsLike(l.text, named)))) {
      out[out.length - 1] = { ...prev, text: `${prev.text} ${l.text}` };
    } else out.push(l);
  }
  return out;
}

export function readBlocks(input: string, named?: Named): Block[] {
  const ls = unwrap(lines(input), named);
  const out: (Block & { section: number })[] = [];
  const dues = new Map<number, string>();
  let heading: { text: string; indent: number; tasks: number } | null = null;
  let section = 0;
  let last: { indent: number; block: Block } | null = null;
  let blank = false;

  for (let i = 0; i < ls.length; i++) {
    const l = ls[i];
    if (!l) { blank = true; continue; }
    const text = l.text.replace(/\*\*/g, '').replace(/^#+\s*/, '').trim();
    if (!text || isNoise(text, named)) { blank = false; continue; }

    const shared = SHARED_DUE.exec(text);
    if (shared) { dues.set(section, shared[1]); blank = false; continue; }

    const next = ls.slice(i + 1).find((x): x is Line => !!x);
    const bare = /^(?:#+\s|\*\*[^*]+\*\*:?$)/.test(l.raw) || /:$/.test(text);
    const parent = !!next && (next.indent > l.indent || (next.marked && !l.marked)) && words(text).length <= 5
      && !/[.?!]$/.test(text) && !actsLike(text, named);
    if (bare || parent) {
      const h = text.replace(/:$/, '').trim();
      heading = { text: LABEL.test(h) ? '' : h, indent: l.indent, tasks: 0 };
      section++; last = null; blank = false;
      continue;
    }

    if (last && l.indent > last.indent) { last.block.details.push(text); blank = false; continue; }
    if (blank && heading?.tasks && !l.marked && l.indent <= heading.indent) { heading = null; section++; }
    blank = false;
    if (isContext(text, named)) { if (last) last.block.details.push(text); continue; }

    const block = { text, details: [], heading: heading?.text ?? '', due: '', section };
    out.push(block);
    if (heading) heading.tasks++;
    last = { indent: l.indent, block };
  }

  if (!out.length) {
    return ls.filter((l): l is Line => !!l)
      .map((l) => l.text.replace(/\*\*/g, '').replace(/^#+\s*/, '').trim())
      .filter((t) => t && !isNoise(t, named))
      .map((text) => ({ text, details: [], heading: '', due: '' }));
  }
  return out.map(({ section: s, ...b }) => ({ ...b, due: dues.get(s) ?? '' }));
}
