import { z } from 'zod';
import type { Me } from './auth';
import type { Tx } from './db';
import { notFound } from './errors';
import { flagKeyOf, statusOf } from './flags';
import { linesFor, threadWorld, type ThreadKind, type ThreadLine, type ThreadRel, type ThreadWorld } from './threads';
import { today } from './time';

// The thread map (13 Oct, after "Connects to"). The same links as the "Connects to" panel, drawn as a graph around one
// item. Nothing is stored. The links come from linesFor in lib/threads.ts, which already cuts everything by what the
// reader may see, so a hidden task or project is never a node, not even an unlabeled one. This file only turns those
// lines into edges and walks outward. assembleGraph is pure: tests give it a fake neighbour function.

export type EdgeKind = 'part_of' | 'waits_on' | 'mentions' | 'owns';
export type MapNode = {
  id: string; // `${kind}:${itemId}`, for example task:tsk_034
  kind: ThreadKind;
  label: string;
  status?: string; // a task's status word, or a project's on_track, at_risk, off_track
  flags?: string[]; // late, at_risk, archived
  hop: number; // steps from the focus, 0 for the focus itself
};
export type MapEdge = { from: string; to: string; kind: EdgeKind };
export type ThreadMap = { focus: string; hops: number; nodes: MapNode[]; edges: MapEdge[]; more: number };

export const DEFAULT_HOPS = 2;
export const MAX_HOPS = 3;
export const NODE_CAP = 60;

export const nodeId = (kind: ThreadKind, id: string) => `${kind}:${id}`;
export function splitNodeId(id: string): { kind: ThreadKind; id: string } {
  const i = id.indexOf(':');
  return { kind: id.slice(0, i) as ThreadKind, id: id.slice(i + 1) };
}

// The page an item opens, from its node id. It lives in threadLayout.ts so the browser code can import it without this
// file's server imports; it is re-exported here for the server page and the tests.
export { hrefOf } from './threadLayout';

// The address form: ?focus=task:tsk_034&hops=2. Anything else is refused before the database is touched.
export const FOCUS_RE = /^(task|project|person):[A-Za-z0-9_.-]{1,64}$/;
export const mapQuery = z.object({
  focus: z.string({ error: 'Say which item to map.' }).regex(FOCUS_RE, 'Use focus=task:<id>, project:<id> or person:<id>.'),
  hops: z.coerce.number().int().min(1, 'Use 1 to 3 steps.').max(MAX_HOPS, 'Use 1 to 3 steps.').default(DEFAULT_HOPS),
});
export type MapQuery = z.infer<typeof mapQuery>;

// One link as the walk sees it: both ends are node ids, one of them is the item being expanded.
export type MapLink = { from: string; to: string; kind: EdgeKind };
type Describe = (id: string) => Omit<MapNode, 'id' | 'hop'> | null;

export async function assembleGraph(a: {
  focus: string;
  hops: number;
  cap?: number;
  expand: (id: string) => Promise<MapLink[]>;
  describe: Describe;
}): Promise<ThreadMap> {
  const cap = a.cap ?? NODE_CAP;
  const hops = Math.max(1, Math.min(MAX_HOPS, Math.floor(a.hops)));
  const focusInfo = a.describe(a.focus);
  if (!focusInfo) throw notFound('No such item.');
  const nodes = new Map<string, MapNode>([[a.focus, { id: a.focus, ...focusInfo, hop: 0 }]]);
  const edges = new Map<string, MapEdge>();
  const left = new Set<string>(); // items inside the hop limit that did not fit under the cap
  let frontier = [a.focus];
  for (let d = 0; d < hops && frontier.length > 0; d++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const l of await a.expand(id)) {
        const other = l.from === id ? l.to : l.from;
        if (other === id) continue;
        if (!nodes.has(other)) {
          const info = a.describe(other);
          if (!info) continue;
          if (nodes.size >= cap) { left.add(other); continue; }
          nodes.set(other, { id: other, ...info, hop: d + 1 });
          next.push(other);
        }
        edges.set(`${l.from}|${l.to}|${l.kind}`, { from: l.from, to: l.to, kind: l.kind });
      }
    }
    frontier = next;
  }
  // Nodes are never removed, so an item left out under the cap stays out. Count each one once.
  return {
    focus: a.focus, hops, more: left.size,
    nodes: [...nodes.values()],
    edges: [...edges.values()].sort((x, y) => x.from.localeCompare(y.from) || x.to.localeCompare(y.to) || x.kind.localeCompare(y.kind)),
  };
}

