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

export async function search(db: Tx, teamId: string, q: string, today = todayIst()): Promise<SearchHit[]> {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 8);
  if (!words.length) return [];
  const has = (hay: string) => words.every((w) => hay.includes(w));
  const rank = (title: string) => (words.every((w) => title.toLowerCase().includes(w)) ? 0 : 1);
  const [projects, tasks, people] = await Promise.all([teamProjects(db, teamId), teamTasks(db, teamId, today), listPeople(db, teamId)]);
  const pname = Object.fromEntries(projects.map((p) => [p.id, p.name]));
  const name = Object.fromEntries(people.map((p) => [p.id, p.displayName]));
  const hits: (SearchHit & { r: number })[] = [];

  for (const p of projects) {
    if (has(`${p.name} ${p.eyebrow ?? ''} ${p.intro ?? ''} ${p.phase ?? ''} ${p.workstreams.join(' ')} ${name[p.ownerId] ?? ''}`.toLowerCase()))
      hits.push({ kind: 'project', id: p.id, title: p.name, sub: [p.eyebrow, `Lead: ${name[p.ownerId] ?? '?'}`].filter(Boolean).join(' · '), href: `/projects/${p.id}`, r: rank(p.name) });
  }
  for (const t of tasks) {
    if (t.statusCategory === 'dropped') continue;
    const where = [t.projectId ? pname[t.projectId] : '', t.workstream ?? ''].filter(Boolean).join(' · ');
    if (has(`${t.title} ${t.description ?? ''} ${t.note ?? ''} ${where} ${name[t.ownerId] ?? ''}`.toLowerCase()))
      hits.push({ kind: 'task', id: t.id, title: t.title, sub: [name[t.ownerId], where].filter(Boolean).join(' · '), href: `/tasks/${t.id}`,
        dueOn: t.dueOn, open: t.statusCategory === 'open', overdue: t.overdue, r: rank(t.title) + (t.statusCategory === 'open' ? 0 : 0.5) });
  }
  for (const p of projects.filter((x) => x.kind === 'plan')) {
    const s = await planState(db, p.id);
    for (const l of s.lines) {
      if (has(`${l.what} ${l.doneDef} ${l.note} ${l.partner} ${l.ownerWith} ${name[l.ownerId ?? ''] ?? ''} ${l.checkpoints.map((c) => c.label).join(' ')}`.toLowerCase()))
        hits.push({ kind: 'line', id: l.id, title: `${l.num}. ${l.what}`, sub: `${p.name}${l.ownerId ? ` · ${name[l.ownerId]}` : ''}`, href: `/projects/${p.id}`, r: rank(l.what) });
    }
  }
  for (const p of people.filter((x) => x.active)) {
    if (has(`${p.displayName} ${p.role} ${p.department}`.toLowerCase()))
      hits.push({ kind: 'person', id: p.id, title: p.displayName, sub: `${p.role} · ${p.department}`, href: `/team`, r: rank(p.displayName) });
  }
  const order = { project: 0, person: 1, task: 2, line: 3 };
  return hits.sort((a, b) => a.r - b.r || order[a.kind] - order[b.kind]).slice(0, 60).map(({ r: _r, ...h }) => h as SearchHit);
}
