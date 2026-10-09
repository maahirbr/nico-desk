"use client";
// The mark: an 8px square plus its word. The square is set (a short pop) when the word changes.
import { useState } from "react";
import type { MarkSpec } from "./lines";

export function WeekMark({ tone, word, open }: MarkSpec) {
  const [seen, setSeen] = useState(word);
  const [pop, setPop] = useState(false);
  if (seen !== word) {
    setSeen(word);
    setPop(true);
  }
  return (
    <span className={`mark m-${tone}${open ? " open" : ""}${pop ? " set" : ""}`}>
      <i aria-hidden onAnimationEnd={() => setPop(false)} />
      {word}
    </span>
  );
}
