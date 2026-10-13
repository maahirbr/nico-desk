'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { parseStored, viewKey } from '@/lib/remember';
import { readUrlState, writeUrlState } from '@/lib/urlstate';
import { useReadOnly } from './readonly';
import { useViewer } from './viewer';

// A page's last filter, sort and tab, kept per person in this browser (localStorage, always in
// try/catch: with storage blocked the page works and simply forgets). The page first renders the
// defaults, so the server HTML and the first client render match; the kept view is read right after.
// `clean` checks what was kept against what the page offers now and returns only the values that still
// fit. An admin viewing as someone else changes nothing that is kept.
//
// `urlKeys` are the values that also live in the address (`?who=p_ana`), so the view can be shared and opened
// in a new tab. A value in the address wins over the kept one and is checked by `clean` the same way. A value
// equal to its default is left out of the address. The address is written with history.replaceState (no
// server round trip, no new Back entry), the way the task drawer does in taskUrl.ts.
export function useRemembered<T extends Record<string, unknown>>(
  page: string, initial: T, clean: (raw: Record<string, unknown>) => Partial<T>, urlKeys: readonly (keyof T & string)[] = [],
) {
  const { meId } = useViewer();
  const readOnly = useReadOnly();
  const params = useSearchParams();
  const key = viewKey(meId, page);
  const [value, setValue] = useState<T>(() => {
    const url = readUrlState(params, urlKeys);
    return url ? { ...initial, ...clean(url) } : initial;
  });
  const latest = useRef(value);
  const cleanRef = useRef(clean);
  cleanRef.current = clean;
  const initialRef = useRef(initial);
  const keysRef = useRef(urlKeys);
  keysRef.current = urlKeys;
  const started = useRef(false);
  const sig = urlKeys.map((k) => params.get(k) ?? '').join('\u0000');

  const mirror = useCallback((next: T) => {
    const search = writeUrlState(window.location.search, next, initialRef.current, keysRef.current);
    if (search !== window.location.search) window.history.replaceState(window.history.state, '', `${window.location.pathname}${search}`);
  }, []);

  useEffect(() => {
    const first = !started.current;
    started.current = true;
    const url = readUrlState(new URLSearchParams(window.location.search), keysRef.current);
    let next: T | null = null;
    if (url || !first) {
      // The address is the truth: its keys follow it (a link, Back or Forward), a missing key is the default.
      const cleaned: Partial<T> = url ? cleanRef.current(url) : {};
      next = { ...latest.current };
      for (const k of keysRef.current) next[k] = (k in cleaned ? cleaned[k] : initialRef.current[k]) as T[typeof k];
    } else {
      try {
        const raw = parseStored(localStorage.getItem(key));
        if (raw) next = { ...initialRef.current, ...cleanRef.current(raw) };
      } catch { /* storage blocked: the defaults stay */ }
      if (next) mirror(next);
    }
    if (next && JSON.stringify(next) !== JSON.stringify(latest.current)) { latest.current = next; setValue(next); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, sig]);

  const put = useCallback(<K extends keyof T>(k: K, v: T[K]) => {
    const next = { ...latest.current, [k]: v };
    latest.current = next;
    setValue(next);
    mirror(next);
    if (readOnly) return;
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* storage blocked: kept until reload */ }
  }, [key, readOnly, mirror]);

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

// A search box whose text is also in the address (`?q=ana`). It is not kept between visits: only a link, a reload or
// Back brings it back. The address is written with replaceState on each key, so Back does not step through letters.
export function useUrlText(name: string) {
  const params = useSearchParams();
  const fromUrl = params.get(name) ?? '';
  const [text, setText] = useState(fromUrl);
  const written = useRef(fromUrl);
  useEffect(() => {
    // Adopt the address only when it moved on its own (Back, a link), not when it is catching up with typing.
    if (fromUrl !== written.current) { written.current = fromUrl; setText(fromUrl); }
  }, [fromUrl]);
  const set = useCallback((v: string) => {
    written.current = v;
    setText(v);
    const q = new URLSearchParams(window.location.search);
    if (v) q.set(name, v); else q.delete(name);
    const s = q.toString();
    const search = s ? `?${s}` : '';
    if (search !== window.location.search) window.history.replaceState(window.history.state, '', `${window.location.pathname}${search}`);
  }, [name]);
  return [text, set] as const;
}
