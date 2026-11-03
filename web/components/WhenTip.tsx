'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useHelpOn } from './HelpMode';

// "Updated 22 Sep · You" under a task's status pill, after a 1-second hover (the PM's call, 3 Nov). Light grey, like
// the ? button. It floats in a portal, fixed under the pill, so a table that scrolls sideways never clips it. Leaving,
// clicking or scrolling hides it. With help mode (?) on, the help text has this spot, so this stays away.
// Phones have no hover; there the same line heads the status menu.
const DELAY = 1000;

// off: hide it for now (the status menu is open) without changing what is rendered. The wrapper always stays, so the
// pill inside is never rebuilt: rebuilding it mid-click closed the status menu as it opened (fixed 3 Nov).
// delay: how long a hover waits (Activity's breakdown, 4 Nov: half a second). tap: a tap or click shows it at once and a
// second hides it, for phones, which have no hover. Text with line breaks shows one line each. side 'right': beside
// the thing, to its right, so it covers nothing in the row (Activity, 4 Nov); otherwise under it.
export function WhenTip({ text, off = false, delay = DELAY, tap = false, side = 'below', children }: {
  text: string | null | undefined; off?: boolean; delay?: number; tap?: boolean; side?: 'below' | 'right'; children: React.ReactNode;
}) {
  const box = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [at, setAt] = useState<React.CSSProperties | null>(null);
  const helpOn = useHelpOn();
  const tip = useRef<HTMLSpanElement>(null);
  // On the right, once its width is known: kept inside the screen, and under the thing when there is no room beside it.
  useLayoutEffect(() => {
    const t = tip.current, r = box.current?.getBoundingClientRect();
    if (!at || side !== 'right' || !t || !r || at.left === undefined) return;
    const w = t.offsetWidth;
    if (r.right + 10 + w + 8 <= window.innerWidth) return;
    setAt(r.left + w + 8 <= window.innerWidth ? { top: r.bottom + 4, left: r.left } : { top: r.bottom + 4, right: 8 });
  }, [at, side]);
  const stop = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; setAt(null); };
  useEffect(() => {
    if (!at) return;
    window.addEventListener('scroll', stop, true);
    return () => window.removeEventListener('scroll', stop, true);
  }, [at]);
  useEffect(() => stop, []);
  const quiet = !text || helpOn || off;
  useEffect(() => { if (quiet) stop(); }, [quiet]); // eslint-disable-line react-hooks/exhaustive-deps
  const place = () => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    setAt(side === 'right' ? { top: r.top + r.height / 2, left: r.right + 10, transform: 'translateY(-50%)' }
      : { top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) });
  };
  const start = () => {
    if (quiet) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(place, delay);
  };
  return (
    <span ref={box} className={`when-host${tap ? ' when-tap' : ''}`} onMouseEnter={start} onMouseLeave={stop}
      onMouseDown={tap ? undefined : stop} onClick={tap && !quiet ? () => (at ? stop() : place()) : undefined}>
      {children}
      {at && !quiet && createPortal(<span ref={tip} className={`when-tip${text?.includes('\n') ? ' when-list' : ''}`} role="tooltip" style={at}>{text}</span>, document.body)}
    </span>
  );
}
