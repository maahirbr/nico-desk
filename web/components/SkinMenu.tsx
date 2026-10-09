'use client';

import { useEffect, useRef, useState } from 'react';
import { SKINS, SKIN_COOKIE, skinOf, type SkinId } from './skins';

// Picks one of three skins. The choice goes in a cookie so the server can set data-skin before first paint.

export function SkinMenu({ initial }: { initial: SkinId }) {
  const [skin, setSkin] = useState<SkinId>(initial);
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); btn.current?.focus(); } };
    document.addEventListener('pointerdown', away);
    window.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); window.removeEventListener('keydown', esc); };
  }, [open]);

  const pick = (id: SkinId) => {
    const next = skinOf(id);
    setSkin(next);
    document.documentElement.dataset.skin = next;
    document.cookie = `${SKIN_COOKIE}=${next}; path=/; max-age=31536000; SameSite=Lax`;
    setOpen(false);
  };

  return (
    <div className="menu-wrap skin-wrap" ref={wrap}>
      <button ref={btn} className="act skin-btn" aria-haspopup="menu" aria-expanded={open} aria-label="Appearance and shortcuts" title="Appearance and shortcuts"
        onClick={() => setOpen(!open)}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="9" /><path d="M12 3v18" /><path d="M12 3a9 9 0 0 1 0 18" fill="currentColor" stroke="none" />
        </svg>
      </button>
      {open && (
        <div className="menu skin-menu" role="menu" aria-label="Appearance">
          {SKINS.map((s) => (
            <button key={s.id} role="menuitemradio" aria-checked={skin === s.id} onClick={() => pick(s.id)}>
              <span className="skin-tick" aria-hidden>{skin === s.id ? '✓' : ''}</span>{s.name}
            </button>
          ))}
          <button role="menuitem" className="skin-help" onClick={() => { setOpen(false); window.dispatchEvent(new Event('nd:help')); }}>
            <span className="skin-tick" aria-hidden />Keyboard shortcuts
          </button>
        </div>
      )}
    </div>
  );
}
