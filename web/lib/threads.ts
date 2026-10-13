import type { Me } from './auth';
import type { Tx } from './db';
import type { Task } from './derive';
import { notFound } from './errors';
import { hostOf, linkText } from './links';
import { projectMembers, type Project } from './plan';
import { listPeople } from './service';
import { fmtDate } from './time';
import { sightFor, seenProjects, seenTasks } from './visibility';

// "Connects to" (workstream 6, 13 Oct). The links between a task, a project or a person and the rest of the team's work,
// worked out from fields and comment_refs the app already has. Nothing is stored. Every line is filtered by what the
// reader may see (lib/sight.ts) before it is built, so a hidden task or project never shows, not even as a count or a title.

export type ThreadRel =
  | 'Part of' | 'Waits on' | 'Waiting on it' | 'From' | 'Mentioned in' | 'Links'
  | 'Owner' | 'Lead' | 'People' | 'Checkpoints'
  | 'Owns' | 'Waiting on them';

export type ThreadKind = 'task' | 'project' | 'person';
// kind says what the line opens: another item in the app, or a web page (link), or nothing (minutes).
export type ThreadLine = {
  rel: ThreadRel;
  title: string;
  who: string | null; // a person's name beside the title: the owner of a task, the writer of a comment
  sub: string | null; // a second quiet part: a date, a role, a sub-project
  href: string | null;
  kind: ThreadKind | 'link' | 'minutes' | 'checkpoint';
  id: string | null; // the task, project or person id when kind is one of those
  external?: boolean;
};

const byDue = (a: Task, b: Task) => a.dueOn.localeCompare(b.dueOn) || a.title.localeCompare(b.title);
const taskLine = (rel: ThreadRel, t: Task, names: Record<string, string>): ThreadLine => ({
  rel, title: t.title, who: names[t.ownerId] ?? null, sub: `Due ${fmtDate(t.dueOn)}`, href: `/tasks/${t.id}`, kind: 'task', id: t.id,
});
const projectLine = (rel: ThreadRel, p: Project, sub: string | null = null): ThreadLine => ({
  rel, title: p.name, who: null, sub, href: `/projects/${p.id}`, kind: 'project', id: p.id,
});
const personLine = (rel: ThreadRel, id: string, names: Record<string, string>, sub: string | null = null): ThreadLine => ({
  rel, title: names[id] ?? 'Unknown', who: null, sub, href: `/people/${id}`, kind: 'person', id,
});

type Seen = { tasks: Map<string, Task>; projects: Map<string, Project> };

// Comments that mention this item with @ or #, one line for each task or project they were written on, newest first.
// A comment on something the reader cannot see is left out whole. So is a comment on the item itself.
async function mentionedIn(db: Tx, refKind: ThreadKind, id: string, seen: Seen, names: Record<string, string>): Promise<ThreadLine[]> {
  const { rows } = await db.query<{ subject_kind: 'task' | 'project'; subject_id: string; author_id: string }>(
    `SELECT c.subject_kind, c.subject_id, c.author_id FROM comment_refs r JOIN comments c ON c.id = r.comment_id
     WHERE r.ref_kind = $1 AND r.ref_id = $2 AND c.deleted_at IS NULL ORDER BY c.created_at DESC, c.id DESC LIMIT 100`,
    [refKind, id]);
  const out: ThreadLine[] = [];
  const done = new Set<string>();
  for (const r of rows) {
    const key = `${r.subject_kind}:${r.subject_id}`;
    if (done.has(key) || (r.subject_kind === refKind && r.subject_id === id)) continue;
    const who = names[r.author_id] ?? null;
    if (r.subject_kind === 'task') {
      const t = seen.tasks.get(r.subject_id);
      if (!t) continue;
      done.add(key);
      out.push({ rel: 'Mentioned in', title: t.title, who, sub: null, href: `/tasks/${t.id}`, kind: 'task', id: t.id });
    } else {
      const p = seen.projects.get(r.subject_id);
      if (!p) continue;
      done.add(key);
      out.push({ rel: 'Mentioned in', title: p.name, who, sub: null, href: `/projects/${p.id}`, kind: 'project', id: p.id });
    }
  }
  return out;
}

