'use client';

import { Extension, type Editor } from '@tiptap/react';
import { useEffect, useRef, useState } from 'react';

// The running notes' extra tools (13 Nov): indent for any line, the colour and highlight palettes, and the icons the
// toolbar uses, drawn like the ones people know from Google Docs.

// Indent less / more. In a list it moves the item in or out a level; anywhere else it shifts the line by a step.
export const Indent = Extension.create({
  name: 'indent',
  addGlobalAttributes() {
    return [{
      types: ['paragraph', 'heading'],
      attributes: {
        indent: {
          default: 0,
          parseHTML: (el) => Number(el.getAttribute('data-indent')) || 0,
          renderHTML: (a) => (a.indent ? { 'data-indent': a.indent, style: `margin-left: ${Math.min(Number(a.indent), 8) * 2}em` } : {}),
        },
      },
    }];
  },
});

export function indent(editor: Editor, by: 1 | -1) {
  if (editor.isActive('listItem')) return by > 0 ? editor.chain().focus().sinkListItem('listItem').run() : editor.chain().focus().liftListItem('listItem').run();
  if (editor.isActive('taskItem')) return by > 0 ? editor.chain().focus().sinkListItem('taskItem').run() : editor.chain().focus().liftListItem('taskItem').run();
  const type = editor.isActive('heading') ? 'heading' : 'paragraph';
  const now = Number(editor.getAttributes(type).indent ?? 0);
  return editor.chain().focus().updateAttributes(type, { indent: Math.max(0, Math.min(8, now + by)) }).run();
}

export const TEXT_COLOURS: { name: string; value: string | null }[] = [
  { name: 'Default', value: null }, { name: 'Grey', value: '#6b6b6b' }, { name: 'Red', value: '#c0392b' }, { name: 'Orange', value: '#a24621' },
  { name: 'Green', value: '#2e7d4f' }, { name: 'Blue', value: '#1c5bd9' }, { name: 'Purple', value: '#7b3fa0' },
];
export const HIGHLIGHTS: { name: string; value: string | null }[] = [
  { name: 'None', value: null }, { name: 'Yellow', value: '#fff3a3' }, { name: 'Green', value: '#d4f5d0' }, { name: 'Blue', value: '#d6e6ff' },
  { name: 'Pink', value: '#ffd9e8' }, { name: 'Orange', value: '#ffe0c2' },
];

const S = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
export const ICON = {
  // Google Docs' list icons: three dots and lines; 1 2 3 and lines; two ticks and lines.
  bullets: <svg {...S} strokeWidth={2.2}><circle cx="5" cy="6" r="1.6" fill="currentColor" stroke="none" /><circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none" /><circle cx="5" cy="18" r="1.6" fill="currentColor" stroke="none" /><path d="M10 6h10M10 12h10M10 18h10" /></svg>,
  numbers: <svg {...S} strokeWidth={2.2}><text x="2.6" y="8" fontSize="6.5" fontWeight="700" fill="currentColor" stroke="none" fontFamily="system-ui">1</text><text x="2.6" y="14" fontSize="6.5" fontWeight="700" fill="currentColor" stroke="none" fontFamily="system-ui">2</text><text x="2.6" y="20" fontSize="6.5" fontWeight="700" fill="currentColor" stroke="none" fontFamily="system-ui">3</text><path d="M10 6h10M10 12h10M10 18h10" /></svg>,
  checklist: <svg {...S} strokeWidth={2.2}><path d="m3 7 2 2 3.5-4M3 16l2 2 3.5-4M12 7h9M12 16h9" /></svg>,
  indentLess: <svg {...S}><path d="M4 5h16M11 10h9M11 14h9M4 19h16M8 9.5 5 12l3 2.5" /></svg>,
  indentMore: <svg {...S}><path d="M4 5h16M11 10h9M11 14h9M4 19h16M5 9.5 8 12l-3 2.5" /></svg>,
  alignLeft: <svg {...S}><path d="M4 6h16M4 10h10M4 14h16M4 18h10" /></svg>,
  alignCenter: <svg {...S}><path d="M4 6h16M7 10h10M4 14h16M7 18h10" /></svg>,
  alignRight: <svg {...S}><path d="M4 6h16M10 10h10M4 14h16M10 18h10" /></svg>,
  highlight: <svg {...S}><path d="m14 4 6 6-8.5 8.5H6v-5.5Z" /><path d="m11 7 6 6" /></svg>,
  divider: <svg {...S}><path d="M4 12h16" /><path d="M8 7h8M8 17h8" strokeOpacity=".4" /></svg>,
  attach: <svg {...S}><path d="m20 11.5-8.2 8.2a5 5 0 0 1-7.1-7.1l8.6-8.6a3.4 3.4 0 0 1 4.8 4.8l-8.4 8.4a1.7 1.7 0 0 1-2.4-2.4l7.7-7.7" /></svg>,
};

// A small palette that opens under its button and closes on a pick, on Esc or on a click elsewhere.
export function Palette({ title, swatches, current, onPick, children }: {
  title: string; swatches: { name: string; value: string | null }[]; current: string | null; onPick: (v: string | null) => void; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', away); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <span className="rn-pal" ref={box}>
      <button type="button" className="rn-btn rn-drop" title={title} aria-label={title} aria-haspopup="true" aria-expanded={open}
        onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen(!open)}>{children}<span className="rn-caret" aria-hidden>▾</span></button>
      {open && (
        <span className="rn-pal-pop" role="menu" aria-label={title}>
          {swatches.map((s) => (
            <button key={s.name} type="button" role="menuitem" className={`rn-sw${(s.value ?? null) === current ? ' on' : ''}`} title={s.name} aria-label={s.name}
              onMouseDown={(e) => e.preventDefault()} onClick={() => { onPick(s.value); setOpen(false); }}
              style={{ background: s.value ?? 'var(--surface)' }}>{s.value ? '' : '⨯'}</button>
          ))}
        </span>
      )}
    </span>
  );
}

// One button for lists (13 Nov): it shows the kind in use and opens Checklist, Bulleted or Numbered.
export function ListMenu({ bullets, numbers, checks, onBullets, onNumbers, onChecks }: {
  bullets: boolean; numbers: boolean; checks: boolean; onBullets: () => void; onNumbers: () => void; onChecks: () => void;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', away); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  const pick = (run: () => void) => { run(); setOpen(false); };
  return (
    <span className="rn-pal" ref={box}>
      <button type="button" className={`rn-btn rn-drop${bullets || numbers || checks ? ' on' : ''}`} title="Lists" aria-label="Lists" aria-haspopup="true" aria-expanded={open}
        onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen(!open)}>{checks ? ICON.checklist : numbers ? ICON.numbers : ICON.bullets}<span className="rn-caret" aria-hidden>▾</span></button>
      {open && (
        <span className="rn-menu" role="menu" aria-label="Lists">
          <button type="button" role="menuitemcheckbox" aria-checked={checks} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(onChecks)}>{ICON.checklist}<span>Checklist</span></button>
          <button type="button" role="menuitemcheckbox" aria-checked={bullets} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(onBullets)}>{ICON.bullets}<span>Bulleted list</span></button>
          <button type="button" role="menuitemcheckbox" aria-checked={numbers} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(onNumbers)}>{ICON.numbers}<span>Numbered list</span></button>
        </span>
      )}
    </span>
  );
}
