'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { parseStored, viewKey } from '@/lib/remember';
import { useReadOnly } from './readonly';
import { useViewer } from './viewer';

// A page's last filter, sort and tab, kept per person in this browser (localStorage, always in
// try/catch: with storage blocked the page works and simply forgets). The page first renders the
// defaults, so the server HTML and the first client render match; the kept view is read right after.
// `clean` checks what was kept against what the page offers now and returns only the values that still
// fit. An admin viewing as someone else changes nothing that is kept.
export function useRemembered<T extends Record<string, unknown>>(
  page: string, initial: T, clean: (raw: Record<string, unknown>) => Partial<T>,
) {
  const { meId } = useViewer();
  const readOnly = useReadOnly();
  const key = viewKey(meId, page);
  const [value, setValue] = useState<T>(initial);
  const latest = useRef(value);
  const cleanRef = useRef(clean);
  cleanRef.current = clean;

  useEffect(() => {
    try {
      const raw = parseStored(localStorage.getItem(key));
      if (!raw) return;
      const next = { ...initial, ...cleanRef.current(raw) };
      latest.current = next;
      setValue(next);
    } catch { /* storage blocked: the defaults stay */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const put = useCallback(<K extends keyof T>(k: K, v: T[K]) => {
    const next = { ...latest.current, [k]: v };
    latest.current = next;
    setValue(next);
    if (readOnly) return;
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* storage blocked: kept until reload */ }
  }, [key, readOnly]);

  return [value, put] as const;
}

// A tab the page keeps in the address (`?view=status`). A link with the word in it wins and is kept; a visit
// without it goes back to the kept one with router.replace, so the Back button does not loop.
export function useRememberedParam(page: string, name: string, current: string, allowed: readonly string[]) {
  const { meId } = useViewer();
  const readOnly = useReadOnly();
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const key = viewKey(meId, page);
  const explicit = params.get(name);
  useEffect(() => {
    try {
      const raw = parseStored(localStorage.getItem(key)) ?? {};
      if (explicit) {
        if (!readOnly && raw[name] !== explicit && allowed.includes(explicit)) localStorage.setItem(key, JSON.stringify({ ...raw, [name]: explicit }));
        return;
      }
      const kept = raw[name];
      if (typeof kept === 'string' && kept !== current && allowed.includes(kept)) {
        const next = new URLSearchParams(params.toString());
        next.set(name, kept);
        router.replace(`${path}?${next.toString()}`);
      }
    } catch { /* storage blocked: the page shows its default */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, explicit]);
}