// How each "Connects to" relation becomes an edge. `item` says which end the item whose panel it is stands on.
// Edge words: part_of (a task in a project, a person on a project), waits_on (a task or person it waits on),
// mentions (a comment on one item names the other), owns (an owner or lead of a project).
const REL: Partial<Record<ThreadRel, { kind: EdgeKind; item: 'from' | 'to' }>> = {
  'Part of': { kind: 'part_of', item: 'from' }, // task -> project
  'Waits on': { kind: 'waits_on', item: 'from' }, // task -> person
  'Waiting on it': { kind: 'waits_on', item: 'to' }, // a task waiting on this task's owner -> this task
  'Mentioned in': { kind: 'mentions', item: 'to' }, // the item the comment is on -> this item
  Owner: { kind: 'owns', item: 'to' }, // person -> project
  Lead: { kind: 'owns', item: 'to' },
  People: { kind: 'part_of', item: 'to' }, // person -> project
  Owns: { kind: 'owns', item: 'from' }, // person -> project
  'Waiting on them': { kind: 'waits_on', item: 'to' }, // task -> person
};

// Lines that open another item become links. Links out to the web, minutes and checkpoints open no item, so they are not nodes.
export function linksOf(item: string, lines: ThreadLine[]): MapLink[] {
  const out: MapLink[] = [];
  for (const l of lines) {
    const r = REL[l.rel];
    if (!r || !l.id || (l.kind !== 'task' && l.kind !== 'project' && l.kind !== 'person')) continue;
    const other = nodeId(l.kind, l.id);
    out.push(r.item === 'from' ? { from: item, to: other, kind: r.kind } : { from: other, to: item, kind: r.kind });
  }
  return out;
}

function describer(world: ThreadWorld, now: string): Describe {
  return (id) => {
    const { kind, id: itemId } = splitNodeId(id);
    if (kind === 'task') {
      const t = world.seen.tasks.get(itemId);
      if (!t) return null;
      const f = flagKeyOf(t, now);
      return { kind, label: t.title, status: statusOf(t), flags: f ? [f] : [] };
    }
    if (kind === 'project') {
      const p = world.seen.projects.get(itemId);
      if (!p) return null;
      return { kind, label: p.name, status: p.status, flags: p.archivedAt ? ['archived'] : [] };
    }
    const name = world.names[itemId];
    return name && world.people.some((x) => x.id === itemId) ? { kind: 'person', label: name, flags: [] } : null;
  };
}

// The map around one item, for this viewer. A hidden or unknown focus reads as missing, the same 404 as the panel.
export async function threadMapFor(db: Tx, me: Me, kind: ThreadKind, id: string, opts: { hops?: number; cap?: number } = {}): Promise<ThreadMap> {
  const world = await threadWorld(db, me);
  const focus = nodeId(kind, id);
  const describe = describer(world, today());
  if (!describe(focus)) throw notFound(kind === 'task' ? 'No such task.' : kind === 'project' ? 'No such project.' : 'That person is not on this team.');
  return assembleGraph({
    focus, hops: opts.hops ?? DEFAULT_HOPS, cap: opts.cap, describe,
    expand: async (n) => { const s = splitNodeId(n); return linksOf(n, await linesFor(db, world, s.kind, s.id, true)); },
  });
}

// "task:tsk_034" to its parts, or null when it is not one of the three kinds.
export function parseFocus(raw: string | null | undefined): { kind: ThreadKind; id: string } | null {
  return raw && FOCUS_RE.test(raw) ? splitNodeId(raw) : null;
}
