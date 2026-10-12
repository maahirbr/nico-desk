'use client';

import { AnimatePresence } from 'motion/react';
import { Children, Fragment, isValidElement, useId, useRef, useState } from 'react';
import { Popover } from './popover';

// A token-styled stand-in for <select>. It takes <option> and <optgroup> children like the native
// one, and `onChange` gets the value (not an event). With `name` it posts the value from a hidden
// input, so a plain form keeps working. Keys and closing come from Popover; on a phone it is a
// bottom sheet.

type Opt = { value: string; label: string; disabled: boolean; group?: string };

const text = (n: React.ReactNode) => Children.toArray(n).join('');

function parse(children: React.ReactNode, group?: string, out: Opt[] = []): Opt[] {
  Children.forEach(children, (c) => {
    if (!isValidElement(c)) return;
    const p = c.props as { value?: string | number; label?: string; disabled?: boolean; children?: React.ReactNode };
    if (c.type === 'option') out.push({ value: String(p.value ?? text(p.children)), label: text(p.children), disabled: !!p.disabled, group });
    else if (c.type === 'optgroup') parse(p.children, p.label, out);
    else if (c.type === Fragment) parse(p.children, group, out);
  });
  return out;
}

export function Select({ value, defaultValue, onChange, name, disabled, className = '', id, title, 'aria-label': ariaLabel, children }: {
  value?: string; defaultValue?: string; onChange?: (value: string) => void; name?: string; disabled?: boolean;
  className?: string; id?: string; title?: string; 'aria-label'?: string; children: React.ReactNode;
}) {
  const opts = parse(children);
  const [own, setOwn] = useState(defaultValue ?? opts[0]?.value ?? '');
  const current = value ?? own;
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const shown = opts.find((o) => o.value === current) ?? opts[0];
  const pick = (v: string) => {
    setOpen(false);
    btn.current?.focus();
    if (value === undefined) setOwn(v);
    if (v !== current) onChange?.(v);
  };
  const groups = [...new Set(opts.map((o) => o.group))];
  const option = (o: Opt) => (
    <div key={o.value} role="option" tabIndex={-1} className="sel-opt" aria-selected={o.value === current} aria-disabled={o.disabled || undefined}
      onClick={() => { if (!o.disabled) pick(o.value); }}>
      <span>{o.label}</span>
      <svg className="sel-tick" viewBox="0 0 16 16" width="14" height="14" aria-hidden><path d="M3 8.5l3.2 3.2L13 4.8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </div>
  );
  return (
    <>
      <button ref={btn} type="button" id={id} title={title} disabled={disabled} className={`sel-btn ${className}`.trim()} aria-label={ariaLabel ? `${ariaLabel}: ${shown?.label ?? ''}` : undefined}
        aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => { if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); setOpen(true); } }}>
        <span className="sel-label">{shown?.label}</span>
        {/* Holds every label, unseen, so the button is as wide as the longest option, like a native select. */}
        <span className="sel-sizer" aria-hidden>{opts.map((o) => <span key={o.value}>{o.label}</span>)}</span>
      </button>
      {name && <input type="hidden" name={name} value={current} />}
      <AnimatePresence>
        {open && (
          <Popover anchor={btn} onClose={() => setOpen(false)} matchWidth sheet role="listbox" label={ariaLabel ?? shown?.label ?? 'Options'} id={listId} className="sel-pop">
            {groups.map((g) => g === undefined ? opts.filter((o) => o.group === undefined).map(option) : (
              <div key={`g-${g}`} role="group" aria-label={g}>
                <div className="sel-group" aria-hidden>{g}</div>
                {opts.filter((o) => o.group === g).map(option)}
              </div>
            ))}
          </Popover>
        )}
      </AnimatePresence>
    </>
  );
}
