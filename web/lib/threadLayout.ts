import type { MapEdge, MapNode, ThreadMap } from './threadMap';

// Where each node of the thread map sits. Pure and deterministic: the same map always gives the same numbers, so the
// tests and the screenshots are stable. One column for each step from the focus (the focus on the left). Inside a
// column, the first step is ordered by kind and name, and each later column by where its neighbours sit in the column
// before it, so the lines cross as little as a simple rule allows. No graph library, no random numbers, no animation.

export const GRID = { colW: 250, rowH: 44, padX: 52, padY: 28, labelW: 190, labelGap: 16, arrow: 9 } as const;
export const LABEL_MAX = 24; // characters shown on the map. The full text is in the hover title and in the list.

// The page an item opens, from its node id ("task:tsk_034"). No server imports here: the client map uses it.
export function hrefOf(id: string): string {
  const i = id.indexOf(':');
  const kind = id.slice(0, i);
  const item = id.slice(i + 1);
  return kind === 'task' ? `/tasks/${item}` : kind === 'project' ? `/projects/${item}` : `/people/${item}`;
}

export const edgeKey =(e: MapEdge) => `${e.from}|${e.to}|${e.kind}`;
export function truncate(s: string, n = LABEL_MAX): string {
  const t = s.trim();
  return t.length <= n ? t : `${t.slice(0, n - 1).trimEnd()}…`;
}

export type Placed = MapNode & { x: number; y: number; short: string };
export type PlacedEdge = MapEdge & { key: string; d: string };
export type Layout = { width: number; height: number; nodes: Placed[]; edges: PlacedEdge[] };

const KIND_RANK: Record<MapNode['kind'], number> = { project: 0, task: 1, person: 2 };
const cmpName = (a: MapNode, b: MapNode) => KIND_RANK[a.kind] - KIND_RANK[b.kind] || a.label.localeCompare(b.label) || a.id.localeCompare(b.id);

export function layoutMap(map: ThreadMap): Layout {
  const { colW, rowH, padX, padY, labelW } = GRID;
  const byHop = new Map<number, MapNode[]>();
  for (const n of map.nodes) byHop.set(n.hop, [...(byHop.get(n.hop) ?? []), n]);
  const maxHop = Math.max(0, ...byHop.keys());
  const rows = Math.max(1, ...[...byHop.values()].map((c) => c.length));
  const height = padY * 2 + (rows - 1) * rowH;
  const width = padX * 2 + maxHop * colW + labelW;
  const neighbours = new Map<string, string[]>();
  for (const e of map.edges) {
    neighbours.set(e.from, [...(neighbours.get(e.from) ?? []), e.to]);
    neighbours.set(e.to, [...(neighbours.get(e.to) ?? []), e.from]);
  }
  const pos = new Map<string, Placed>();
  for (let hop = 0; hop <= maxHop; hop++) {
    const col = [...(byHop.get(hop) ?? [])];
    if (hop <= 1) col.sort(cmpName);
    else {
      const centre = (n: MapNode) => {
        const ys = (neighbours.get(n.id) ?? []).map((id) => pos.get(id)).filter((p): p is Placed => !!p && p.hop === hop - 1).map((p) => p.y);
        return ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : Number.POSITIVE_INFINITY;
      };
      const c = new Map(col.map((n) => [n.id, centre(n)]));
      col.sort((a, b) => (c.get(a.id)! === c.get(b.id)! ? cmpName(a, b) : c.get(a.id)! - c.get(b.id)!));
    }
    const top = padY + ((rows - col.length) * rowH) / 2;
    col.forEach((n, i) => pos.set(n.id, { ...n, x: padX + hop * colW, y: Math.round(top + i * rowH), short: truncate(n.label) }));
  }
  const placed = (id: string) => pos.get(id)!;
  const edges: PlacedEdge[] = map.edges.filter((e) => pos.has(e.from) && pos.has(e.to)).map((e) => ({ ...e, key: edgeKey(e), d: pathOf(placed(e.from), placed(e.to)) }));
  // Reading order for the keyboard: the focus, then each step in turn, top to bottom.
  const nodes = [...pos.values()].sort((a, b) => a.hop - b.hop || a.y - b.y || a.id.localeCompare(b.id));
  return { width, height, nodes, edges };
}

// A curve for one edge. The marker sits left of its label, so a line meets the nearer column at its marker and the
// column before at the end of its label, and never crosses a label it belongs to. The arrow head is at the `to` end.
const CHAR_W = 6.4; // an average letter at the label size, close enough to clear the text
export const labelEnd = (n: { x: number; short: string }) => Math.round(n.x + GRID.labelGap + n.short.length * CHAR_W);

function pathOf(a: Placed, b: Placed): string {
  const gap = GRID.arrow;
  if (a.x === b.x) {
    const x = a.x - gap; // two items in one column bow out to the left, where there is no label
    const out = Math.round(Math.min(40, 14 + Math.abs(a.y - b.y) / 6));
    return `M${x} ${a.y}C${x - out} ${a.y} ${x - out} ${b.y} ${x} ${b.y}`;
  }
  const forward = a.x < b.x;
  const sx = forward ? labelEnd(a) : a.x - gap;
  const ex = forward ? b.x - gap : labelEnd(b) + 3;
  const mx = Math.round((sx + ex) / 2);
  return `M${sx} ${a.y}C${mx} ${a.y} ${mx} ${b.y} ${ex} ${b.y}`;
}

// What lights up when one node is hovered or focused: the node, its path back to the focus, and its direct links.
// `nodes` and `edges` are everything left at full strength. `self` is the node itself.
export type Chain = { self: string; nodes: Set<string>; edges: Set<string> };

export function chainOf(map: ThreadMap, id: string): Chain {
  const nodes = new Set<string>([id]);
  const edges = new Set<string>();
  if (!map.nodes.some((n) => n.id === id)) return { self: id, nodes, edges };
  const hop = new Map(map.nodes.map((n) => [n.id, n.hop]));
  // direct links, both ways
  for (const e of map.edges) if (e.from === id || e.to === id) { edges.add(edgeKey(e)); nodes.add(e.from); nodes.add(e.to); }
  // the way back: from the node, step to a neighbour one step nearer the focus, until the focus. The first in sorted order wins.
  let cur = id;
  while (hop.get(cur)! > 0) {
    const step = map.edges.find((e) => (e.from === cur && hop.get(e.to) === hop.get(cur)! - 1) || (e.to === cur && hop.get(e.from) === hop.get(cur)! - 1));
    if (!step) break;
    edges.add(edgeKey(step));
    cur = step.from === cur ? step.to : step.from;
    nodes.add(cur);
  }
  return { self: id, nodes, edges };
}
