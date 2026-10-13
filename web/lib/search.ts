import { plainOf } from './comments';
import type { Tx } from './db';
import { fold, scoreText } from './fuzzy';
import { planState, teamProjects } from './plan';
import { otherPasses, parseQuery, resolveFilters, taskPasses } from './searchQuery';
import { listPeople, teamTasks } from './service';
import { seesProject, seesTask, type Sight } from './sight';
import { hostOf } from './links';
import { today as todayIst } from './time';

// One search across the team's projects, tasks, plan lines, people and comments. Every word must match somewhere in
// the item, with a typo allowed (lib/fuzzy.ts); titles that match rank first, and a match by typo ranks a little lower.
// The query may also hold filters: is:late, @name, #project, due:week (lib/searchQuery.ts). Everything is checked
// against the reader's sight first (lib/sight.ts): a hidden project, task, plan line or comment never becomes a hit.

export type SearchHit =
  | { kind: 'project'; id: string; title: string; sub: string; href: string }
  | { kind: 'task'; id: string; title: string; sub: string; href: string; dueOn: string; open: boolean; overdue: boolean }
  | { kind: 'line'; id: string; title: string; sub: string; href: string }
  | { kind: 'person'; id: string; title: string; sub: string; href: string }
  | { kind: 'comment'; id: string; title: string; sub: string; href: string };

// An item plus the plain text Jev reads when it re-ranks (see jevSearch.ts). `r` is the local rank, lower first.
export type Cand = { hit: SearchHit; text: string; r: number; matched: number };
type Mode = 'strict' | 'loose' | 'pool';

const STOP = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'from', 'what', 'which', 'who', 'are', 'was', 'were', 'about', 'have', 'has', 'not', 'any', 'all', 'but', 'yet', 'still', 'something', 'things', 'thing', 'anything']);
// "waiting" -> "wait", "launches" -> "launch": enough to match across plain word forms.
const stem = (w: string) => { const r = w.replace(/(ing|ed|es|s)$/, ''); return r.length >= 4 ? r : w; };

// `meId` is the reader, for is:mine. Comments are searched here only; the candidates Jev reads (below) leave them out.
export async function search(db: Tx, teamId: string, sight: Sight, q: string, today = todayIst(), meId = ''): Promise<SearchHit[]> {
  return (await gather(db, teamId, sight, q, today, 'strict', meId, true)).slice(0, 60).map((c) => c.hit);
}

// Up to `max` candidates for Jev to re-rank: every item that matches all the words, then items that match some
// of them, then the soonest open tasks and the projects, so a query with no shared word still has a pool.
export async function searchCandidates(db: Tx, teamId: string, sight: Sight, q: string, today = todayIst(), max = 30, meId = ''): Promise<(Cand & { strict: boolean })[]> {
  const id = (c: Cand) => `${c.hit.kind}-${c.hit.id}`;
  const strict = await gather(db, teamId, sight, q, today, 'strict', meId, false);
  const seen = new Set(strict.map(id));
  const out = strict.slice(0, max).map((c) => ({ ...c, strict: true }));
  const add = (list: Cand[]) => { for (const c of list) if (out.length < max && !seen.has(id(c))) { seen.add(id(c)); out.push({ ...c, strict: false }); } };
  add((await gather(db, teamId, sight, q, today, 'loose', meId, false)).sort((a, b) => b.matched - a.matched || a.r - b.r));
  if (out.length < max) {
    const due = (c: Cand) => (c.hit.kind === 'task' ? c.hit.dueOn : '');
    add((await gather(db, teamId, sight, q, today, 'pool', meId, false)).sort((a, b) => (a.hit.kind === 'project' ? 0 : 1) - (b.hit.kind === 'project' ? 0 : 1) || due(a).localeCompare(due(b))));
  }
  return out;
}

// About 90 characters of the comment around the first word that matched.
function snippet(text: string, words: string[]): string {
  const low = text.toLowerCase();
  const at = Math.max(0, ...words.map((w) => low.indexOf(w)).filter((i) => i >= 0).slice(0, 1));
  const start = Math.max(0, at - 30);
  return `${start > 0 ? '…' : ''}${text.slice(start, start + 90)}${start + 90 < text.length ? '…' : ''}`;
}

