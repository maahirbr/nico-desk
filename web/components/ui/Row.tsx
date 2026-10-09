// Ruled list parts. Row is a 1px ink-14 item rule; Table is the .alt-table register.
import type { ReactNode } from "react";

export function Table({ head, children }: { head: ReactNode[]; children: ReactNode }) {
  return (
    <table className="alt-table">
      <thead>
        <tr>
          {head.map((h, i) => (
            <th key={i} scope="col">
              <span className="alt-label">{h}</span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

export function Row({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`alt-row dither-row flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3 ${className}`.trim()} style={{ borderBottom: "var(--rule-item)" }}>
      {children}
    </div>
  );
}

// A label and value pair for the task fields.
export function Pair({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-4 py-2" style={{ borderBottom: "var(--rule-item)" }}>
      <dt className="alt-label">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
