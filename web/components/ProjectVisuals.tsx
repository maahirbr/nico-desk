'use client';

import { barShare } from '@/lib/glance';
import { dueDoneSummary, splitParts, splitSummary, weeksEmpty, type DueDone, type StatusSplit } from '@/lib/progress';
import { fmtDate } from '@/lib/time';
import { Card } from './HomeGlance';
import { useFirstView } from './motion';

// The project status bar and the weekly done-against-due chart. Both are drawn from tokens, so every skin colours
// them in day and night. Colour never carries a number alone: the counts are written under the bar and under each
// week, and each picture has a plain sentence for screen readers.

// One bar: done, in progress, not started, blocked, late. Each segment takes the colour of its status (the
// --status-*-fg tokens, and --late). Blocked and late are both red in most skins, so blocked is hatched and late
// is solid; the words under the bar name every part. `viewKey` makes the grow-in play once per browser tab for
// that surface (CSS .sbar-in in globals.css); the server writes the class so a hard load plays it with no flash.
export function StatusBar({ split, what = 'tasks', viewKey }: { split: StatusSplit; what?: string; viewKey: string }) {
  const first = useFirstView(viewKey);
  const draw = typeof window === 'undefined' ? true : first;
  const parts = splitParts(split);
  return (
    <div className="sbar">
      <div className={`sbar-track${draw ? ' sbar-in' : ''}`} role="img" aria-label={splitSummary(split, what)} suppressHydrationWarning>
        {parts.map((p) => <span key={p.key} className={`sb-${p.key}`} style={{ flexGrow: p.n }} />)}
      </div>
      <p className="sbar-text small">
        {parts.length === 0 ? <span className="dim">No {what} yet</span> : parts.map((p, i) => (
          <span key={p.key} className={p.key === 'late' ? 'late-text' : undefined}>
            {i > 0 && <span className="dim" aria-hidden> · </span>}
            <i className={`sb-${p.key}`} aria-hidden /> <b>{p.n}</b> {p.word}
          </span>
        ))}
      </p>
    </div>
  );
}

const W = 240, H = 64;
const BAR = 12, GAP = 4;

// Two thin bars a week: what was due and what was done, on one scale. The week's numbers are written under it.
export function DueDoneChart({ weeks }: { weeks: DueDone[] }) {
  const empty = weeksEmpty(weeks);
  const max = Math.max(...weeks.flatMap((w) => [w.due, w.done]));
  const h = (n: number) => (n > 0 ? Math.round(barShare(n, max) * (H - 4) * 100) / 100 : 0);
  const gw = W / weeks.length;
  const x0 = (i: number) => i * gw + (gw - (2 * BAR + GAP)) / 2;
  return (
    <Card title="Done against due" summary={dueDoneSummary(weeks)}>
      {empty ? (
        <p className="empty glance-empty" aria-hidden>Nothing was due or finished in the last {weeks.length} weeks. The chart fills in as work comes due.</p>
      ) : (
        <div className="dd" aria-hidden>
          <ul className="glance-legend">
            <li><i className="sb-done" />Done</li>
            <li><i className="sb-due" />Due</li>
          </ul>
          <svg className="glance-svg" viewBox={`0 0 ${W} ${H}`} focusable="false">
            <line className="gl-grid" x1="0" x2={W} y1={H - 0.5} y2={H - 0.5} />
            {weeks.map((w, i) => (
              <g key={w.weekStart}>
                {w.due > 0 && <rect className="dd-due" x={x0(i)} y={H - h(w.due)} width={BAR} height={h(w.due)} rx="2" />}
                {w.done > 0 && <rect className="dd-done" x={x0(i) + BAR + GAP} y={H - h(w.done)} width={BAR} height={h(w.done)} rx="2" />}
              </g>
            ))}
          </svg>
          <ol className="glance-weeks">
            {weeks.map((w) => (
              <li key={w.weekStart}>
                <b>{w.done} / {w.due}</b>
                <span className="dim">{fmtDate(w.weekStart)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </Card>
  );
}
