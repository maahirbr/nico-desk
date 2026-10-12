'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

// The open task drawer lives in the address as ?task=<id>, so a task can be shared and the back button closes it.
// Opening pushes one history entry; closing goes back if this tab pushed it, otherwise replaces the address.
// Other query parts (a project filter, say) are kept. Nothing here talks to the server.

export const TASK_PARAM = 'task';

export function withTask(search: string, id: string | null): string {
  const q = new URLSearchParams(search);
  if (id) q.set(TASK_PARAM, id); else q.delete(TASK_PARAM);
  const s = q.toString();
  return s ? `?${s}` : '';
}

export function useOpenTask(): readonly [string | null, (id: string | null) => void] {
  const params = useSearchParams();
  const pathname = usePathname();
  const id = params.get(TASK_PARAM);
  const set = useCallback((next: string | null) => {
    const search = withTask(window.location.search, next);
    if (next) {
      if (window.location.search === search) return;
      window.history.pushState({ ndTask: true }, '', `${pathname}${search}`);
    } else if (window.history.state?.ndTask) {
      window.history.back();
    } else {
      window.history.replaceState(window.history.state, '', `${pathname}${search}`);
    }
  }, [pathname]);
  return [id, set] as const;
}
