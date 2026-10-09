// "Waiting on you": open lines owned by other people that are blocked on the viewer.
import type { TaskRow } from "@/lib/views";
import { fmtLong, lcFirst } from "./lines";

export function Owed({ rows }: { rows: TaskRow[] }) {
  if (rows.length === 0) return null;
  return (
    <section className="owed" aria-labelledby="owed-h">
      <h2 id="owed-h" className="caps">
        Waiting on you
      </h2>
      {rows.map((t) => (
        <p key={t.id}>
          <b style={{ fontWeight: 500 }}>{t.ownerName}</b> needs this for {lcFirst(t.title)}, due {fmtLong(t.dueOn)}
          {t.blockedAsk ? `: ${t.blockedAsk}` : "."}
        </p>
      ))}
    </section>
  );
}
