"use client";
// Owed: who owes whom. People down the side owe, people across the top are owed. A cell counts open commitments.
// Press a cell to read its lines below the matrix, on the same line as the desk shows them.
import { useId, useMemo, useState } from "react";
import { inkOf } from "@/components/week/lines";
import type { OwedEdge } from "@/lib/db/queries-ui";
import type { DeskLine } from "./asof";
import type { DeskPerson } from "./Desk";
import { Line } from "./Line";

type Props = { people: DeskPerson[]; edges: OwedEdge[]; lines: Map<string, DeskLine> };

export function OwedMatrix({ people, edges, lines }: Props) {
  const id = useId();
  const [pick, setPick] = useState<{ from: string; to: string } | null>(null);
  const name = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  // Lines of each cell, by date. An edge whose task is not open on the desk any more is left out.
  const cells = useMemo(() => {
    const m = new Map<string, DeskLine[]>();
    for (const e of edges) {
      const l = lines.get(e.taskId);
      if (!l || !name.has(e.ownerId) || !name.has(e.toId)) continue;
      const k = `${e.ownerId}>${e.toId}`;
      m.set(k, [...(m.get(k) ?? []), l]);
    }
    for (const list of m.values()) list.sort((a, b) => a.due.localeCompare(b.due) || a.t.id.localeCompare(b.t.id));
    return m;
  }, [edges, lines, name]);
  const open = pick ? (cells.get(`${pick.from}>${pick.to}`) ?? []) : [];
  const from = pick ? name.get(pick.from) : undefined;
  const to = pick ? name.get(pick.to) : undefined;

  return (
    <section className="owm" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="caps">
        Owed
      </h2>
      <p className="owm-sub">Open commitments one person owes another. Down the side, who owes. Across the top, who is owed.</p>
      <div className="owm-scroll" role="region" aria-label="Owed matrix, scrolls sideways" tabIndex={0}>
        <table className="owm-t">
          <thead>
            <tr>
              <th scope="col" className="caps">
                Owes
              </th>
              {people.map((p) => (
                <th key={p.id} scope="col">
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {people.map((r) => (
              <tr key={r.id}>
                <th scope="row">{r.name}</th>
                {people.map((c) => {
                  const n = r.id === c.id ? 0 : (cells.get(`${r.id}>${c.id}`)?.length ?? 0);
                  if (n === 0) return <td key={c.id} />;
                  const on = pick?.from === r.id && pick.to === c.id;
                  return (
                    <td key={c.id}>
                      <button
                        type="button"
                        className={`owm-n${on ? " on" : ""}`}
                        aria-pressed={on}
                        aria-label={`${r.name} owes ${c.name}: ${n} open`}
                        onClick={() => setPick(on ? null : { from: r.id, to: c.id })}
                      >
                        {n}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div aria-live="polite">
        {pick && from && to ? (
          <>
            <p className="owm-h caps">
              {from.name} owes {to.name}
            </p>
            <ul className="owm-lines">
              {open.map((l) => (
                <Line key={l.t.id} l={l} ink={inkOf(from.department)} />
              ))}
            </ul>
          </>
        ) : (
          <p className="owm-hint">Press a number to read its lines.</p>
        )}
      </div>
      <p className="owm-note">A line counts when it waits on that person, or when a lead created it for someone else. The log keeps who created a line, not who assigned it.</p>
    </section>
  );
}
