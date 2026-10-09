// The one live sheet on the desk. One paper per screen.
import type { ReactNode } from "react";

export function Sheet({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`alt-sheet arrive ${className}`.trim()}>{children}</div>;
}
