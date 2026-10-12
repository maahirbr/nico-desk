'use client';

import { useRouter } from 'next/navigation';

// Admin-only. The call behind "View as someone else" in the account menu, and the banner that stays
// on screen while viewing. Both talk to /api/v1/session/view; the server checks the admin role every time.

export type ViewPerson = { id: string; name: string; roles: string };

export async function setView(personId: string | null): Promise<boolean> {
  const res = personId
    ? await fetch('/api/v1/session/view', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ personId }) })
    : await fetch('/api/v1/session/view', { method: 'DELETE' });
  return res.ok;
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
