'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useReadOnly } from './readonly';
import { newNoticeIds, play } from './sound';

// Home asks for unread notices every 60 seconds while the tab is visible, and once when the tab comes back.
// The notices on the page at load are already known, so nothing sounds on load. A new one pings once, the page
// reads itself again, and a small count eases in (the .arrive move, which reduced motion switches off).
// Not while viewing as someone else: that is their inbox, not the viewer's.
export const POLL_MS = 60_000;

export function NewNotices({ known }: { known: string[] }) {
  const router = useRouter();
  const readOnly = useReadOnly();
  const seen = useRef(new Set(known));
  const [fresh, setFresh] = useState(0);

  useEffect(() => {
    if (readOnly) return;
    const poll = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch('/api/v1/me/notices?unread=true');
        if (!res.ok) return;
        const found = newNoticeIds(seen.current, await res.json());
        if (!found.length) return;
        found.forEach((id) => seen.current.add(id));
        setFresh((n) => n + found.length);
        play('ping');
        router.refresh();
      } catch { /* offline or signed out: try again next time */ }
    };
    const timer = setInterval(poll, POLL_MS);
    const back = () => { if (!document.hidden) poll(); };
    document.addEventListener('visibilitychange', back);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', back); };
  }, [readOnly, router]);

  if (!fresh) return null;
  // inline-block, because a transform does not move an inline box
  return <span key={fresh} className="arrive" role="status" style={{ display: 'inline-block' }}>&nbsp;· {fresh} new notice{fresh === 1 ? '' : 's'}</span>;
}