export async function threadsFor(db: Tx, me: Me, kind: ThreadKind, id: string): Promise<ThreadLine[]> {
  const sight = await sightFor(db, me);
  const [tasks, projects, people] = await Promise.all([seenTasks(db, me, undefined, sight), seenProjects(db, me, sight), listPeople(db, me.team.id)]);
  const seen: Seen = { tasks: new Map(tasks.map((t) => [t.id, t])), projects: new Map(projects.map((p) => [p.id, p])) };
  const names = Object.fromEntries(people.map((p) => [p.id, p.displayName])) as Record<string, string>;
  const open = tasks.filter((t) => t.statusCategory === 'open');
  const lines: ThreadLine[] = [];

  if (kind === 'task') {
    const t = seen.tasks.get(id);
    if (!t) throw notFound('No such task.'); // hidden reads as missing
    const project = t.projectId ? seen.projects.get(t.projectId) : undefined; // a project the reader cannot see is left out
    if (project) lines.push(projectLine('Part of', project, t.workstream));
    if (t.blocked?.onId && names[t.blocked.onId]) lines.push(personLine('Waits on', t.blocked.onId, names, t.blocked.ask));
    for (const w of open.filter((x) => x.id !== t.id && x.blocked?.onId === t.ownerId).sort(byDue)) lines.push(taskLine('Waiting on it', w, names));
    if (t.origin === 'granola') lines.push({ rel: 'From', title: 'Meeting minutes', who: null, sub: null, href: null, kind: 'minutes', id: null });
    lines.push(...await mentionedIn(db, 'task', t.id, seen, names));
    for (const l of t.links) lines.push({ rel: 'Links', title: linkText(l), who: null, sub: hostOf(l.url) || null, href: l.url, kind: 'link', id: l.id, external: true });
    return lines;
  }

  if (kind === 'project') {
    const p = seen.projects.get(id);
    if (!p) throw notFound('No such project.');
    lines.push(personLine('Owner', p.ownerId, names));
    if (p.leadId !== p.ownerId) lines.push(personLine('Lead', p.leadId, names));
    const members = await projectMembers(db, p.id);
    const shown = new Set([p.ownerId, p.leadId]);
    for (const m of members) if (!shown.has(m.personId)) { shown.add(m.personId); lines.push(personLine('People', m.personId, names, m.role)); }
    if (p.kind === 'plan') {
      const { rows } = await db.query<{ label: string; due_on: string | null; what: string }>(
        `SELECT c.label, c.due_on, l.what FROM plan_checkpoints c JOIN plan_lines l ON l.id = c.line_id
         WHERE l.project_id = $1 AND NOT l.removed AND NOT c.done ORDER BY c.due_on NULLS LAST, l.num, c.position LIMIT 30`, [p.id]);
      for (const c of rows) lines.push({ rel: 'Checkpoints', title: c.label, who: null, sub: [c.due_on ? `Due ${fmtDate(c.due_on)}` : '', c.what].filter(Boolean).join(' · '), href: `/projects/${p.id}`, kind: 'checkpoint', id: null });
    }
    lines.push(...await mentionedIn(db, 'project', p.id, seen, names));
    return lines;
  }

  if (!people.some((p) => p.id === id)) throw notFound('That person is not on this team.');
  for (const p of projects.filter((x) => x.ownerId === id && !x.archivedAt)) lines.push(projectLine('Owns', p));
  for (const t of open.filter((x) => x.blocked?.onId === id && x.ownerId !== id).sort(byDue)) lines.push(taskLine('Waiting on them', t, names));
  lines.push(...await mentionedIn(db, 'person', id, seen, names));
  return lines;
}
