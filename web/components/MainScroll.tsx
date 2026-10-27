'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

// On the Cool skin's wide screen the page sheet (.main) is its own scroll area (tokens.css, the top edge).
// This sets --cap-fade so content fades out over up to 16px as it goes under the top cap, and not at all
// while a sticky header sits right under the cap. Each new page starts at the top, which the browser does
// only for the window. On every other skin and width .main does not scroll, so both are no-ops.
export function MainScroll() {
  const path = usePathname();
  useEffect(() => {
    const main = document.querySelector<HTMLElement>('.main');
    if (main) main.scrollTop = 0;
  }, [path]);
  useEffect(() => {
    const main = document.querySelector<HTMLElement>('.main');
    if (!main) return;
    let frame = 0;
    let was = '';
    const set = () => {
      frame = 0;
      const bar = main.querySelector<HTMLElement>('.topbar');
      if (!bar) return;
      const floor = bar.getBoundingClientRect().bottom;
      const stuck = [...main.querySelectorAll<HTMLElement>('table.sticky-head thead th, .group > h2')]
        .some((h) => Math.abs(h.getBoundingClientRect().top - floor) < 1);
      const fade = (stuck ? 0 : Math.min(16, main.scrollTop) / 16).toFixed(3);
      if (fade !== was) { was = fade; main.style.setProperty('--cap-fade', fade); }
    };
    const on = () => { if (!frame) frame = requestAnimationFrame(set); };
    main.addEventListener('scroll', on, { passive: true });
    set();
    return () => { main.removeEventListener('scroll', on); cancelAnimationFrame(frame); };
  }, []);
  return null;
}
