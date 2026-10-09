'use client';

import { useEffect } from 'react';

// The mobile keyboard rule: the keyboard closes when the person taps outside a text field,
// presses return or done, or scrolls. No field may leave it stuck open. One listener set for the
// whole app, so every current and future field is covered.

const TEXT_TYPES = new Set(['text', 'search', 'email', 'url', 'tel', 'number', 'password', 'date', 'time', 'datetime-local']);

function isTextField(el: Element | null): el is HTMLInputElement | HTMLTextAreaElement {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return true;
  return el instanceof HTMLInputElement && TEXT_TYPES.has(el.type);
}

function blurActive() {
  const a = document.activeElement;
  if (isTextField(a)) a.blur();
}

export function KeyboardDismiss() {
  useEffect(() => {
    // Tap or click anywhere that is not a text field (or the label for one).
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (!isTextField(document.activeElement)) return;
      if (t && (t.closest('input, textarea, [contenteditable="true"]') || t.closest('label'))) return;
      blurActive();
    };
    // Return or Done on a single-line field. A textarea keeps return for a new line.
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as Element | null;
      if (e.key === 'Enter' && t instanceof HTMLInputElement && TEXT_TYPES.has(t.type)) {
        // Let a form submit first, then close the keyboard.
        setTimeout(() => { if (document.activeElement === t) t.blur(); }, 0);
      }
    };
    // Scrolling the page closes it. Capture, so scrolling inside a drawer or modal counts too.
    const onScroll = () => blurActive();
    const onTouchMove = () => blurActive();
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    document.addEventListener('touchmove', onTouchMove, { capture: true, passive: true });
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('touchmove', onTouchMove, true);
    };
  }, []);
  return null;
}
