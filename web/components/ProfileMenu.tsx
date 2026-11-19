'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Avatar } from './chips';
import { Help } from './HelpMode';
import { SKINS, SKIN_COOKIE, appearanceLabel, skinMenuName, skinOf, type SkinId } from './skins';
import { THEMES, THEME_COOKIE, themeOf, type ThemeId } from './theme';
import { setView, type ViewPerson } from './ViewAs';

// The one place for "you" at the foot of the sidebar: who you are, switching person (admins),
// the skin, light or dark, keyboard shortcuts and sign out. The skin and the theme go in cookies so the server can set
// data-skin and data-theme before first paint.

// viewPeople is null unless the real session person is an admin; the server checks again on every call.
// adminTools (19 Nov): 'shown' or 'hidden' for an admin, who can switch "Hide admin tools"; null for everyone else.
type Props = { meId: string; name: string; email: string; role: string; initial: SkinId; initialTheme: ThemeId; viewPeople: ViewPerson[] | null; viewingId: string | null; adminTools?: 'shown' | 'hidden' | null };

export function ProfileMenu({ meId, name, email, role, initial, initialTheme, viewPeople, viewingId, adminTools = null }: Props) {
  const router = useRouter();
  const [skin, setSkin] = useState<SkinId>(initial);
  const [theme, setTheme] = useState<ThemeId>(initialTheme);
  const [open, setOpen] = useState(false);
  const [looks, setLooks] = useState(false);
  const [who, setWho] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) { setLooks(false); setWho(false); return; }
    const away = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    // Escape closes the innermost layer first: an open flyout, then the menu.
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (looks || who) { setLooks(false); setWho(false); return; }
      setOpen(false); btn.current?.focus();
    };
    document.addEventListener('pointerdown', away);
    window.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); window.removeEventListener('keydown', esc); };
  }, [open, looks, who]);

  const pick = (id: SkinId) => {
    const next = skinOf(id);
    setSkin(next);
    document.documentElement.dataset.skin = next;
    document.cookie = `${SKIN_COOKIE}=${next}; path=/; max-age=31536000; SameSite=Lax`;
  };
  // The search box command "Appearance: ..." sends the same choice as the menu.
  useEffect(() => {
    const on = (e: Event) => pick(skinOf((e as CustomEvent<string>).detail));
    window.addEventListener('nd:skin', on);
    return () => window.removeEventListener('nd:skin', on);
  });
  const pickTheme = (id: ThemeId) => {
    const next = themeOf(id);
    setTheme(next);
    document.documentElement.dataset.theme = next;
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; SameSite=Lax`;
  };
  useEffect(() => {
    const on = (e: Event) => pickTheme(themeOf((e as CustomEvent<string>).detail));
    window.addEventListener('nd:theme', on);
    return () => window.removeEventListener('nd:theme', on);
  });
  const viewAs = async (id: string | null) => {
    setOpen(false);
    if (id === viewingId) return;
    if (await setView(id)) { router.push('/'); router.refresh(); }
  };
  // Hide admin tools: a cookie the server reads on every page (lib/auth.ts HIDE_ADMIN_COOKIE), then a fresh render.
  const toggleAdminTools = () => {
    setOpen(false);
    document.cookie = adminTools === 'hidden' ? 'nd_hide_admin=; path=/; max-age=0; SameSite=Lax' : 'nd_hide_admin=1; path=/; max-age=31536000; SameSite=Lax';
    router.refresh();
  };
  const signOut = async () => {
    setOpen(false);
    await fetch('/api/v1/session', { method: 'DELETE' });
    router.push('/signin');
    router.refresh();
  };

  return (
    <div className="menu-wrap profile-wrap" ref={wrap}>
      <button ref={btn} className={`who${adminTools === 'hidden' ? ' who-tools-hidden' : ''}`} aria-haspopup="menu" aria-expanded={open} aria-label={`${name}, account menu`} onClick={() => setOpen(!open)}>
        <Avatar id={meId} name={name} you />
        <span className="who-text">
          <span className="who-name">{name}</span>
          {/* Hide admin tools is on (19 Nov): said quietly here, in place of the role, rather than in a bar across the page. */}
          {adminTools === 'hidden'
            ? <span className="who-role who-hidden"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 3l18 18" /><path d="M10.6 5.1A10 10 0 0 1 12 5c6 0 9.5 7 9.5 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.9 8.4 2.5 12 2.5 12s3.5 7 9.5 7a9.6 9.6 0 0 0 4.4-1" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>Admin tools hidden</span>
            : <span className="who-role">{role}</span>}
        </span>
        <span className="who-chev" aria-hidden>⌃</span>
      </button>
      {open && (
        <div className="menu profile-menu" role="menu" aria-label="Account">
          <div className="pm-head" role="presentation">
            <span className="pm-name">{name}</span>
            <span className="pm-email">{email}</span>
          </div>
          {viewPeople && (
            <div className="pm-looks">
              <Help term="view_as" host><button role="menuitem" aria-haspopup="menu" aria-expanded={who} onClick={() => { setWho(!who); setLooks(false); }}>
                View as someone else<span className="pm-chev" aria-hidden>▸</span>
              </button></Help>
              {who && (
                <div className="menu pm-flyout va-menu" role="menu" aria-label="View as">
                  <button role="menuitemradio" aria-checked={viewingId === null} onClick={() => viewAs(null)}>
                    <span className="pm-tick" aria-hidden>{viewingId === null ? '✓' : ''}</span><span className="va-text"><b>Myself</b></span>
                  </button>
                  <div className="va-sep" role="separator" />
                  {viewPeople.map((p) => (
                    <button key={p.id} role="menuitemradio" aria-checked={viewingId === p.id} onClick={() => viewAs(p.id)}>
                      <span className="pm-tick" aria-hidden>{viewingId === p.id ? '✓' : ''}</span>
                      <Avatar id={p.id} name={p.name} />
                      <span className="va-text"><b>{p.name}</b><span className="va-roles">{p.roles}</span></span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="pm-looks">
            <button role="menuitem" aria-haspopup="menu" aria-expanded={looks} onClick={() => { setLooks(!looks); setWho(false); }}>
              <svg className="pm-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="9" /><path d="M12 3v18" /><path d="M12 3a9 9 0 0 1 0 18" fill="currentColor" stroke="none" />
              </svg>
              Appearance<span className="pm-current">{appearanceLabel(skin, theme)}</span><span className="pm-chev" aria-hidden>▸</span>
            </button>
            {looks && (
              <div className="menu pm-flyout" role="menu" aria-label="Appearance">
                {SKINS.map((s) => (
                  <button key={s.id} role="menuitemradio" aria-checked={skin === s.id} onClick={() => pick(s.id)}>
                    <span className="pm-tick" aria-hidden>{skin === s.id ? '✓' : ''}</span>{skinMenuName(s.id)}
                  </button>
                ))}
                <div className="pm-theme" role="radiogroup" aria-label="Light or dark">
                  {THEMES.map((t) => (
                    <button key={t.id} type="button" role="radio" aria-checked={theme === t.id} onClick={() => pickTheme(t.id)}>{t.name}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
          {adminTools && (
            <button role="menuitemcheckbox" aria-checked={adminTools === 'hidden'} className="pm-hide-admin" onClick={toggleAdminTools}>
              <span className="pm-tick" aria-hidden>{adminTools === 'hidden' ? '✓' : ''}</span>Hide admin tools
            </button>
          )}
          <Link role="menuitem" className="pm-sep" href="/me/profile" onClick={() => setOpen(false)}>Your profile</Link>
          <Link role="menuitem" href="/guide" onClick={() => setOpen(false)}>Guide</Link>
          <button role="menuitem" onClick={() => { setOpen(false); window.dispatchEvent(new Event('nd:shortcuts')); }}>Keyboard shortcuts</button>
          <button role="menuitem" className="pm-sep" onClick={signOut}>Sign out</button>
        </div>
      )}
    </div>
  );
}
