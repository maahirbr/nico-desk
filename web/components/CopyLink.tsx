'use client';

import { inviteText } from '@/lib/invite';
import { useReadOnly } from './readonly';
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

// Copies a short invite for a person an admin has added: the site address, how to sign in and the email they
// were added with. The app sends nothing, so the admin pastes it where they like. Hidden under "View as".
export function CopyInvite({ email, className = 'act' }: { email: string; className?: string }) {
  if (useReadOnly()) return null;
  return (
    <button className={className} type="button" onClick={async () => {
      try { await navigator.clipboard.writeText(inviteText(window.location.origin, email)); notify('Invite copied. Paste it in a message to them.'); }
      catch { notify('Could not copy the invite.'); }
    }}>Copy invite</button>
  );
}
