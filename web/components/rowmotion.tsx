'use client';

import { useState } from 'react';
import { arrivals, usePreviousWhileChanging } from './motion';

// The three gestures for the board tables, which render their own rows. Same classes and timings as
// TaskRow: arrive, move a date, set a state. All movement is CSS (globals.css, Motion).

// A table row that rises in once when this tab just made it.
export function MotionRow({ id, className = '', children, ...rest }: React.HTMLAttributes<HTMLTableRowElement> & { id: string }) {
  const [arrive] = useState(() => arrivals.delete(id));
  return <tr {...rest} className={`${className}${arrive ? ' arrive' : ''}`.trim() || undefined}>{children}</tr>;
}

// A date: when `value` changes, the old text is struck through and the new one slides in.
export function MovedDate({ value, text, fmt }: { value: string; text: string; fmt: (v: string) => string }) {
  const old = usePreviousWhileChanging(value, 360);
  return (
    <>
      {old !== undefined && <span className="date-old" aria-hidden>{fmt(old)}</span>}
      <span className={old !== undefined ? 'date-new' : undefined}>{text}</span>
    </>
  );
}

// A status control that crossfades when its value changes.
export function StateSelect({ value, className = '', children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement> & { value: string }) {
  const from = usePreviousWhileChanging(value, 140);
  return <select {...rest} value={value} className={`${className}${from !== undefined ? ' state-set' : ''}`.trim()}>{children}</select>;
}
