import type { Tx } from './db';
import { planState, teamProjects } from './plan';
import { listPeople, teamTasks } from './service';
import { today as todayIst } from './time';

// One search across the team's projects, tasks, plan lines and people. Every word must match
// somewhere in the item; titles that match rank first.

export type SearchHit =
  | { kind: 'project'; id: string; title: string; sub: string; href: string }
  | { kind: 'task'; id: string; title: string; sub: string; href: string; dueOn: string; open: boolean; overdue: boolean }
  | { kind: 'line'; id: string; title: string; sub: string; href: string }
  | { kind: 'person'; id: string; title: string; sub: string; href: string };

// An item plus the plain text Jev reads when it re-ranks (see jevSearch.ts). `r` is the local rank, lower first.
export type Cand = { hit: SearchHit; text: string; r: number; matched: number };
type Mode = 'strict' | 'loose' | 'pool';

const STOP = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'from', 'what', 'which', 'who', 'are', 'was', 'were', 'about', 'have', 'has', 'not', 'any', 'all', 'but', 'yet', 'still', 'something', 'things', 'thing', 'anything']);
// "waiting" -> "wait", "launches" -> "launch": enough to match across plain word forms.
const stem = (w: string) => { const r = w.replace(/(ing|ed|es|s)$/, ''); return r.length >= 4 ? r : w; };

export async function search(db: Tx, teamId: string, q: string, today = todayIst()): Promise<SearchHit[]> {
  return (await gather(db, teamId, q, today, 'strict')).slice(0, 60).map((c) => c.hit);
}

// Up to `max` candidates for Jev to re-rank: every item that matches all the words, then items that match some
// of them, then the soonest open tasks and the projects, so a query with no shared word still has a pool.
export async function searchCandidates(db: Tx, teamId: string, q: string, today = todayIst(), max = 30): Promise<(Cand & { strict: boolean })[]> {
  const id = (c: Cand) => `${c.hit.kind}-${c.hit.id}`;
  const strict = await gather(db, teamId, q, today, 'strict');
  const seen = new Set(strict.map(id));
  const out = strict.slice(0, max).map((c) => ({ ...c, strict: true }));
  const add = (list: Cand[]) => { for (const c of list) if (out.length < max && !seen.has(id(c))) { seen.add(id(c)); out.push({ ...c, strict: false }); } };
  add((await gather(db, teamId, q, today, 'loose')).sort((a, b) => b.matched - a.matched || a.r - b.r));
  if (out.length < max) {
    const due = (c: Cand) => (c.hit.kind === 'task' ? c.hit.dueOn : '');
    add((await gather(db, teamId, q, today, 'pool')).sort((a, b) => (a.hit.kind === 'project' ? 0 : 1) - (b.hit.kind === 'project' ? 0 : 1) || due(a).localeCompare(due(b))));
  }
  return out;
}

async function gather(db: Tx, teamId: string, q: string, today: string, mode: Mode): Promise<Cand[]> {
  const raw = q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 8);
  const words = mode === 'strict' ? raw : raw.filter((w) => w.length >= 3 && !STOP.has(w)).map(stem);
  if (!words.length && mode !== 'pool') return [];
  const count = (hay: string) => words.filter((w) => hay.includes(w)).length;
  const has = (hay: string) => (mode === 'strict' ? words.every((w) => hay.includes(w)) : mode === 'loose' ? count(hay) > 0 : true);
  const matched = (hay: string) => (mode === 'strict' ? words.length : count(hay));
  const rank = (title: string) => (words.every((w) => title.toLowerCase().includes(w)) ? 0 : 1);
  const [projects, tasks, people] = await Promise.all([teamProjects(db, teamId), teamTasks(db, teamId, today), listPeople(db, teamId)]);
  const pname = Object.fromEntries(projects.map((p) => [p.id, p.name]));
  const name = Object.fromEntries(people.map((p) => [p.id, p.displayName]));
  const hits: Cand[] = [];
  // `hay` is what the words match against; `text` is what Jev reads. Both come from the same fields.
  const push = (hit: SearchHit, hay: string, r: number, text: string) => {
    const h = hay.toLowerCase();
    if (has(h)) hits.push({ hit, text, r, matched: matched(h) });
  };

  for (const p of projects) {
    push({ kind: 'project', id: p.id, title: p.name, sub: [p.eyebrow, `Lead: ${name[p.ownerId] ?? '?'}`].filter(Boolean).join(' · '), href: `/projects/${p.id}` },
      `${p.name} ${p.eyebrow ?? ''} ${p.intro ?? ''} ${p.phase ?? ''} ${p.workstreams.join(' ')} ${name[p.ownerId] ?? ''}`, rank(p.name),
      `Project: ${p.name}. ${p.intro ?? ''} ${p.eyebrow ?? ''}`.trim());
  }
  for (const t of tasks) {
    if (t.statusCategory === 'dropped') continue;
    if (mode === 'pool' && t.statusCategory !== 'open') continue;
    const where = [t.projectId ? pname[t.projectId] : '', t.workstream ?? ''].filter(Boolean).join(' · ');
    push({ kind: 'task', id: t.id, title: t.title, sub: [name[t.ownerId], where].filter(Boolean).join(' · '), href: `/tasks/${t.id}`,
      dueOn: t.dueOn, open: t.statusCategory === 'open', overdue: t.overdue },
    `${t.title} ${t.description ?? ''} ${t.note ?? ''} ${where} ${name[t.ownerId] ?? ''}`, rank(t.title) + (t.statusCategory === 'open' ? 0 : 0.5),
    `Task: ${t.title}. ${t.description ?? ''} ${t.note ?? ''} Project: ${where || 'none'}. Status: ${t.blocked ? 'blocked' : t.statusCategory}. Due ${t.dueOn}.`);
  }
  if (mode !== 'pool') {
    for (const p of projects.filter((x) => x.kind === 'plan')) {
      const s = await planState(db, p.id);
      for (const l of s.lines) {
        push({ kind: 'line', id: l.id, title: `${l.num}. ${l.what}`, sub: `${p.name}${l.ownerId ? ` · ${name[l.ownerId]}` : ''}`, href: `/projects/${p.id}` },
          `${l.what} ${l.doneDef} ${l.note} ${l.partner} ${l.ownerWith} ${name[l.ownerId ?? ''] ?? ''} ${l.checkpoints.map((c) => c.label).join(' ')}`, rank(l.what),
          `Plan line in ${p.name}: ${l.what}. Done means: ${l.doneDef}. ${l.note}`);
      }
    }
    for (const p of people.filter((x) => x.active)) {
      push({ kind: 'person', id: p.id, title: p.displayName, sub: `${p.role} · ${p.department}`, href: `/people/${p.id}` },
        `${p.displayName} ${p.role} ${p.department}`, rank(p.displayName), `Person: ${p.displayName}, ${p.role}, ${p.department}.`);
    }
  }
  const order = { project: 0, person: 1, task: 2, line: 3 };
  return hits.sort((a, b) => a.r - b.r || order[a.hit.kind] - order[b.hit.kind]);
}
