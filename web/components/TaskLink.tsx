'use client';

import Link from 'next/link';
import type { MouseEvent, ReactNode } from 'react';
import { isPlainClick, taskHref } from '@/lib/urlstate';

// A task that opens in place (the side drawer) on a plain click, and is still a real link: middle click,
// Cmd or Ctrl click, and "Open in new tab" go to /tasks/<id>. Keyboard Enter is a plain click, so it opens in place too.
export function TaskLink({ id, onOpen, className, children, onClick }: {
  id: string; onOpen: () => void; className?: string; children: ReactNode; onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <Link href={taskHref(id)} prefetch={false} className={className}
      onClick={(e) => { if (!isPlainClick(e)) return; e.preventDefault(); onClick?.(e); onOpen(); }}>
      {children}
    </Link>
  );
}
