'use client';

import { useEffect, useState } from 'react';
import { reduced } from './motion';

// A fold-out body. It opens its height (grid rows 0fr to 1fr, a named exception in DESIGN.md Motion) and fades in
// over --dur-fold. The body mounts on the first open and stays, so a close can fold too. A closed body is inert:
// no tab stop, nothing read aloud. It clips only while it moves, so focus rings and card shadows show once open.
export function Fold({ open, children }: { open: boolean; children: React.ReactNode }) {
  const [seen, setSeen] = useState(open);
  const [settled, setSettled] = useState(open);
  const [was, setWas] = useState(open);
  if (open !== was) { setWas(open); setSettled(reduced() ? open : false); if (open) setSeen(true); }
  // Settles at the 300ms motion ceiling, past --dur-fold. A timer, not transitionend, which a hidden tab never fires.
  useEffect(() => {
    if (settled === open) return;
    const t = setTimeout(() => setSettled(open), 300);
    return () => clearTimeout(t);
  }, [open, settled]);
  return (
    <div className="fold" data-open={open} data-settled={settled} inert={!open}>
      <div className="fold-in">{(seen || open) && children}</div>
    </div>
  );
}

// The chevron on a fold's button. It points right when closed and turns down when the button's aria-expanded is true.
export function FoldChev() {
  return (
    <svg className="fold-chev" viewBox="0 0 12 12" width="10" height="10" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 2.5 8 6l-3.5 3.5" />
    </svg>
  );
}
