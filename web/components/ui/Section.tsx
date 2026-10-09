// A compartment of the sheet: a 1.5px ink rule above, a tracked-caps header, then the content.
import type { ReactNode } from "react";

type Props = { title: string; right?: ReactNode; children: ReactNode; id?: string };

export function Section({ title, right, children, id }: Props) {
  return (
    <section id={id} className="alt-block px-[14px] py-5">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 className="alt-label">{title}</h2>
        {right ? <div className="alt-meta">{right}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="alt-meta py-2">{children}</p>;
}
