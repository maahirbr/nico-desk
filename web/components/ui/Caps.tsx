// A tracked-caps label. Copy is stored in natural case; CSS sets the case.
import type { ReactNode } from "react";

export function Caps({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`caps ${className}`.trim()}>{children}</span>;
}
