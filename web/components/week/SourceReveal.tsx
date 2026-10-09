"use client";
// Where a line came from. The attribution is always there. The sentence behind it shows on tap, or on hover and focus.
import { useId, useState } from "react";

export function SourceReveal({ noteTitle, day, quote }: { noteTitle: string; day: string; quote: string | null }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const from = `From the ${noteTitle} note, ${day}.`;
  if (!quote) return <p className="src">{from}</p>;
  return (
    <div className={`src${open ? " open" : ""}`}>
      <button type="button" className="src-t" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        {from}
      </button>
      <q id={id} className="srcq">
        {quote}
      </q>
    </div>
  );
}
