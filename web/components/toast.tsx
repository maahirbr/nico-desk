'use client';

import { useEffect, useState } from 'react';

// A small confirmation after an action. notify() can be called from any client code. The Toaster in
// the shell shows it for --dwell-confirm, then fades it out. The region is polite, so a screen reader
// announces the message without cutting in.

const EVENT = 'nd:toast';
type Toast = { id: number; text: string; leaving: boolean };

export function notify(text: string) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EVENT, { detail: text }));
}

function token(name: string, fallback: number): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const n = parseFloat(raw);
  if (Number.isNaN(n)) return fallback;
  return raw.endsWith('ms') ? n : n * 1000;
}

let next = 1;

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    const onToast = (e: Event) => {
      const text = String((e as CustomEvent).detail ?? '');
      if (!text) return;
      const id = next++;
      const dwell = token('--dwell-confirm', 4000);
      const fade = token('--dur-toast', 0);
      setItems((cur) => [...cur.slice(-2), { id, text, leaving: false }]);
      setTimeout(() => setItems((cur) => cur.map((t) => (t.id === id ? { ...t, leaving: true } : t))), dwell);
      setTimeout(() => setItems((cur) => cur.filter((t) => t.id !== id)), dwell + fade + 20);
    };
    window.addEventListener(EVENT, onToast);
    return () => window.removeEventListener(EVENT, onToast);
  }, []);
  return (
    <div className="toasts" role="status" aria-live="polite" aria-atomic="false">
      {items.map((t) => (
        <div key={t.id} className={`toast${t.leaving ? ' is-leaving' : ''}`}>{t.text}</div>
      ))}
    </div>
  );
}
