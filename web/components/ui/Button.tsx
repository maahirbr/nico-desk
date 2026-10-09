"use client";
// An action: tracked caps, a rule under it, no fill. Disabled while its form is sending.
import { useFormStatus } from "react-dom";

export function Button({ children, primary = false }: { children: string; primary?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`alt-btn no-ring ${primary ? "alt-btn-primary" : ""}`.trim()}>
      {children}
    </button>
  );
}
