'use client';

import { notify } from './toast';

// Copies the address of a task, person or project page, with a toast to say so. It writes nothing to the
// server, so it stays on while an admin views as someone else.
export function CopyLink({ path, what, className = 'mini-btn' }: { path: string; what: 'task' | 'person' | 'project'; className?: string }) {
  return (
    <button className={className} type="button" onClick={async () => {
      try { await navigator.clipboard.writeText(`${window.location.origin}${path}`); notify(`Link to this ${what} copied`); }
      catch { notify('Could not copy. Copy the address from the bar.'); }
    }}>Copy link</button>
  );
}
