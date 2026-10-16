'use client';

import { useEffect, useRef, useState } from 'react';
import { reduced } from './motion';

// A fold-out body. It opens its height (grid rows 0fr to 1fr, a named exception in DESIGN.md Motion) and fades in
// over --dur-fold. The body mounts on the first open and stays, so a close can fold too. A closed body is inert:
// no tab stop, nothing read aloud. It clips only while it moves, so focus rings and card shadows show once open.
// When it opens below the fold, the page scrolls just enough to show it, never past its own button.
export function Fold({ open, children }: { open: boolean; children: React.ReactNode }) {
  const [seen, setSeen] = useState(open);
  const [settled, setSettled] = useState(open);
  const [was, setWas] = useState(open);
  const [nudge, setNudge] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  if (open !== was) { setWas(open); setSettled(reduced() ? open : false); setNudge(open); if (open) setSeen(true); }
  // The scroll waits for the fold to settle: while it grows, the page has no room yet to scroll it into view.
  useEffect(() => {
    if (!nudge || !settled) return;
    setNudge(false);
    if (box.current) showFold(box.current);
  }, [nudge, settled]);
  // Settles at the 300ms motion ceiling, past --dur-fold. A timer, not transitionend, which a hidden tab never fires.
  useEffect(() => {
    if (settled === open) return;
    const t = setTimeout(() => setSettled(open), 300);
    return () => clearTimeout(t);
  }, [open, settled]);
  return (
    <div ref={box} className="fold" data-open={open} data-settled={settled} inert={!open}>
      <div className="fold-in">{(seen || open) && children}</div>
    </div>
  );
}

// The scroll area is the nearest one that scrolls: a drawer, the page sheet on the Cool skin's wide screen
// (tokens.css, the top edge), or the window. The fold's full height is read from its inner box, since the fold
// itself is still growing. In the page, the sticky top bar is the ceiling.
function showFold(el: HTMLElement) {
  let inner: HTMLElement | null = el.parentElement;
  while (inner && !(/auto|scroll/.test(getComputedStyle(inner).overflowY) && inner.scrollHeight > inner.clientHeight)) inner = inner.parentElement;
  const view = inner ? inner.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
  const bar = !inner || inner.matches('.main') ? document.querySelector<HTMLElement>('.main > .topbar') : null;
  const floor = (bar ? bar.getBoundingClientRect().bottom : view.top) + 8;
  const head = (el.previousElementSibling as HTMLElement | null) ?? el;
  const bottom = el.getBoundingClientRect().top + (el.firstElementChild as HTMLElement).scrollHeight;
  const by = Math.min(bottom + 8 - view.bottom, head.getBoundingClientRect().top - floor);
  if (by > 0) (inner ?? window).scrollBy({ top: by, behavior: reduced() ? 'auto' : 'smooth' });
}

// The chevron on a fold's button. It points right when closed and turns down when the button's aria-expanded is true.
export function FoldChev() {
  return (
    <svg className="fold-chev" viewBox="0 0 12 12" width="10" height="10" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 2.5 8 6l-3.5 3.5" />
    </svg>
  );
}
