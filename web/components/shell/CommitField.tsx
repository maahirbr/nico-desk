"use client";
import { useEffect, useRef } from "react";
import styles from "./CommitField.module.css";

const IN_FIELD = "input, textarea, select, [contenteditable]";

// The frame only: "/" focuses it from anywhere, Escape blurs it (KeyboardRule). Saving comes in the commit package.
export function CommitField() {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof Element && e.target.closest(IN_FIELD)) return;
      e.preventDefault();
      input.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  return (
    <form className={styles.bar} onSubmit={(e) => e.preventDefault()}>
      <input
        ref={input}
        type="text"
        name="commit"
        className={styles.field}
        aria-label="Commit or ask"
        placeholder="Commit or ask: @Wren tier names by Wed"
        autoComplete="off"
        enterKeyHint="done"
      />
    </form>
  );
}
