import Link from 'next/link';
import type { Task } from '@/lib/derive';
import type { Load } from '@/lib/service';
import { addDays, fmtDate } from '@/lib/time';
import css from './TeamV2.module.css';

// v2 on /team. Server components: links and details only, so nothing here can edit a task.

// The last weeks as a strip, oldest first, then Now. With an as-of week set, a banner says the page
// is a read-only view and gives the way back.
export function AsOfBar({ weeks, asOf, view }: { weeks: string[]; asOf: string | null; view: 'person' | 'status' }) {
  const oldestFirst = [...weeks].reverse();
  return (
    <>
      <nav className={css.strip} aria-label="Desk as of a past week">
        <span className={css.lead}>Desk as it stood at the end of</span>
        {oldestFirst.map((w) => {
          const end = addDays(w, 6);
          return (
            <Link key={w} className={`${css.chip}${asOf === w ? ` ${css.on}` : ''}`} href={`/team?asof=${w}&view=${view}`}
              aria-current={asOf === w ? 'page' : undefined} aria-label={`Week of ${fmtDate(w)}, ending ${fmtDate(end)}`}>
              {fmtDate(end)}
            </Link>
          );
        })}
        <Link className={`${css.chip}${asOf === null ? ` ${css.on}` : ''}`} href={`/team?view=${view}`} aria-current={asOf === null ? 'page' : undefined}>Now</Link>
      </nav>
      {asOf && (
        <div className={css.banner} role="status">
          <span>The desk as it stood on {fmtDate(addDays(asOf, 6))}. Read only: nothing here can be changed.</span>
          <Link href={`/team?view=${view}`}>Back to now</Link>
        </div>
      )}
    </>
  );
}

// Open work per person: this week (late work included) and the next week.
export function LoadPanel({ load, names, weekStart, today }: { load: Load[]; names: Record<string, string>; weekStart: string; today: string }) {
  const most = Math.max(1, ...load.flatMap((l) => [l.thisWeek.length, l.nextWeek.length]));
  const sorted = [...load].sort((a, b) => b.thisWeek.length + b.nextWeek.length - (a.thisWeek.length + a.nextWeek.length) || (names[a.personId] ?? '').localeCompare(names[b.personId] ?? ''));
  const list = (ts: Task[]) =>
    ts.length === 0 ? <p className={css.none}>Nothing.</p> : (
      <ul>
        {ts.map((t) => (
          <li key={t.id}><span>{t.title}</span><span className={`${css.when}${t.dueOn < today ? ` ${css.late}` : ''}`}>{fmtDate(t.dueOn)}</span></li>
        ))}
      </ul>
    );
  return (
    <section className={css.load} aria-label="Load">
      <h2>Load</h2>
      <p className={css.note}>Open tasks per person. This week is {fmtDate(weekStart)} to {fmtDate(addDays(weekStart, 6))} and includes late work. Next week is {fmtDate(addDays(weekStart, 7))} to {fmtDate(addDays(weekStart, 13))}.</p>
      <ul className={css.people}>
        {sorted.map((l) => (
          <li key={l.personId} className={`${css.person}${l.thisWeek.length + l.nextWeek.length === 0 ? ` ${css.zero}` : ''}`}>
            <details>
              <summary>
                <span className={css.name}>{names[l.personId] ?? 'Someone'}</span>
                <span className={css.cell}>
                  <span className={css.count}>{l.thisWeek.length} <em>this week</em>{l.late > 0 && <span className={css.late}> · {l.late} late</span>}</span>
                  <span className={css.track}><span className={css.fill} style={{ width: `${(l.thisWeek.length / most) * 100}%` }} /></span>
                </span>
                <span className={css.cell}>
                  <span className={css.count}>{l.nextWeek.length} <em>next week</em></span>
                  <span className={css.track}><span className={css.fill} style={{ width: `${(l.nextWeek.length / most) * 100}%` }} /></span>
                </span>
              </summary>
              <div className={css.open}>
                <div><h3>This week</h3>{list(l.thisWeek)}</div>
                <div><h3>Next week</h3>{list(l.nextWeek)}</div>
              </div>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}
