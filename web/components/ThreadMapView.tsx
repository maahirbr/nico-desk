'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { chainOf, hrefOf, layoutMap, type Placed } from '@/lib/threadLayout';
import type { EdgeKind, MapNode, ThreadMap } from '@/lib/threadMap';
import { writeUrlState, isPlainClick } from '@/lib/urlstate';
import { Help } from './HelpMode';
import { isTyping } from './keys';

// The thread map (13 Oct): the "Connects to" links drawn as a graph around one item. The shape and the numbers come from
// lib/threadLayout.ts, so this file only draws and listens. Point at an item, or Tab to it, and its chain lights while
// everything else fades (opacity only). A click opens the item. On a phone the first tap lights, the second opens.
// The same items are always available as a plain list: the toggle, and the only view under 641px.

const STATUS_WORD: Record<string, string> = {
  todo: 'Not started', doing: 'In progress', blocked: 'Blocked', done: 'Done', dropped: 'Dropped',
  on_track: 'On track', at_risk: 'At risk', off_track: 'Off track',
};
const FLAG_WORD: Record<string, string> = { late: 'Late', at_risk: 'At risk', ahead: 'Ahead', on_time: 'On time', archived: 'Archived' };
const KIND_WORD: Record<MapNode['kind'], string> = { task: 'Task', project: 'Project', person: 'Person' };
const EDGE_WORD: Record<EdgeKind, string> = { part_of: 'part of', waits_on: 'waits on', mentions: 'mentions', owns: 'owns' };

const mapHref = (id: string, hops: number) => `/map?focus=${id}${hops === 2 ? '' : `&hops=${hops}`}`;

const describeNode = (n: MapNode) => [
  KIND_WORD[n.kind],
  n.status ? STATUS_WORD[n.status] ?? n.status : null,
  ...(n.flags ?? []).map((f) => FLAG_WORD[f] ?? f),
  n.hop === 0 ? 'where the map starts' : `${n.hop} ${n.hop === 1 ? 'step' : 'steps'} away`,
].filter(Boolean).join(' · ');

function Marker({ n }: { n: Placed }) {
  const late = n.flags?.includes('late');
  const cls = `tmap-mark tmap-${n.kind}${n.status && n.kind === 'task' ? ` tmap-st-${n.status}` : ''}${late ? ' tmap-late' : ''}`;
  if (n.kind === 'task') return <rect className={cls} x={n.x - 6} y={n.y - 6} width={12} height={12} rx={2} />;
  if (n.kind === 'project') return <path className={cls} d={`M${n.x} ${n.y - 8}L${n.x + 8} ${n.y}L${n.x} ${n.y + 8}L${n.x - 8} ${n.y}Z`} />;
  return <circle className={cls} cx={n.x} cy={n.y} r={6.5} />;
}