async function gather(db: Tx, teamId: string, sight: Sight, q: string, today: string, mode: Mode, meId: string, withComments: boolean): Promise<Cand[]> {
  const parsed = parseQuery(q);
  const words = mode === 'strict' ? parsed.words : parsed.words.filter((w) => w.length >= 3 && !STOP.has(w)).map(stem);
  // Only what this viewer may see (lib/sight.ts): hidden projects, their tasks and plan lines never become hits, so Jev never reads them.
  const [allProjects, allTasks, people] = await Promise.all([teamProjects(db, teamId), teamTasks(db, teamId, today), listPeople(db, teamId)]);
  const projects = allProjects.filter((p) => seesProject(sight, p.id));
  const tasks = allTasks.filter((t) => seesTask(sight, t));
  const f = resolveFilters(parsed, people.map((p) => ({ id: p.id, name: p.displayName })), projects.map((p) => ({ id: p.id, name: p.name })));
  if (!words.length && !f.any && mode !== 'pool') return [];
  const me = { meId, today };
  const rank = (title: string) => { const m = scoreText(words, title); return m.matched === words.length ? 0 : 1; };
  const pname = Object.fromEntries(projects.map((p) => [p.id, p.name]));
  const name = Object.fromEntries(people.map((p) => [p.id, p.displayName]));
  const hits: Cand[] = [];
  // `hay` is what the words match against; `text` is what Jev reads. Both come from the same fields.
  const push = (hit: SearchHit, hay: string, r: number, text: string) => {
    const m = scoreText(words, hay);
    if (mode === 'strict' ? m.matched !== words.length : mode === 'loose' && m.matched === 0) return;
    hits.push({ hit, text, r: r + (m.fuzzy ? 0.25 : 0), matched: mode === 'strict' ? words.length : m.matched });
  };

  for (const p of projects) {
    if (f.any && !otherPasses(f, { projectId: p.id, owners: [p.ownerId, p.leadId] })) continue;
    push({ kind: 'project', id: p.id, title: p.name, sub: [p.eyebrow, `Lead: ${name[p.ownerId] ?? '?'}`].filter(Boolean).join(' · '), href: `/projects/${p.id}` },
      `${p.name} ${p.eyebrow ?? ''} ${p.intro ?? ''} ${p.phase ?? ''} ${p.workstreams.join(' ')} ${name[p.ownerId] ?? ''}`, rank(p.name),
      `Project: ${p.name}. ${p.intro ?? ''} ${p.eyebrow ?? ''}`.trim());
  }
  for (const t of tasks) {
    if (t.statusCategory === 'dropped' && !f.is.includes('dropped')) continue;
    if (mode === 'pool' && t.statusCategory !== 'open') continue;
    if (f.any && !taskPasses(t, f, me)) continue;
    const where = [t.projectId ? pname[t.projectId] : '', t.workstream ?? ''].filter(Boolean).join(' · ');
    const links = t.links.map((l) => `${l.label ?? ''} ${hostOf(l.url)}`).join(' ');
    push({ kind: 'task', id: t.id, title: t.title, sub: [name[t.ownerId], where].filter(Boolean).join(' · '), href: `/tasks/${t.id}`,
      dueOn: t.dueOn, open: t.statusCategory === 'open', overdue: t.overdue },
    `${t.title} ${t.description ?? ''} ${t.note ?? ''} ${where} ${name[t.ownerId] ?? ''} ${links}`, rank(t.title) + (t.statusCategory === 'open' ? 0 : 0.5),
    `Task: ${t.title}. ${t.description ?? ''} ${t.note ?? ''} Project: ${where || 'none'}. Status: ${t.blocked ? 'blocked' : t.statusCategory}. Due ${t.dueOn}.`);
  }
  if (mode !== 'pool') {
    if (!f.taskOnly) {
      for (const p of projects.filter((x) => x.kind === 'plan')) {
        const s = await planState(db, p.id);
        for (const l of s.lines) {
          if (f.any && !otherPasses(f, { projectId: p.id, owners: [l.ownerId] })) continue;
          push({ kind: 'line', id: l.id, title: `${l.num}. ${l.what}`, sub: `${p.name}${l.ownerId ? ` · ${name[l.ownerId]}` : ''}`, href: `/projects/${p.id}` },
            `${l.what} ${l.doneDef} ${l.note} ${l.partner} ${l.ownerWith} ${name[l.ownerId ?? ''] ?? ''} ${l.checkpoints.map((c) => c.label).join(' ')}`, rank(l.what),
            `Plan line in ${p.name}: ${l.what}. Done means: ${l.doneDef}. ${l.note}`);
        }
      }
    }
    if (!f.any) {
      for (const p of people.filter((x) => x.active)) {
        push({ kind: 'person', id: p.id, title: p.displayName, sub: `${p.role} · ${p.department}`, href: `/people/${p.id}` },
          `${p.displayName} ${p.role} ${p.department}`, rank(p.displayName), `Person: ${p.displayName}, ${p.role}, ${p.department}.`);
      }
    }
    // A comment is found by its words and opens the task or project it is on. Only comments on what the reader sees are read at all.
    if (withComments && words.length) {
      const taskById = new Map(tasks.map((t) => [t.id, t]));
      const projectById = new Map(projects.map((p) => [p.id, p]));
      const { rows } = await db.query<{ id: string; subject_kind: 'task' | 'project'; subject_id: string; body: string; author_name: string }>(
        `SELECT c.id, c.subject_kind, c.subject_id, c.body, p.display_name AS author_name FROM comments c JOIN people p ON p.id = c.author_id
         WHERE c.deleted_at IS NULL AND (c.subject_kind = 'task' AND c.subject_id IN (SELECT id FROM tasks WHERE team_id = $1)
           OR c.subject_kind = 'project' AND c.subject_id IN (SELECT id FROM projects WHERE team_id = $1))
         ORDER BY c.created_at DESC LIMIT 2000`, [teamId]);
      for (const c of rows) {
        const task = c.subject_kind === 'task' ? taskById.get(c.subject_id) : undefined;
        const project = c.subject_kind === 'project' ? projectById.get(c.subject_id) : undefined;
        if (!task && !project) continue; // hidden or missing: the comment is never read into a hit
        if (f.any && !(task ? taskPasses(task, f, me) : otherPasses(f, { projectId: project!.id, owners: [project!.ownerId, project!.leadId] }))) continue;
        const text = plainOf(c.body, (kind, id) => (kind === 'person' ? name[id] ?? null : kind === 'task' ? taskById.get(id)?.title ?? null : projectById.get(id)?.name ?? null));
        const on = task ? task.title : project!.name;
        push({ kind: 'comment', id: c.id, title: snippet(text, words), sub: `${c.author_name} on ${on}`, href: task ? `/tasks/${task.id}` : `/projects/${project!.id}` },
          text, 1.5, `Comment on ${on}: ${text}`);
      }
    }
  }
  const order = { project: 0, person: 1, task: 2, line: 3, comment: 4 };
  const due = (c: Cand) => (c.hit.kind === 'task' ? c.hit.dueOn : '');
  return hits.sort((a, b) => a.r - b.r || order[a.hit.kind] - order[b.hit.kind] || due(a).localeCompare(due(b)));
}
