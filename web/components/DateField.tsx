'use client';

import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { quickDates, today } from '@/lib/time';
import { fadeShift } from './motion';

// A date field: the native date input (so the phone and desktop pickers stay) with shortcut buttons
// under it. A button sets the value and fires the input's own change, so the caller's onChange runs
// as if the person had typed it. Dates are 'YYYY-MM-DD' in the app's local day.

const WORDS = [['today', 'Today'], ['tomorrow', 'Tomorrow'], ['friday', 'Friday'], ['nextMonday', 'Next Monday']] as const;

export function DateField({ className = '', onChange, ...rest }: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const input = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState(String(rest.defaultValue ?? ''));
  // Worked out after mount: the server may pin "today" for a demo, the browser does not.
  const [days, setDays] = useState<ReturnType<typeof quickDates> | null>(null);
  useEffect(() => { setDays(quickDates(today())); }, []);
  const current = rest.value !== undefined ? String(rest.value) : typed;

  function set(v: string) {
    const el = input.current;
    if (!el) return;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
  const seen = new Set<string>();
  const chips = days ? WORDS.filter(([k]) => !seen.has(days[k]) && seen.add(days[k])) : [];
  const min = rest.min ? String(rest.min) : '', max = rest.max ? String(rest.max) : '';
  return (
    <span className={`datefield ${className}`.trim()}>
      <input {...rest} ref={input} type="date" onChange={(e) => { setTyped(e.target.value); onChange?.(e); }} />
      {days && (
        <span className="date-quick" role="group" aria-label="Quick dates">
          {chips.map(([k, word], i) => (
            <motion.span key={k} {...fadeShift(i)}>
              <button type="button" className="mini-btn" aria-pressed={current === days[k]}
                disabled={rest.disabled || (!!min && days[k] < min) || (!!max && days[k] > max)} onClick={() => set(days[k])}>
                {word}
              </button>
            </motion.span>
          ))}
        </span>
      )}
    </span>
  );
}
