'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Avatar } from './chips';
import { SKINS, SKIN_COOKIE, skinOf, type SkinId } from './skins';

// The one place for "you" at the foot of the sidebar: who you are, switching person (admins),
// the skin, keyboard shortcuts and sign out. The skin goes in a cookie so the server can set data-skin before first paint.

type Props = { name: string; email: string; role: string; isAdmin: boolean; initial: SkinId };

export function ProfileMenu({ name, email, role, isAdmin, initial }: Props) {
  const router = useRouter();
  const [skin, setSkin] = useState<SkinId>(initial);
  const [open, setOpen] = useState(false);
  const [looks, setLooks] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) { setLooks(false); return; }
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
  };
  const signOut = async () => {
    setOpen(false);
    await fetch('/api/v1/session', { method: 'DELETE' });
    router.push('/signin');
    router.refresh();
  };

  return (
    <div className="menu-wrap profile-wrap" ref={wrap}>
      <button ref={btn} className="who" aria-haspopup="menu" aria-expanded={open} aria-label={`${name}, account menu`} onClick={() => setOpen(!open)}>
        <Avatar name={name} you />
        <span className="who-text">
          <span className="who-name">{name}</span>
          <span className="who-role">{role}</span>
        </span>
        <span className="who-chev" aria-hidden>⌃</span>
      </button>
      {open && (
        <div className="menu profile-menu" role="menu" aria-label="Account">
          <div className="pm-head" role="presentation">
            <span className="pm-name">{name}</span>
            <span className="pm-email">{email}</span>
          </div>
          {isAdmin && (
            <button role="menuitem" onClick={() => { setOpen(false); router.push('/signin?switch=1'); }}>View as someone else</button>
          )}
          <div className="pm-looks">
            <button role="menuitem" aria-haspopup="menu" aria-expanded={looks} onClick={() => setLooks(!looks)}>
              <svg className="pm-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="9" /><path d="M12 3v18" /><path d="M12 3a9 9 0 0 1 0 18" fill="currentColor" stroke="none" />
              </svg>
              Appearance<span className="pm-current">{SKINS.find((x) => x.id === skin)?.name}</span><span className="pm-chev" aria-hidden>▸</span>
            </button>
            {looks && (
              <div className="menu pm-flyout" role="menu" aria-label="Appearance">
                {SKINS.map((s) => (
                  <button key={s.id} role="menuitemradio" aria-checked={skin === s.id} onClick={() => pick(s.id)}>
                    <span className="pm-tick" aria-hidden>{skin === s.id ? '✓' : ''}</span>{s.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button role="menuitem" className="pm-sep" onClick={() => { setOpen(false); window.dispatchEvent(new Event('nd:help')); }}>Keyboard shortcuts</button>
          <button role="menuitem" className="pm-sep" onClick={signOut}>Sign out</button>
        </div>
      )}
    </div>
  );
}
