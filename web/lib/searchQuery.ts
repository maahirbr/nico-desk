import type { Task } from './derive';
import { editDistance, fold } from './fuzzy';
import { flagKeyOf, statusOf } from './flags';
import { match, type Named } from './quickadd';
import { addDays, mondayOf } from './time';

// The query box understands a few filters next to plain words (workstream 9, 13 Oct):
//   is:late  is:blocked  is:done  is:mine  ...   status words and flags worked out from the dates
//   @name                                         the owner of a task (or the owner or lead of a project)
//   #project                                      one project: the project, its tasks, its plan lines, its comments
//   due:today  due:week                           open tasks due today, or in this week (Monday to Sunday)
// Words and filters mix: "is:late @sam deck". A filter that is half typed ("is:b") means the one value it can only
// be; if it could be two ("is:d"), it waits. An is: or due: filter narrows to tasks and the comments on them. All of this
// is pure: no database, so every rule has a test.

export const IS_VALUES = ['todo', 'doing', 'blocked', 'done', 'dropped', 'open', 'late', 'atrisk', 'ahead', 'ontime', 'mine'] as const;
export type IsValue = (typeof IS_VALUES)[number];
// Other ways to write a value.
const IS_ALIAS: Record<string, IsValue> = {
  notstarted: 'todo', unstarted: 'todo', inprogress: 'doing', progress: 'doing', started: 'doing', 'at-risk': 'atrisk', at_risk: 'atrisk',
  'on-time': 'ontime', on_time: 'ontime', overdue: 'late', closed: 'done', finished: 'done',
};
export const DUE_VALUES = ['today', 'week'] as const;
export type DueValue = (typeof DUE_VALUES)[number];

export type ParsedQuery = { words: string[]; is: IsValue[]; due: DueValue | null; owners: string[]; projects: string[] };

function resolveIs(v: string): IsValue | 'wait' | null {
  const x = v.replace(/[\s]/g, '');
  if (!x) return 'wait';
  if ((IS_VALUES as readonly string[]).includes(x)) return x as IsValue;
  if (IS_ALIAS[x]) return IS_ALIAS[x];
  const starts = [...new Set([...IS_VALUES.filter((k) => k.startsWith(x)), ...Object.entries(IS_ALIAS).filter(([a]) => a.startsWith(x)).map(([, k]) => k)])];
  if (starts.length === 1) return starts[0];
  if (starts.length > 1) return 'wait';
  if (x.length >= 4) {
    const near = IS_VALUES.filter((k) => editDistance(x, k, 1) <= 1);
    if (near.length === 1) return near[0];
  }
  return null;
}

function resolveDue(v: string): DueValue | 'wait' | null {
  if (!v) return 'wait';
  const hits = DUE_VALUES.filter((k) => k.startsWith(v));
  return hits.length === 1 ? hits[0] : null;
}

export function parseQuery(q: string): ParsedQuery {
  const out: ParsedQuery = { words: [], is: [], due: null, owners: [], projects: [] };
  for (const raw of q.split(/\s+/).filter(Boolean)) {
    const t = fold(raw);
    const kv = /^(is|due):(.*)$/.exec(t);
    if (kv) {
      const r = kv[1] === 'is' ? resolveIs(kv[2]) : resolveDue(kv[2]);
      if (r === 'wait') continue;
      if (r) { if (kv[1] === 'is') out.is.push(r as IsValue); else out.due = r as DueValue; continue; }
    } else if (t[0] === '@' || t[0] === '#') {
      const name = t.slice(1);
      if (name) (t[0] === '@' ? out.owners : out.projects).push(name);
      continue;
    }
    if (out.words.length < 8) out.words.push(t);
  }
  return out;
}

// The parsed query with @ and # turned into ids. A null set means no such filter. An empty set means the filter named
// nobody, so nothing can pass it. Projects are matched only among the ones the caller passes (the ones the reader may see).
export type Filters = { is: IsValue[]; due: DueValue | null; owners: Set<string> | null; projects: Set<string> | null; any: boolean; taskOnly: boolean };

// A name that is not found as typed is looked for again with a typo allowed, by one word of the name.
function pick(words: string[], items: Named[]): Set<string> {
  const ids = new Set<string>();
  for (const w of words) {
    const m = match(w, items);
    if (m.status === 'matched') ids.add(m.item.id);
    else if (m.status === 'ambiguous') for (const i of m.items) ids.add(i.id);
    else {
      const f = fold(w).replace(/[^a-z0-9]/g, '');
      const k = f.length <= 3 ? 0 : f.length <= 7 ? 1 : 2;
      for (const i of items) if (k && fold(i.name).split(/[^a-z0-9]+/).some((n) => editDistance(f, n, k) <= k)) ids.add(i.id);
    }
  }
  return ids;
}

export function resolveFilters(p: ParsedQuery, people: Named[], projects: Named[]): Filters {
  const owners = p.owners.length ? pick(p.owners, people) : null;
  const proj = p.projects.length ? pick(p.projects, projects) : null;
  const taskOnly = p.is.length > 0 || p.due !== null;
  return { is: p.is, due: p.due, owners, projects: proj, any: taskOnly || owners !== null || proj !== null, taskOnly };
}

export type Viewer = { meId: string; today: string };

function isOk(t: Task, v: IsValue, me: Viewer): boolean {
  switch (v) {
    case 'todo': case 'doing': case 'blocked': case 'done': case 'dropped': return statusOf(t) === v;
    case 'open': return t.statusCategory === 'open';
    case 'late': return flagKeyOf(t, me.today) === 'late';
    case 'atrisk': return flagKeyOf(t, me.today) === 'at_risk';
    case 'ahead': return flagKeyOf(t, me.today) === 'ahead';
    case 'ontime': return flagKeyOf(t, me.today) === 'on_time';
    case 'mine': return t.ownerId === me.meId;
  }
}

export function taskPasses(t: Task, f: Filters, me: Viewer): boolean {
  if (f.owners && !f.owners.has(t.ownerId)) return false;
  if (f.projects && !(t.projectId && f.projects.has(t.projectId))) return false;
  if (!f.is.every((v) => isOk(t, v, me))) return false;
  if (f.due) {
    const from = f.due === 'today' ? me.today : mondayOf(me.today);
    const to = f.due === 'today' ? me.today : addDays(from, 6);
    if (t.statusCategory !== 'open' || t.dueOn < from || t.dueOn > to) return false;
  }
  return true;
}

// A project, a plan line or a comment on a project: no status or date to test, so the task-only filters drop it.
export function otherPasses(f: Filters, facts: { projectId: string | null; owners: (string | null)[] }): boolean {
  if (f.taskOnly) return false;
  if (f.owners && !facts.owners.some((o) => o && f.owners!.has(o))) return false;
  if (f.projects && !(facts.projectId && f.projects.has(facts.projectId))) return false;
  return true;
}
