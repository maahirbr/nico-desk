'use client';

import { motion } from 'motion/react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { popoverMotion, scrimMotion, sheetMotion } from './motion';

// The one pop-up under Select and StatusMenu: positioning, keys and closing live here. The parent
// owns `open` and renders this inside <AnimatePresence>, so it animates out before it unmounts.
// Items are `[role^="menuitem"]` or `[role="option"]`; focus moves between them (roving DOM focus).

const ITEMS = '[role^="menuitem"]:not(:disabled), [role="option"]:not([aria-disabled="true"])';
const CHECKED = '[aria-checked="true"], [aria-selected="true"]';
const GAP = 4;
const EDGE = 8;
const MAX = 320;

type Pos = { top: number; left: number; maxHeight: number; minWidth: number; origin: string };

export function Popover({ anchor, onClose, align = 'start', matchWidth, sheet, className = '', role, label, id, children }: {
  anchor: React.RefObject<HTMLElement | null>; onClose: () => void; align?: 'start' | 'end'; matchWidth?: boolean;
  sheet?: boolean; className?: string; role: 'menu' | 'listbox'; label: string; id?: string; children: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const typed = useRef({ s: '', at: 0 });
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; });
  // On a phone a Select becomes a bottom sheet; a menu stays next to its button.
  const [phone] = useState(() => !!sheet && typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches);
  const [pos, setPos] = useState<Pos | null>(null);

  // Fixed to the viewport, since lists and drawers clip what overflows them. Flips up when there is
  // more room above, and stays 8px inside the edges.
  useLayoutEffect(() => {
    const a = anchor.current, p = panel.current;
    if (phone || !a || !p) return;
    const r = a.getBoundingClientRect();
    const w = Math.max(p.offsetWidth, matchWidth ? r.width : 0), h = p.offsetHeight;
    const below = window.innerHeight - r.bottom - GAP - EDGE, above = r.top - GAP - EDGE;
    const up = h > below && above > below;
    const maxHeight = Math.min(MAX, up ? above : below);
    const left = Math.min(Math.max(EDGE, align === 'end' ? r.right - w : r.left), window.innerWidth - w - EDGE);
    const ox = Math.min(Math.max(r.left + r.width / 2 - left, 0), w);
    setPos({ top: up ? r.top - GAP - Math.min(h, maxHeight) : r.bottom + GAP, left, maxHeight, minWidth: matchWidth ? r.width : 0, origin: `${ox}px ${up ? '100%' : '0'}` });
  }, [anchor, align, matchWidth, phone]);

  const ready = phone || pos !== null;
  useEffect(() => {
    if (!ready) return;
    const list = [...(panel.current?.querySelectorAll<HTMLElement>(ITEMS) ?? [])];
    (list.find((i) => i.matches(CHECKED)) ?? list[0])?.focus();
  }, [ready]);

  useEffect(() => {
    const away = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !anchor.current?.contains(t)) close.current();
    };
    const shut = (e: Event) => { if (!panel.current?.contains(e.target as Node)) close.current(); };
    document.addEventListener('pointerdown', away);
    if (!phone) { window.addEventListener('scroll', shut, true); window.addEventListener('resize', shut); }
    return () => { document.removeEventListener('pointerdown', away); window.removeEventListener('scroll', shut, true); window.removeEventListener('resize', shut); };
  }, [anchor, phone]);

  function onKeyDown(e: React.KeyboardEvent) {
    const list = [...(panel.current?.querySelectorAll<HTMLElement>(ITEMS) ?? [])];
    const i = list.indexOf(document.activeElement as HTMLElement);
    const go = (n: number) => { e.preventDefault(); list[(n + list.length) % list.length]?.focus(); };
    if (e.key === 'ArrowDown') go(i + 1);
    else if (e.key === 'ArrowUp') go(i < 0 ? -1 : i - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(-1);
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); anchor.current?.focus(); }
    // Focus goes back to the button first, so the Tab itself moves on from there.
    else if (e.key === 'Tab') { anchor.current?.focus(); onClose(); }
    else if ((e.key === 'Enter' || (e.key === ' ' && Date.now() - typed.current.at > 700)) && list[i]?.getAttribute('role') === 'option') { e.preventDefault(); list[i].click(); }
    else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Type to find: letters typed in quick succession match the start of an item's text.
      const t = typed.current, now = Date.now();
      t.s = now - t.at > 700 ? e.key.toLowerCase() : t.s + e.key.toLowerCase();
      t.at = now;
      for (let k = 0; k < list.length; k++) {
        const c = list[(i + (t.s.length === 1 ? 1 : 0) + k + list.length) % list.length];
        if (c.textContent?.trim().toLowerCase().startsWith(t.s)) { e.preventDefault(); c.focus(); break; }
      }
    }
  }

  // A click inside the pop-up must not reach a clickable row or card the button sits in.
  const common = { ref: panel, role, id, 'aria-label': label, onKeyDown, onClick: (e: React.MouseEvent) => e.stopPropagation() };
  const { style: ms, ...pop } = popoverMotion(pos?.origin ?? '0 0');
  return createPortal(
    phone ? (
      <>
        <motion.div className="pop-scrim" aria-hidden {...scrimMotion()} />
        <motion.div {...common} className={`pop pop-sheet ${className}`.trim()} {...sheetMotion()}>{children}</motion.div>
      </>
    ) : (
      <motion.div {...common} className={`pop ${className}`.trim()} {...pop}
        style={{ ...ms, top: pos?.top ?? 0, left: pos?.left ?? 0, right: 'auto', bottom: 'auto', maxHeight: pos?.maxHeight, minWidth: pos?.minWidth || undefined }}>
        {children}
      </motion.div>
    ),
    document.body,
  );
}
