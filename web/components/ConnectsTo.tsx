'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { ThreadLine } from '@/lib/threads';
import { Help } from './HelpMode';
import { api } from './task-ui';
import { TaskLink } from './TaskLink';
import { useOpenTask } from './taskUrl';

// "Connects to": what this task, project or person is part of, waits on, and is mentioned in (lib/threads.ts).
// The lines arrive already filtered by what the reader may see. In the task drawer a task line opens in place,
// so the browser back button returns to the task you came from. Everywhere else it is a plain link.

const SHOWN = 5; // lines for each relation before "Show more"

function Line({ l, inDrawer, open }: { l: ThreadLine; inDrawer: boolean; open: (id: string) => void }) {
  const text = (
    <>
      <span className="cn-title">{l.title}</span>
      {l.who && <span className="cn-sub"> · {l.who}</span>}
      {l.sub && <span className="cn-sub"> · {l.sub}</span>}
    </>
  );
  if (!l.href) return <li className="cn-line">{text}</li>;
  if (l.external) return <li className="cn-line"><a className="cn-link" href={l.href} target="_blank" rel="noopener noreferrer">{text}</a></li>;
  if (inDrawer && l.kind === 'task' && l.id) return <li className="cn-line"><TaskLink id={l.id} className="cn-link" onOpen={() => open(l.id!)}>{text}</TaskLink></li>;
  return <li className="cn-line"><Link className="cn-link" href={l.href} prefetch={false}>{text}</Link></li>;
}

// `focus` is the item this block belongs to (task:<id>, project:<id> or person:<id>). With it, the block links to the thread map.
export function ConnectsTo({ lines, inDrawer = false, focus }: { lines: ThreadLine[]; inDrawer?: boolean; focus?: string }) {
  const [, open] = useOpenTask();
  const [more, setMore] = useState<Record<string, boolean>>({});
  const groups: { rel: string; items: ThreadLine[] }[] = [];
  for (const l of lines) {
    const g = groups.find((x) => x.rel === l.rel);
    if (g) g.items.push(l); else groups.push({ rel: l.rel, items: [l] });
  }
  return (
    <section className="cn" aria-label="Connects to">
      <h3 className="section-title"><Help term="connects_to">Connects to</Help></h3>
      {groups.length === 0 && <p className="hint">Nothing is connected yet.</p>}
      {groups.length > 0 && (
        <dl className="cn-groups">
          {groups.map((g) => {
            const all = more[g.rel] || g.items.length <= SHOWN + 1;
            const items = all ? g.items : g.items.slice(0, SHOWN);
            return (
              <div className="cn-group" key={g.rel}>
                <dt>{g.rel}</dt>
                <dd>
                  <ul className="cn-list">
                    {items.map((l, i) => <Line key={`${l.kind}:${l.id ?? l.title}:${i}`} l={l} inDrawer={inDrawer} open={open} />)}
                  </ul>
                  {!all && <button type="button" className="cn-more" onClick={() => setMore({ ...more, [g.rel]: true })}>Show {g.items.length - SHOWN} more</button>}
                </dd>
              </div>
            );
          })}
        </dl>
      )}
      {focus && <p className="cn-map-row"><Link className="cn-map" href={`/map?focus=${focus}`} prefetch={false}>Thread map</Link> <Help term="thread_map"><span className="cn-sub">· key T</span></Help></p>}
    </section>
  );
}

// The drawer reads its lines from the server, and reads them again when the task changes (its version moves).
export function TaskConnects({ id, version }: { id: string; version: number }) {
  const [lines, setLines] = useState<ThreadLine[] | null>(null);
  useEffect(() => {
    let live = true;
    api(`/tasks/${id}/threads`, 'GET').then((r) => { if (live) setLines(r); }).catch(() => { if (live) setLines([]); });
    return () => { live = false; };
  }, [id, version]);
  if (!lines) return null;
  return <ConnectsTo lines={lines} inDrawer focus={`task:${id}`} />;
}
