"use client";
// The mobile keyboard rule: the keyboard closes on a tap outside a field, on return or done, and on scroll.
import { useEffect } from "react";

const TEXT = "input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]), textarea";
const field = (): HTMLElement | null => {
  const a = document.activeElement;
  return a instanceof HTMLElement && a.matches(TEXT) ? a : null;
};

export function KeyboardRule() {
  useEffect(() => {
    let focusedAt = 0;
    const onFocusIn = () => {
      focusedAt = Date.now();
    };
    const onKey = (e: KeyboardEvent) => {
      const f = field();
      if (!f) return;
      if (e.key === "Escape") f.blur();
      // A field marked data-kb never submits on return: return only closes the keyboard. A textarea keeps return for a new line.
      if (e.key === "Enter" && e.target instanceof HTMLElement && e.target.matches(TEXT) && !(e.target instanceof HTMLTextAreaElement)) {
        if (e.target.closest("[data-kb]")) e.preventDefault();
        f.blur();
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (field() && !(e.target instanceof Element && e.target.closest("input, textarea, label"))) field()?.blur();
    };
    // The browser scrolls a field into view as the keyboard opens. That scroll must not close it again.
    const onScroll = () => {
      if (Date.now() - focusedAt > 600) field()?.blur();
    };
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);
  return null;
}
