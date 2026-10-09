import styles from "./InitialsMark.module.css";

// Two letters: the first letters of two names, or the first two letters of one.
export function initialsOf(name: string): string {
  const w = name.trim().split(/\s+/);
  return (w.length > 1 ? w[0][0] + w[1][0] : name.trim().slice(0, 2)).toUpperCase();
}

export function InitialsMark({ name, you = false }: { name: string; you?: boolean }) {
  return (
    <span className={`${styles.mark} ${you ? styles.you : ""}`} aria-hidden>
      {initialsOf(name)}
    </span>
  );
}