export function ThreadMapView({ map, view, itemHref }: { map: ThreadMap; view: 'map' | 'list'; itemHref: string }) {
  const router = useRouter();
  const layout = useMemo(() => layoutMap(map), [map]);
  const [hover, setHover] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null); // a touch tap that has lit an item and not yet opened it
  const lastPointer = useRef<string>('mouse');
  const active = hover ?? focused ?? picked;
  const chain = useMemo(() => (active ? chainOf(map, active) : null), [map, active]);
  const start = map.nodes.find((n) => n.id === map.focus)!;
  const shown = map.nodes.find((n) => n.id === (active ?? map.focus)) ?? start;

  // Escape closes the map: back to where it was opened from, or to the item when it was opened in a new tab.
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || isTyping(e.target) || document.querySelector('[aria-modal="true"]')) return;
      if (picked) { setPicked(null); return; }
      if (window.history.length > 1) router.back(); else router.push(itemHref);
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [router, itemHref, picked]);

  // View and steps live in the address, so a shared link opens the same picture.
  const setParam = (key: 'view' | 'hops', value: string) => {
    const q = writeUrlState(window.location.search, { [key]: value }, { view: 'map', hops: '2' }, [key]);
    router.replace(`/map${q}`, { scroll: false });
  };

  const open = (e: React.MouseEvent, id: string) => {
    if (lastPointer.current === 'touch' && picked !== id) { e.preventDefault(); setPicked(id); return; }
    if (!isPlainClick(e)) return; // a middle or Cmd click opens the real link in a new tab
    e.preventDefault();
    router.push(hrefOf(id));
  };

  const byId = new Map(layout.nodes.map((n) => [n.id, n]));
  const title = `Thread map around ${start.label}`;

  return (
    <div className="tmap">
      <div className="tmap-bar">
        <p className="tmap-sum">
          <Help term="thread_map">{map.nodes.length} {map.nodes.length === 1 ? 'item' : 'items'}</Help> within {map.hops} {map.hops === 1 ? 'step' : 'steps'} of {start.label}.
          {map.more > 0 && <> <b>{map.more} more not shown.</b> Open one of these and map from there.</>}
        </p>
        <div className="tmap-ctl">
          <div className="seg" role="group" aria-label="Steps from the start">
            {[1, 2, 3].map((h) => (
              <button key={h} type="button" aria-pressed={map.hops === h} onClick={() => setParam('hops', String(h))}>{h}</button>
            ))}
          </div>
          <div className="seg" role="group" aria-label="Show as">
            <button type="button" aria-pressed={view === 'map'} onClick={() => setParam('view', 'map')}>Map</button>
            <button type="button" aria-pressed={view === 'list'} onClick={() => setParam('view', 'list')}>List</button>
          </div>
        </div>
      </div>

      <div className={`tmap-canvas${view === 'list' ? ' is-hidden' : ''}`}>
        <svg className={`tmap-svg${chain ? ' is-lit' : ''}`} viewBox={`0 0 ${layout.width} ${layout.height}`} width={layout.width} height={layout.height} role="group" aria-labelledby="tmap-t tmap-d">
          <title id="tmap-t">{title}</title>
          <desc id="tmap-d">{map.nodes.length} items and {map.edges.length} links. Tab moves between items, Enter opens one, Escape closes the map. The same items are in the list view.</desc>
          <defs>
            <marker id="tmap-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto"><path d="M0 0L8 4L0 8z" className="tmap-arrow" /></marker>
          </defs>
          <g className="tmap-edges">
            {layout.edges.map((e) => (
              <path key={e.key} d={e.d} markerEnd="url(#tmap-arrow)"
                className={`tmap-edge tmap-e-${e.kind}${chain && !chain.edges.has(e.key) ? ' is-dim' : ''}${chain?.edges.has(e.key) ? ' is-lit' : ''}`}>
                <title>{`${byId.get(e.from)?.label} ${EDGE_WORD[e.kind]} ${byId.get(e.to)?.label}`}</title>
              </path>
            ))}
          </g>
          <g className="tmap-nodes">
            {layout.nodes.map((n) => {
              const dim = chain && !chain.nodes.has(n.id);
              return (
                <a key={n.id} href={hrefOf(n.id)} tabIndex={0} className={`tmap-node${n.id === map.focus ? ' is-focus' : ''}${dim ? ' is-dim' : ''}${n.id === active ? ' is-self' : ''}`}
                  aria-label={`${n.label}. ${describeNode(n)}`}
                  onPointerDown={(e) => { lastPointer.current = e.pointerType; }} onKeyDown={() => { lastPointer.current = 'key'; }}
                  onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)}
                  onFocus={() => setFocused(n.id)} onBlur={() => setFocused(null)}
                  onClick={(e) => open(e, n.id)}>
                  <title>{`${n.label}\n${describeNode(n)}`}</title>
                  <rect className="tmap-hit" x={n.x - 12} y={n.y - 18} width={GRID_HIT} height={36} />
                  <Marker n={n} />
                  <text className="tmap-label" x={n.x + 16} y={n.y} dominantBaseline="central">{n.short}</text>
                </a>
              );
            })}
          </g>
        </svg>
        <p className="tmap-now" aria-live="polite">
          <b>{shown.label}</b> <span className="tmap-now-sub">{describeNode(shown)}</span>
          {!active && <span className="tmap-now-sub"> · <Help term="thread_map_chain">Point at an item to light its chain</Help></span>}
          {picked && <span className="tmap-now-sub"> · <Link className="rlink" href={hrefOf(picked)}>Open</Link></span>}
        </p>
      </div>

      <ThreadList map={map} hidden={view === 'map'} />
    </div>
  );
}

const GRID_HIT = 220; // the area that takes a pointer, wide enough to cover the label

// The same items as text, grouped by step. This is the whole view on a phone and the fallback everywhere.
function ThreadList({ map, hidden }: { map: ThreadMap; hidden: boolean }) {
  const name = new Map(map.nodes.map((n) => [n.id, n.label]));
  const steps = [...new Set(map.nodes.map((n) => n.hop))].sort((a, b) => a - b);
  return (
    <div className={`tmap-list${hidden ? ' is-hidden' : ''}`}>
      {steps.map((hop) => (
        <section key={hop} className="tmap-step" aria-label={hop === 0 ? 'Start' : `${hop} ${hop === 1 ? 'step' : 'steps'} away`}>
          <h3 className="section-title">{hop === 0 ? 'Start' : `${hop} ${hop === 1 ? 'step' : 'steps'} away`}</h3>
          <ul className="tmap-items">
            {map.nodes.filter((n) => n.hop === hop).sort((a, b) => a.kind.localeCompare(b.kind) || a.label.localeCompare(b.label)).map((n) => {
              const links = map.edges.filter((e) => e.from === n.id || e.to === n.id);
              return (
                <li key={n.id} className="tmap-item">
                  <Link className="tmap-item-link" href={hrefOf(n.id)} prefetch={false}><span className={`tmap-dot tmap-${n.kind}`} aria-hidden="true" />{n.label}</Link>
                  <span className="tmap-item-sub"> · {describeNode(n)}</span>
                  {links.length > 0 && (
                    <ul className="tmap-rels">
                      {links.map((e) => <li key={`${e.from}|${e.to}|${e.kind}`}>{e.from === n.id ? `${EDGE_WORD[e.kind]} ${name.get(e.to)}` : `${name.get(e.from)} ${EDGE_WORD[e.kind]} it`}</li>)}
                    </ul>
                  )}
                  {n.hop > 0 && <Link className="tmap-from" href={mapHref(n.id, map.hops)} prefetch={false}>Map from here</Link>}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
