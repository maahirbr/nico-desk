'use client';

import { motion } from 'motion/react';
import { cloneElement, createContext, isValidElement, useContext, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { HELP_COOKIE, helpText, type HelpTerm } from './help';
import { isTyping } from './keys';
import { popoverMotion } from './motion';
import { ICON, Icon } from './icons';

// Help mode. One cookie (nd_help) says on or off, and layout.tsx reads it so the server HTML already
// carries the state. When on, <Help term="late">Late</Help> shows a dotted underline and a tooltip
// on hover, focus or tap. When off, it renders its children and nothing else: no wrapper, no tab stop.
// The words live in help.ts.

type Ctx = { on: boolean; toggle: () => void };
const HelpCtx = createContext<Ctx>({ on: false, toggle: () => {} });

export function useHelpOn(): boolean {
  return useContext(HelpCtx).on;
}

// For the search box command "Toggle help". It does what the ? button and key do.
export function useHelpToggle(): () => void {
  return useContext(HelpCtx).toggle;
}

export function HelpProvider({ initial, enabled, children }: { initial: boolean; enabled: boolean; children: React.ReactNode }) {
  const [on, setOn] = useState(initial && enabled);
  const toggle = () => {
    const next = !on;
    setOn(next);
    document.cookie = `${HELP_COOKIE}=${next ? '1' : '0'}; path=/; max-age=31536000; SameSite=Lax`;
  };
  // "?" turns help mode on or off. Like the other single keys, it stays out of the way of typing and dialogs.
  useEffect(() => {
    if (!enabled) return;
    const k = (e: KeyboardEvent) => {
      if (e.key !== '?' || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });
  return <HelpCtx.Provider value={{ on, toggle }}>{children}</HelpCtx.Provider>;
}

// The ? button in the top bar.
export function HelpToggle() {
  const { on, toggle } = useContext(HelpCtx);
  return (
    <button type="button" className="help-toggle" aria-pressed={on} aria-label="Help mode" title="Help mode (?)" onClick={toggle}><Icon d={ICON.help} /></button>
  );
}

const GAP = 6;
const EDGE = 8;

function Tip({ anchor, id, enter, leave, children }: { anchor: HTMLElement; id: string; enter: () => void; leave: () => void; children: React.ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; origin: string } | null>(null);
  // Fixed to the viewport. Goes below the term, flips above when there is more room there, and stays inside the edges.
  useLayoutEffect(() => {
    const p = panel.current;
    if (!p) return;
    const r = anchor.getBoundingClientRect();
    const w = p.offsetWidth, h = p.offsetHeight;
    const below = window.innerHeight - r.bottom - GAP - EDGE, above = r.top - GAP - EDGE;
    const up = h > below && above > below;
    const left = Math.min(Math.max(EDGE, r.left + r.width / 2 - w / 2), Math.max(EDGE, window.innerWidth - w - EDGE));
    const ox = Math.min(Math.max(r.left + r.width / 2 - left, 0), w);
    setPos({ top: up ? r.top - GAP - h : r.bottom + GAP, left, origin: `${ox}px ${up ? '100%' : '0'}` });
  }, [anchor]);
  const m = popoverMotion(pos?.origin ?? '50% 0');
  return createPortal(
    <motion.div ref={panel} id={id} role="tooltip" className="help-tip" onPointerEnter={enter} onPointerLeave={leave}
      {...m} style={{ ...m.style, top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? 'visible' : 'hidden' }}>
      {children}
    </motion.div>,
    document.body,
  );
}

type Props = { term: HelpTerm; note?: string; host?: boolean; children: React.ReactNode };

// Wrap the words that need explaining. `note` adds a second line, for facts about this one item.
// `host`: the child is already a button or link, so the tooltip hangs on that element itself (no extra
// tab stop, and its own click still works). Without `host`, the words get a span; a tap on it shows the tip.
const noop = () => () => {};

export function Help(props: Props) {
  const { on } = useContext(HelpCtx);
  return on ? <Live {...props} /> : <>{props.children}</>;
}

function Live({ term, note, host, children }: Props) {
  const id = useId();
  const [el, setEl] = useState<HTMLElement | null>(null); // the element the tip hangs on, while it is open
  const pinned = useRef(false); // opened by a click, a tap or Enter: stays until the next one
  const touched = useRef(false); // the last press on a host was a finger, not a mouse
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const clear = () => clearTimeout(timer.current);
  const later = (fn: () => void, ms: number) => { clear(); timer.current = setTimeout(fn, ms); };
  const show = (t: HTMLElement, pin = false) => { clear(); if (pin) pinned.current = true; setEl(t); };
  const hide = () => { clear(); pinned.current = false; setEl(null); };
  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    if (!el) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); hide(); } };
    const away = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!el.contains(t) && !document.getElementById(id)?.contains(t)) hide();
    };
    document.addEventListener('keydown', esc, true);
    document.addEventListener('pointerdown', away);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      document.removeEventListener('keydown', esc, true);
      document.removeEventListener('pointerdown', away);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
    // hide only touches refs and a setter, so it is safe to leave out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [el, id]);

  const mine = {
    onPointerEnter: (e: React.PointerEvent<HTMLElement>) => {
      if (e.pointerType !== 'mouse') return; // touch has no hover: a tap does it
      const t = e.currentTarget;
      later(() => show(t), 250);
    },
    onPointerLeave: (e: React.PointerEvent<HTMLElement>) => {
      if (e.pointerType === 'mouse' && !pinned.current) later(hide, 120);
    },
    // Only keyboard focus opens it; a mouse click on the term is handled by onClick.
    onFocus: (e: React.FocusEvent<HTMLElement>) => { if (e.currentTarget.matches(':focus-visible')) show(e.currentTarget); },
    onBlur: () => hide(),
    ...(host
      ? {
          // A mouse click on a control just acts. A first tap with a finger explains it, and a second tap acts,
          // since touch has no hover. Keyboard use (Enter, Space) is never touch, so it acts at once.
          onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
            touched.current = e.pointerType !== 'mouse';
            if (!touched.current) hide();
          },
          onClickCapture: (e: React.MouseEvent<HTMLElement>) => {
            const finger = touched.current;
            touched.current = false;
            if (finger && !(el && pinned.current)) { e.preventDefault(); e.stopPropagation(); show(e.currentTarget, true); }
          },
          onClick: () => hide(),
        }
      : {
          onClick: (e: React.MouseEvent<HTMLElement>) => {
            e.preventDefault(); e.stopPropagation();
            if (el && pinned.current) hide(); else show(e.currentTarget, true);
          },
          onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (el && pinned.current) hide(); else show(e.currentTarget, true); }
          },
        }),
  };

  const tipNode = el && (
    <Tip anchor={el} id={id} enter={clear} leave={() => { if (!pinned.current) later(hide, 120); }}>
      <p>{helpText(term)}</p>
      {note && <p className="help-note">{note}</p>}
    </Tip>
  );

  // A child sent from a server component is not yet an element during SSR, so the server draws the span below. The
  // first client draw (hydration) must match it; after that the tip hangs on the child itself.
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  if (host && hydrated && isValidElement<Record<string, unknown>>(children)) {
    // Our handlers run after the child's own, so nothing the child did is lost.
    const own = children.props;
    const chain = Object.fromEntries(Object.entries(mine).map(([k, f]) => [k, (e: unknown) => { (own[k] as ((e: unknown) => void) | undefined)?.(e); (f as (e: unknown) => void)(e); }]));
    return (
      <>
        {cloneElement(children, { ...chain, className: `${(own.className as string | undefined) ?? ''} help-host`.trim(), 'aria-describedby': el ? id : own['aria-describedby'] })}
        {tipNode}
      </>
    );
  }
  return (
    <>
      <span className="help-term" tabIndex={0} aria-describedby={el ? id : undefined} {...mine}>{children}</span>
      {tipNode}
    </>
  );
}
