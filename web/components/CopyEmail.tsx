'use client';

import { notify } from './toast';

// Copies a teammate's email address. It writes nothing to the server, so it stays on under View as.
export function CopyEmail({ email }: { email: string }) {
  return (
    <button className="mini-btn" type="button" aria-label={`Copy ${email}`} onClick={async () => {
      try { await navigator.clipboard.writeText(email); notify('Email copied'); }
      catch { notify('Could not copy. Select the address and copy it.'); }
    }}>Copy</button>
  );
}
