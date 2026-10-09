// The ledger book (/team/ledger): one long sheet, a section for each week. Server component, no state.
// A date move with a reason is listed under its week. A thin thread in the margin ties it back to its row.
import type { CSSProperties } from "react";
import { fmtLong, fmtShort } from "@/components/week/lines";
import { Mark } from "@/components/week/Mark";
import type { Book, BookWeek } from "./book";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function Week({ w }: { w: BookWeek }) {
  // Each row with a move gets its own thread column in the margin, so two threads never share a line.
  const threaded = w.rows.map((r, i) => ({ r, i })).filter((x) => x.r.threadTo !== null);
  const k = threaded.length;
  const col = k + 1;
  const head = 1;
  const rowAt = (i: number) => head + 1 + i;
  const afterRows = rowAt(w.rows.length); // first free grid row
  const movesHead = afterRows;
  const moveAt = (j: number) => movesHead + 1 + j;
  const totalsAt = w.moves.length ? moveAt(w.moves.length) : afterRows;
  return (
    <section className="lg-week" aria-labelledby={`wk-${w.monday}`}>
      <h2 id={`wk-${w.monday}`} className="lg-h">
        Week of {fmtShort(w.monday)}
      </h2>
      {w.rows.length === 0 ? (
        <p className="empty">Nothing came due this week.</p>
      ) : (
        <div className="lg-grid" role="list" style={{ gridTemplateColumns: `${k ? `repeat(${k}, 10px) ` : ""}minmax(0, 1fr)` }}>
          <div className="lg-row lg-head caps" aria-hidden style={{ gridColumn: col, gridRow: head }}>
            <span>Mark</span>
            <span>Owner</span>
            <span>Commitment</span>
            <span>First date</span>
            <span>Landed</span>
          </div>
          {w.rows.map((r, i) => (
            <div key={r.id} role="listitem" className={`lg-row${r.counted ? "" : " lg-off"}`} style={{ gridColumn: col, gridRow: rowAt(i), "--p": r.ink } as CSSProperties}>
              <span className="lg-mk">
                <Mark {...r.mark} />
              </span>
              <span className="lg-ow who">
                <i aria-hidden />
                {r.owner}
              </span>
              <span className="lg-t">{r.title}</span>
              <span className="lg-d">
                <span className="lg-k caps">First</span>
                <time dateTime={r.first}>{fmtShort(r.first)}</time>
              </span>
              <span className="lg-d">
                <span className="lg-k caps">Landed</span>
                {r.landed ? <time dateTime={r.landed}>{fmtShort(r.landed)}</time> : <span>open</span>}
              </span>
            </div>
          ))}
          {threaded.map(({ r, i }, n) => (
            <div key={`th-${r.id}`} className="lg-thread" aria-hidden style={{ gridColumn: n + 1, gridRow: `${rowAt(i)} / ${moveAt(r.threadTo as number) + 1}`, "--p": r.ink, "--hook": `${(k - n - 1) * 10 + 5}px` } as CSSProperties} />
          ))}
          {w.moves.length > 0 ? (
            <>
              <p className="lg-mh caps" style={{ gridColumn: col, gridRow: movesHead }}>
                Dates moved, with the reason
              </p>
              {w.moves.map((m, j) => (
                <p key={`${m.id}-${j}`} className="lg-mv" style={{ gridColumn: col, gridRow: moveAt(j), "--p": m.ink } as CSSProperties}>
                  {m.text}
                </p>
              ))}
            </>
          ) : null}
          <Totals t={w.totals} label="Week" style={{ gridColumn: col, gridRow: totalsAt }} />
        </div>
      )}
      {w.rows.length === 0 ? <Totals t={w.totals} label="Week" /> : null}
    </section>
  );
}

export function Totals({ t, label, style }: { t: BookWeek["totals"]; label: string; style?: CSSProperties }) {
  const cells = [
    ["Counted", t.counted],
    ["Ahead", t.ahead],
    ["On time", t.onTime],
    ["Late", t.late],
    ["Open overdue", t.openOverdue],
  ] as const;
  return (
    <p className="lg-tot" style={style}>
      <span className="caps">{label} totals</span>
      {cells.map(([name, n]) => (
        <span key={name} className="lg-c">
          <span className="caps">{name}</span> <b>{n}</b>
        </span>
      ))}
    </p>
  );
}

export function Ledger({ book, teamName, today }: { book: Book; teamName: string; today: string }) {
  const { total } = book;
  const landed = total.ahead + total.onTime;
  const from = book.weeks[0]?.monday ?? today;
  return (
    <div className="lg">
      <div className="lg-top">
        <h1 className="claim">
          {total.counted === 0
            ? "Nothing has come due in four weeks."
            : `Of ${total.counted} commitments due in four weeks, ${landed} landed on or before the date first given.`}
        </h1>
        <p className="ctx">
          {teamName}. {fmtShort(from)} to {fmtLong(today)}. Every line is judged against the date first given.
        </p>
      </div>
      <div className="stack">
        <div className="sheet lg-sheet">
          <section className="lg-sum" aria-label="Four weeks">
            <p className="lg-sentence">
              {plural(total.counted, "commitment was", "commitments were")} counted: {total.ahead} ahead, {total.onTime} on time and {total.late} late.{" "}
              {total.openOverdue} {total.openOverdue === 1 ? "is" : "are"} still open past the date.
            </p>
            <div className="lg-tabwrap">
            <table className="lg-tab">
              <thead>
                <tr className="caps">
                  <th scope="col">Week</th>
                  <th scope="col">Counted</th>
                  <th scope="col">Ahead</th>
                  <th scope="col">On time</th>
                  <th scope="col">Late</th>
                  <th scope="col">Open overdue</th>
                </tr>
              </thead>
              <tbody>
                {book.weeks.map((w) => (
                  <tr key={w.monday}>
                    <th scope="row">{fmtShort(w.monday)}</th>
                    <td>{w.totals.counted}</td>
                    <td>{w.totals.ahead}</td>
                    <td>{w.totals.onTime}</td>
                    <td>{w.totals.late}</td>
                    <td>{w.totals.openOverdue}</td>
                  </tr>
                ))}
                <tr className="lg-sumrow">
                  <th scope="row">Four weeks</th>
                  <td>{total.counted}</td>
                  <td>{total.ahead}</td>
                  <td>{total.onTime}</td>
                  <td>{total.late}</td>
                  <td>{total.openOverdue}</td>
                </tr>
              </tbody>
            </table>
            </div>
            <p className="lg-note">Moving a date does not make a line on time. Dropped lines and lines not yet due are left out.</p>
          </section>
          {book.weeks.map((w) => (
            <Week key={w.monday} w={w} />
          ))}
        </div>
      </div>
    </div>
  );
}
