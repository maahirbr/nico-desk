'use client';

import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { quickChips, today } from '@/lib/time';
import { fadeShift } from './motion';
import { useViewer } from './viewer';

// A date field: the native date input (so the phone and desktop pickers stay) with shortcut buttons
// under it. A button sets the value and fires the input's own change, so the caller's onChange runs
// as if the person had typed it. Dates are 'YYYY-MM-DD' in the app's local day. The shortcuts count from the
// same "today" the rest of the app uses (the viewer's, which the server pins for a demo), not the browser clock.

export function DateField({ className = '', onChange, ...rest }: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const input = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState(String(rest.defaultValue ?? ''));
  const { today: appToday } = useViewer();
  // Outside the viewer (no provider) the browser clock stands in, read after mount so the HTML matches.
  const [clock, setClock] = useState('');
  useEffect(() => { if (!appToday) setClock(today()); }, [appToday]);
  const from = appToday || clock;
  // The chips sit inside the caller's <label>, so they would join the input's name ("Due Today Tomorrow ...").
  // The name is the label's own text, set on the input; an aria-label from the caller wins.
  const [name, setName] = useState<string | undefined>();
  useEffect(() => {
    const label = input.current?.closest('label');
    if (!label || rest['aria-label']) return;
    const copy = label.cloneNode(true) as HTMLElement;
    copy.querySelector('.datefield')?.remove();
    copy.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove()); // a required field's * is not part of its name
    const text = copy.textContent?.trim().replace(/\s+/g, ' ');
    setName(text || undefined);
  });
  const current = rest.value !== undefined ? String(rest.value) : typed;

  function set(v: string) {
    const el = input.current;
    if (!el) return;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
  const chips = from ? quickChips(from, rest.min ? String(rest.min) : '', rest.max ? String(rest.max) : '') : [];
  return (
    <span className={`datefield ${className}`.trim()}>
      <input aria-label={name} {...rest} ref={input} type="date" onChange={(e) => { setTyped(e.target.value); onChange?.(e); }} />
      {chips.length > 0 && (
        <span className="date-quick" role="group" aria-label="Quick dates">
          {chips.map((c, i) => (
            <motion.span key={c.key} {...fadeShift(i)}>
              <button type="button" className="mini-btn" aria-pressed={current === c.date}
                disabled={rest.disabled || c.off} onClick={() => set(c.date)}>
                {c.word}
              </button>
            </motion.span>
          ))}
        </span>
      )}
    </span>
  );
}
