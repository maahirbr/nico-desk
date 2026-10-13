'use client';

import { useEffect } from 'react';

// Registers /sw.js so the phone can install the app. Production only: in dev a worker would serve stale files.
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => { /* the app works without it */ });
  }, []);
  return null;
}
