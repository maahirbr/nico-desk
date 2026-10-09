// The right column: the plan week's sheet for each person, small. Lines due in that week, lines carried in from
// earlier weeks, and under Later the open lines due after it. The header of each sheet is where an accepted draft
// slides to (data-tray), and the draft lands on the sheet whichever day it was given.
import type { CSSProperties } from "react";
import { Line } from "@/components/desk/Line";
import type { DeskLine } from "@/components/desk/asof";

export type PersonSheet = { id: string; name: string; ink: string; lines: DeskLine[]; later: DeskLine[] };

const num = (n: number) => String(n);

export function Sheets({ sheets }: { sheets: PersonSheet[] }) {
  return (
    <>
      {sheets.map((s) => {
        // A line moved in from an earlier week counts as carried in. Lines that moved out are not on the plan week's sheet.
        const lines = s.lines.filter((l) => l.kind !== "out");
        const carried = lines.filter((l) => l.kind === "carried" || l.movedIn).length;
        const due = lines.length - carried;
        return (
          <section key={s.id} className="mon-person" data-tray={s.id} style={{ "--p": s.ink } as CSSProperties} aria-label={`${s.name}'s sheet`}>
            <div className="tb-mini-s">
              <span className="who">
                <i aria-hidden />
                {s.name}&apos;s sheet
              </span>
              <span className="tb-n">
                {num(due)} due, {num(carried)} carried in{s.later.length > 0 ? `, ${num(s.later.length)} later` : ""}
              </span>
            </div>
            {lines.length > 0 ? (
              <ul>
                {lines.map((l) => (
                  <Line key={l.t.id} l={l} ink={s.ink} />
                ))}
              </ul>
            ) : (
              <p className="empty">Nothing is due that week.</p>
            )}
            {s.later.length > 0 ? (
              <>
                <h3 className="caps mon-sh">Later</h3>
                <ul>
                  {s.later.map((l) => (
                    <Line key={l.t.id} l={l} ink={s.ink} />
                  ))}
                </ul>
              </>
            ) : null}
          </section>
        );
      })}
    </>
  );
}
