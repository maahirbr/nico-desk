'use client';

import { useEffect, useState } from 'react';
import { inviteText } from '@/lib/invite';
import { useReadOnly } from './readonly';
import { notify } from './toast';

// After a copy the button says "Copied" for a moment, and a tick draws itself in front of the word (.copy-tick).
export function useCopied(): [boolean, () => void] {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);
  return [copied, () => setCopied(true)];
}

// A tick that draws once (stroke-dashoffset), beside a word that says what just happened.
export function DoneTick() {
  return <svg className="copy-tick" viewBox="0 0 12 12" aria-hidden><path d="M2.9 6.3l2.2 2.2 4-4.6" pathLength={1} /></svg>;
}

function Copied() {
  return <><DoneTick />Copied</>;
}

// Copies the address of a task, person or project page, with a toast to say so. It writes nothing to the
// server, so it stays on while an admin views as someone else.
export function CopyLink({ path, what, className = 'mini-btn' }: { path: string; what: 'task' | 'person' | 'project'; className?: string }) {
  const [copied, mark] = useCopied();
  return (
    <button className={className} type="button" onClick={async () => {
      try { await navigator.clipboard.writeText(`${window.location.origin}${path}`); mark(); notify(`Link to this ${what} copied`); }
      catch { notify('Could not copy. Copy the address from the bar.'); }
    }}>{copied ? <Copied /> : 'Copy link'}</button>
  );
}

// Copies a short invite for a person an admin has added: the site address, how to sign in and the email they
// were added with. The app sends nothing, so the admin pastes it where they like. Hidden under "View as".
export function CopyInvite({ email, className = 'act' }: { email: string; className?: string }) {
  const [copied, mark] = useCopied();
  if (useReadOnly()) return null;
  return (
    <button className={className} type="button" onClick={async () => {
      try { await navigator.clipboard.writeText(inviteText(window.location.origin, email)); mark(); notify('Invite copied. Paste it in a message to them.'); }
      catch { notify('Could not copy the invite.'); }
    }}>{copied ? <Copied /> : 'Copy invite'}</button>
  );
}
