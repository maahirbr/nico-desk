'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useHelpOn } from './HelpMode';

// "You set this on 22 Sep" under a task's status pill, after a 1-second hover (the PM's call, 3 Nov). Light grey, like
// the ? button. It floats in a portal, fixed under the pill, so a table that scrolls sideways never clips it. Leaving,
// clicking or scrolling hides it. With help mode (?) on, the help text has this spot, so this stays away.
// Phones have no hover; there the same line heads the status menu.
const DELAY = 1000;

export function WhenTip({ text, children }: { text: string | null | undefined; children: React.ReactNode }) {
  const box = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [at, setAt] = useState<{ top: number; right: number } | null>(null);
  const helpOn = useHelpOn();
  const stop = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; setAt(null); };
  useEffect(() => {
    if (!at) return;
    window.addEventListener('scroll', stop, true);
    return () => window.removeEventListener('scroll', stop, true);
  }, [at]);
  useEffect(() => stop, []);
  useEffect(() => { if (helpOn) stop(); }, [helpOn]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!text || helpOn) return <>{children}</>;
  const start = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const r = box.current?.getBoundingClientRect();
      if (r) setAt({ top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) });
    }, DELAY);
  };
  return (
    <span ref={box} className="when-host" onMouseEnter={start} onMouseLeave={stop} onMouseDown={stop}>
      {children}
      {at && createPortal(<span className="when-tip" role="tooltip" style={{ top: at.top, right: at.right }}>{text}</span>, document.body)}
    </span>
  );
}
