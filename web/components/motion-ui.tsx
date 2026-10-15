'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { indicatorMotion, useCountUp, useFirstView } from './motion';

// Small pieces built on the helpers in motion.ts. Each one shows the true thing first and moves only
// when a person is looking at it for the first time, and nothing moves under reduced motion.

// A list whose children rise in one after another, the first time it is shown in this browser tab.
// The class comes off after the last child has landed, so a row added later does not replay it.
export function Stagger({ id, className = '', children }: { id: string; className?: string; children: React.ReactNode }) {
  const first = useFirstView(`stagger:${id}`);
  const [on, setOn] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setOn(false), 900);
    return () => clearTimeout(t);
  }, []);
  // The server always writes the class, so the first document load staggers with no flash. A client-side
  // visit to a list already seen leaves it out.
  const stagger = typeof window === 'undefined' ? true : first && on;
  return <div className={`${className}${stagger ? ' stagger' : ''}`.trim()} suppressHydrationWarning>{children}</div>;
}

// A whole number that counts up once per session. `id` names it, so a second visit shows it at once.
export function CountUp({ value, id }: { value: number; id: string }) {
  const shown = useCountUp(value, id);
  return <>{shown}</>;
}

// The marker that slides between the items of a nav or a tab row. Put it inside the active item. All
// markers with the same `group` are one marker that moves.
export function SlideInd({ group, className }: { group: string; className: string }) {
  return <motion.span layoutId={group} className={className} aria-hidden {...indicatorMotion()} />;
}

// The ring beside the ledger's kept share: an arc of the share, drawn once per session (.ring-in in globals.css).
// The server writes the class so a hard load draws it with no flash. Reduced motion shows the arc at once.
export function KeptRing({ pct, id }: { pct: number; id: string }) {
  const first = useFirstView(`ring:${id}`);
  const draw = typeof window === 'undefined' ? true : first;
  return (
    <svg className={`kept-ring${draw ? ' ring-in' : ''}`} viewBox="0 0 36 36" aria-hidden suppressHydrationWarning>
      <circle className="kept-track" cx="18" cy="18" r="15" />
      <circle className="kept-arc" cx="18" cy="18" r="15" pathLength={100} strokeDasharray={`${pct} 100`}
        style={{ '--ring-from': pct } as React.CSSProperties} />
    </svg>
  );
}
