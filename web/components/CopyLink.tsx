'use client';

import { AnimatePresence } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { inviteEmail, inviteText } from '@/lib/invite';
import { Popover } from './popover';
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

// "Invite to join ▾" (4 Nov): By email opens a filled-in email in the admin's own Gmail, from their address; Copy
// Copy for WhatsApp copies the short text to paste in a chat. The app sends nothing. Hidden under "View as".
export function InviteMenu({ email, name, from, className = 'act' }: { email: string; name: string; from: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [copied, mark] = useCopied();
  const btn = useRef<HTMLButtonElement>(null);
  if (useReadOnly()) return null;
  const mail = () => { setOpen(false); openInviteEmail(email, name, from); };
  const copy = async () => {
    setOpen(false);
    try { await navigator.clipboard.writeText(inviteText(window.location.origin, email)); mark(); notify('Invite copied. Paste it in a message to them.'); }
    catch { notify('Could not copy the invite.'); }
  };
  return (
    <span className="menu-wrap invite-wrap">
      <button ref={btn} className={className} type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        {copied ? <Copied /> : <>Invite to join <span aria-hidden>▾</span></>}
      </button>
      <AnimatePresence>
        {open && (
          <Popover anchor={btn} onClose={() => setOpen(false)} align="end" role="menu" label="Invite" className="menu">
            <button type="button" role="menuitem" onClick={mail}>By email</button>
            <button type="button" role="menuitem" onClick={copy}>Copy for WhatsApp</button>
          </Popover>
        )}
      </AnimatePresence>
    </span>
  );
}

// Opens the invite as a new email in the admin's own Gmail, filled in. Nothing is sent until they press Send there.
function openInviteEmail(email: string, name: string, from: string) {
  const m = inviteEmail(window.location.origin, email, name, from);
  window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${encodeURIComponent(m.subject)}&body=${encodeURIComponent(m.body)}`, '_blank', 'noopener,noreferrer');
  notify('Opened in Gmail. Check it and press Send there.');
}

// The Roster's one button (4 Nov): Email invite, straight to the filled-in email. Hidden under "View as".
export function EmailInvite({ email, name, from, className = 'act' }: { email: string; name: string; from: string; className?: string }) {
  if (useReadOnly()) return null;
  return <button className={className} type="button" onClick={() => openInviteEmail(email, name, from)}>Email invite</button>;
}
