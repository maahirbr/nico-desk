'use client';

import { useEffect, useState } from 'react';

// A small confirmation after an action. notify() can be called from any client code. The Toaster in
// the shell shows it for --dwell-confirm, then fades it out. The region is polite, so a screen reader
// announces the message without cutting in.

const EVENT = 'nd:toast';
type Undo = () => Promise<void> | void;
type Toast = { id: number; text: string; leaving: boolean; undo?: Undo };

// A toast with an undo stays 6 seconds, long enough to read it and reach the button.
export const UNDO_DWELL_MS = 6000;

// undo, when given, adds an Undo button. It is a new change made through the API, never a delete.
export function notify(text: string, undo?: Undo) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EVENT, { detail: { text, undo } }));
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
      const d = (e as CustomEvent).detail as { text?: string; undo?: Undo } | string | undefined;
      const text = String(typeof d === 'string' ? d : d?.text ?? '');
      const undo = typeof d === 'object' ? d?.undo : undefined;
      if (!text) return;
      const id = next++;
      const dwell = undo ? UNDO_DWELL_MS : token('--dwell-confirm', 4000);
      const fade = token('--dur-toast', 0);
      setItems((cur) => [...cur.slice(-2), { id, text, leaving: false, undo }]);
      setTimeout(() => setItems((cur) => cur.map((t) => (t.id === id ? { ...t, leaving: true } : t))), dwell);
      setTimeout(() => setItems((cur) => cur.filter((t) => t.id !== id)), dwell + fade + 20);
    };
    window.addEventListener(EVENT, onToast);
    return () => window.removeEventListener(EVENT, onToast);
  }, []);
  // One press: the toast goes at once, the undo runs, and a plain toast says how it went.
  async function undo(t: Toast) {
    setItems((cur) => cur.filter((x) => x.id !== t.id));
    try { await t.undo?.(); notify('Undone'); }
    catch (e) { notify(`Could not undo. ${(e as Error).message}`); }
  }
  return (
    <div className="toasts" role="status" aria-live="polite" aria-atomic="false">
      {items.map((t) => (
        <div key={t.id} className={`toast${t.leaving ? ' is-leaving' : ''}${t.undo ? ' has-undo' : ''}`}>
          <span>{t.text}</span>
          {t.undo && <button type="button" className="toast-undo" onClick={() => undo(t)}>Undo</button>}
        </div>
      ))}
    </div>
  );
}
