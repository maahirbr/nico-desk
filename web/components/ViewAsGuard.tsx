'use client';

import { useEffect } from 'react';
import { notify } from './toast';

// View as, the true picture (the PM's call, 15 Nov, option B): while an admin views as someone, every screen shows the
// controls that person sees, exactly as they would. This guard stops the changes instead of hiding the buttons: any call
// that would change something (not a GET) is answered here, with "look only", and never reaches the server. The server
// refuses them in View as too (lib/http.ts route()), so this only makes the answer quick and plain. Opening a mail draft
// (Gmail or the mail app) is stopped the same way. Leaving View as and signing out still go through.
const PASS = ['/api/v1/session'];

export function ViewAsGuard({ name }: { name: string }) {
  useEffect(() => {
    const say = `You’re viewing as ${name.split(' ')[0]}. This is look only.`;
    let last = 0;
    const tell = () => { const now = Date.now(); if (now - last > 1500) { last = now; notify(say); } };
    const real = window.fetch;
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
      const path = new URL(url, window.location.origin).pathname;
      if (method !== 'GET' && method !== 'HEAD' && path.startsWith('/api/') && !PASS.some((p) => path.startsWith(p))) {
        tell();
        return Promise.resolve(new Response(JSON.stringify({ error: { code: 'viewing_as', message: say } }), { status: 403, headers: { 'content-type': 'application/json' } }));
      }
      return real(input, init);
    };
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (a && /^(mailto:|https:\/\/mail\.google\.com)/i.test(a.href)) { e.preventDefault(); e.stopPropagation(); tell(); }
    };
    document.addEventListener('click', onClick, true);
    return () => { window.fetch = real; document.removeEventListener('click', onClick, true); };
  }, [name]);
  return null;
}
