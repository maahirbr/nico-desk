'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Avatar } from './chips';

// Admin-only. A small menu beside the avatar to review the site as another person, and the banner that stays
// on screen while doing so. Both talk to /api/v1/session/view; the server checks the admin role every time.

export type ViewPerson = { id: string; name: string; roles: string };

async function setView(personId: string | null): Promise<boolean> {
  const res = personId
    ? await fetch('/api/v1/session/view', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ personId }) })
    : await fetch('/api/v1/session/view', { method: 'DELETE' });
  return res.ok;
}

export function ViewAsMenu({ people, viewingId }: { people: ViewPerson[]; viewingId: string | null }) {
  const router = useRouter();
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

  async function pick(id: string | null) {
    setOpen(false);
    if (id === viewingId) return;
    if (await setView(id)) { router.push('/'); router.refresh(); }
  }

  return (
    <div className="menu-wrap va-wrap" ref={wrap}>
      <button ref={btn} className="act skin-btn" aria-haspopup="menu" aria-expanded={open} aria-label="View as…" title="View as…" onClick={() => setOpen(!open)}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z" /><circle cx="12" cy="12" r="3" />
        </svg>
      </button>
      {open && (
        <div className="menu va-menu" role="menu" aria-label="View as">
          <button role="menuitemradio" aria-checked={viewingId === null} onClick={() => pick(null)}>
            <span className="skin-tick" aria-hidden>{viewingId === null ? '✓' : ''}</span><span className="va-text"><b>Myself</b></span>
          </button>
          <div className="va-sep" role="separator" />
          {people.map((p) => (
            <button key={p.id} role="menuitemradio" aria-checked={viewingId === p.id} onClick={() => pick(p.id)}>
              <span className="skin-tick" aria-hidden>{viewingId === p.id ? '✓' : ''}</span>
              <Avatar name={p.name} />
              <span className="va-text"><b>{p.name}</b><span className="va-roles">{p.roles}</span></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ViewBanner({ name, role }: { name: string; role: string }) {
  const router = useRouter();
  return (
    <div className="view-banner" role="status">
      <span className="vb-text">Viewing as <b>{name}</b> ({role}). Read-only.</span>
      <button className="vb-back" onClick={async () => { if (await setView(null)) { router.push('/'); router.refresh(); } }}>Back to my view</button>
    </div>
  );
}
