'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Task } from '@/lib/derive';
import type { LedgerRow } from '@/lib/service';
import { fmtDate, fmtStamp, istDate } from '@/lib/time';
import { Avatar, Person } from './chips';

// The on-time ledger. Judged against the date first given (INTENT.md principle 1). Every number
// opens the tasks behind it, with each date move and its reason. The cards show delivery habits per
// person, in name order: a coaching view, not a ranking.

type Key = 'kept' | 'ahead' | 'ontime' | 'late' | 'pastdue' | 'silent' | 'movedOpen' | 'movedLate' | 'moved';
const MATCH: Record<Key, (t: Task) => boolean> = {
  kept: (t) => t.outcome === 'ahead' || t.outcome === 'on_time',
  ahead: (t) => t.outcome === 'ahead',
  ontime: (t) => t.outcome === 'on_time',
  late: (t) => t.outcome === 'late',
  pastdue: (t) => t.overdue,
  silent: (t) => t.slippedSilently,
  movedOpen: (t) => t.renegotiations.some((r) => r.kind === 'open'),
  movedLate: (t) => t.renegotiations.some((r) => r.kind === 'late'),
  moved: (t) => t.renegotiations.length > 0,
};
const COLS: [keyof LedgerRow, string, Key][] = [
  ['closedAhead', 'Ahead', 'ahead'],
  ['closedOnTime', 'On time', 'ontime'],
  ['closedLate', 'Late', 'late'],
  ['openPastDue', 'Open, past due', 'pastdue'],
  ['silentSlips', 'Slipped silently', 'silent'],
  ['renegotiatedOpen', 'Moved in time', 'movedOpen'],
  ['renegotiatedLate', 'Moved late', 'movedLate'],
];

const closedOn = (t: Task) => (t.closedAt ? istDate(t.closedAt) : null);
const days = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
const mondayOf = (d: string) => { const x = new Date(`${d}T00:00:00Z`); const w = x.getUTCDay(); x.setUTCDate(x.getUTCDate() + (w === 0 ? -6 : 1 - w)); return x.toISOString().slice(0, 10); };
const pct = (n: number, d: number) => (d ? Math.round((100 * n) / d) : null);

function keptOf(ts: Task[]) {
  const closed = ts.filter((t) => t.outcome);
  return { pct: pct(closed.filter(MATCH.kept).length, closed.length), closed: closed.length };
}

type Drill = { title: string; tasks: Task[] } | null;

export function LedgerView({ weeks, from, to, today, rows, tasks, prev, openNow, waitingOn, people, names, projectNames, seeAll }: {
  weeks: number; from: string; to: string; today: string; rows: LedgerRow[]; tasks: Task[]; prev: Task[]; openNow: Task[]; waitingOn: Task[];
  people: { id: string; name: string; role: string }[]; names: Record<string, string>; projectNames: Record<string, string>; seeAll: boolean;
}) {
  const [drill, setDrill] = useState<Drill>(null);
  const weekList = Array.from({ length: weeks }, (_, i) => {
    const d = new Date(`${from}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 7 * i); return d.toISOString().slice(0, 10);
  }).reverse();
  const sum = (rs: LedgerRow[], k: keyof LedgerRow) => rs.reduce((n, r) => n + (r[k] as number), 0);
  const show = (title: string, list: Task[]) => list.length && setDrill({ title, tasks: [...list].sort((a, b) => a.firstDueOn.localeCompare(b.firstDueOn)) });
  const N = ({ n, title, list, warn }: { n: number | string; title: string; list: Task[]; warn?: boolean }) =>
    list.length ? <button className={`num-btn${warn ? ' warn' : ''}`} onClick={() => show(title, list)} title="See the tasks">{n}</button> : <span className="num-zero">{n}</span>;
  const kAll = keptOf(tasks);
  const period = `last ${weeks} weeks`;

  return (
    <>
      <h1>On-time ledger</h1>
      <p className="lede">Kept dates, per person per week. On time means closed by the date first given. Click any number to see the tasks behind it.</p>

      <div className="stats">
        <button className="card stat" onClick={() => show(`Kept on the first date, ${period}`, tasks.filter(MATCH.kept))}>
          <div className="stat-n">{kAll.pct === null ? 'n/a' : `${kAll.pct}%`}</div><div className="stat-l">Kept on the first date, {period}</div>
        </button>
        <button className="card stat" onClick={() => show(`Closed on time or ahead, ${period}`, tasks.filter(MATCH.kept))}>
          <div className="stat-n">{tasks.filter(MATCH.kept).length}</div><div className="stat-l">Closed on time or ahead</div>
        </button>
        <button className="card stat" onClick={() => show(`Closed late, ${period}`, tasks.filter(MATCH.late))}>
          <div className="stat-n">{tasks.filter(MATCH.late).length}</div><div className="stat-l">Closed late</div>
        </button>
        <button className={`card stat${tasks.some(MATCH.pastdue) ? ' warn' : ''}`} onClick={() => show(`Open, past due, ${period}`, tasks.filter(MATCH.pastdue))}>
          <div className="stat-n">{tasks.filter(MATCH.pastdue).length}</div><div className="stat-l">Open, past due</div>
        </button>
        <button className={`card stat${tasks.some(MATCH.silent) ? ' warn' : ''}`} onClick={() => show(`Slipped silently, ${period}`, tasks.filter(MATCH.silent))}>
          <div className="stat-n">{tasks.filter(MATCH.silent).length}</div><div className="stat-l">Slipped silently <span className="dim">· target 0</span></div>
        </button>
      </div>

      <h2>Delivery habits <span className="count-badge">{period}</span></h2>
      <p className="sub" style={{ marginTop: -6 }}>{seeAll ? 'One card per person, in name order. Arrows compare with the same length of time before.' : 'Your own habits. Leads see the whole team.'}</p>
      <div className="habit-grid">
        {people.map((p) => {
          const mine = tasks.filter((t) => t.ownerId === p.id);
          const before = keptOf(prev.filter((t) => t.ownerId === p.id));
          const k = keptOf(mine);
          const a = mine.filter(MATCH.ahead), o = mine.filter(MATCH.ontime), l = mine.filter(MATCH.late);
          const closed = a.length + o.length + l.length;
          const lateBy = l.map((t) => days(t.firstDueOn, closedOn(t)!)).sort((x, y) => x - y);
          const median = lateBy.length ? lateBy[Math.floor(lateBy.length / 2)] : null;
          const moves = mine.flatMap((t) => t.renegotiations);
          const early = moves.filter((r) => r.kind === 'open').length;
          const silent = mine.filter(MATCH.silent);
          const open = openNow.filter((t) => t.ownerId === p.id);
          const overdue = open.filter((t) => t.overdue);
          const blockedOnOthers = open.filter((t) => t.blocked);
          const othersWaiting = waitingOn.filter((t) => t.blocked?.onId === p.id);
          const trend = k.pct !== null && before.pct !== null ? k.pct - before.pct : null;
          if (!mine.length && !open.length) return (
            <section key={p.id} className="card habit quiet">
              <div className="habit-head"><Avatar name={p.name} lg /><span><b>{p.name}</b><span className="dim small">{p.role}</span></span></div>
              <p className="small dim">Nothing fell due in this period, and nothing open.</p>
            </section>
          );
          return (
            <section key={p.id} className="card habit">
              <div className="habit-head">
                <Avatar name={p.name} lg /><span><b>{p.name}</b><span className="dim small">{p.role}</span></span>
              </div>

              <div className="habit-kept">
                <button className="big" onClick={() => show(`${p.name}: kept on the first date`, mine.filter(MATCH.kept))} disabled={!k.closed}>
                  {k.pct === null ? '–' : `${k.pct}%`}
                </button>
                <span className="small">kept on the first date{closed ? ` (${closed} closed)` : ''}
                  {trend !== null && <span className={trend > 0 ? 'up' : trend < 0 ? 'down' : 'dim'}> · {trend > 0 ? '↑' : trend < 0 ? '↓' : '→'} {trend === 0 ? 'same as' : `${Math.abs(trend)} pts vs`} before</span>}
                </span>
              </div>
              {closed > 0 && (
                <div className="split" role="group" aria-label="Ahead, on time, late">
                  {[['Ahead', a, 'var(--green)'], ['On time', o, 'var(--purple)'], ['Late', l, 'var(--red)']].map(([label, list, c]) => (list as Task[]).length ? (
                    <button key={label as string} style={{ flexGrow: (list as Task[]).length, background: c as string }} title={`${label}: ${(list as Task[]).length}`}
                      onClick={() => show(`${p.name}: ${(label as string).toLowerCase()}`, list as Task[])}><span>{label as string} {(list as Task[]).length}</span></button>
                  ) : null)}
                </div>
              )}

              <dl className="habit-facts">
                <dt>When late</dt>
                <dd>{median === null ? <span className="dim">Never late</span> : <N n={`usually ${median} day${median === 1 ? '' : 's'}`} title={`${p.name}: closed late`} list={l} />}</dd>
                <dt>Moved dates</dt>
                <dd>{moves.length ? <><N n={`${moves.length}×`} title={`${p.name}: dates moved`} list={mine.filter(MATCH.moved)} /> <span className="dim">· {early} in time, {moves.length - early} after the date</span></> : <span className="dim">None</span>}</dd>
                <dt>Slipped silently</dt>
                <dd><N n={silent.length} title={`${p.name}: slipped silently`} list={silent} warn={silent.length > 0} /></dd>
                <dt>Right now</dt>
                <dd>
                  <N n={`${open.length} open`} title={`${p.name}: open now`} list={open} />
                  {overdue.length > 0 && <> · <N n={`${overdue.length} overdue`} title={`${p.name}: overdue now`} list={overdue} warn /></>}
                  {blockedOnOthers.length > 0 && <> · <N n={`${blockedOnOthers.length} waiting on others`} title={`${p.name}: waiting on others`} list={blockedOnOthers} /></>}
                  {othersWaiting.length > 0 && <> · <N n={`${othersWaiting.length} others waiting on them`} title={`Waiting on ${p.name}`} list={othersWaiting} warn /></>}
                </dd>
              </dl>
            </section>
          );
        })}
      </div>

      {weekList.map((w) => {
        const rs = rows.filter((r) => r.weekStart === w);
        const wk = tasks.filter((t) => mondayOf(t.firstDueOn) === w);
        const kw = keptOf(wk);
        return (
          <section key={w}>
            <h2>Week of {fmtDate(w)} <span className="count-badge">{kw.pct === null ? 'n/a' : `${kw.pct}%`} kept</span></h2>
            {rs.length === 0 ? <div className="card"><p className="empty card-pad">No commitments fell due this week.</p></div> : (
              <div className="card table-card scroll"><table>
                <thead><tr><th>Person</th>{COLS.map(([k, l]) => <th key={k} className="num">{l}</th>)}</tr></thead>
                <tbody>
                  {rs.map((r) => {
                    const own = wk.filter((t) => t.ownerId === r.personId);
                    return (
                      <tr key={r.personId}>
                        <td><Person name={names[r.personId]} /></td>
                        {COLS.map(([k, l, m]) => (
                          <td key={k} className="num"><N n={r[k] as number} title={`${names[r.personId]}, week of ${fmtDate(w)}: ${l.toLowerCase()}`} list={own.filter(MATCH[m])} warn={m === 'silent' || m === 'pastdue'} /></td>
                        ))}
                      </tr>
                    );
                  })}
                  <tr className="total">
                    <td>Team</td>
                    {COLS.map(([k, l, m]) => (
                      <td key={k} className="num"><b><N n={sum(rs, k)} title={`Team, week of ${fmtDate(w)}: ${l.toLowerCase()}`} list={wk.filter(MATCH[m])} /></b></td>
                    ))}
                  </tr>
                </tbody>
              </table></div>
            )}
          </section>
        );
      })}

      {drill && <DrillPanel drill={drill} names={names} projectNames={projectNames} today={today} onClose={() => setDrill(null)} />}
    </>
  );
}

// The tasks behind a number: first date, each move with its reason, and how it ended.
function DrillPanel({ drill, names, projectNames, today, onClose }: {
  drill: NonNullable<Drill>; names: Record<string, string>; projectNames: Record<string, string>; today: string; onClose: () => void;
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="overlay drawer-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={drill.title}>
        <div className="drawer-top"><h2 className="drill-title">{drill.title} <span className="count-badge">{drill.tasks.length}</span></h2><button className="x" aria-label="Close" onClick={onClose}>×</button></div>
        <ol className="drill-list">
          {drill.tasks.map((t) => {
            const c = closedOn(t);
            const end = t.statusCategory === 'done' && c
              ? { text: `Closed ${fmtDate(c)}`, rel: days(t.firstDueOn, c), done: true }
              : { text: t.overdue ? `Open, ${days(t.dueOn, today)} days past due` : `Open, due ${fmtDate(t.dueOn)}`, rel: null, done: false };
            return (
              <li key={t.id} className="drill-item">
                <Link href={`/tasks/${t.id}`} className="drill-name">{t.title}</Link>
                <div className="small dim">{[names[t.ownerId], t.projectId ? projectNames[t.projectId] : '', t.workstream].filter(Boolean).join(' · ')}</div>
                {t.description && <div className="small drill-desc">{t.description}</div>}
                <ol className="trail-list">
                  <li><span className="dot first" />First given <b>{fmtDate(t.firstDueOn)}</b></li>
                  {t.renegotiations.map((r) => (
                    <li key={r.at} className={r.kind === 'late' ? 'late' : ''}>
                      <span className="dot" />Moved to <b>{fmtDate(r.to)}</b> on {fmtStamp(r.at)} · <span className={r.kind === 'late' ? 'late-text' : 'ok-text'}>{r.kind === 'late' ? 'after the date had passed' : 'in time'}</span>
                      {r.reason && <div className="why">“{r.reason}”</div>}
                    </li>
                  ))}
                  <li className={end.done && end.rel !== null && end.rel > 0 ? 'late' : t.overdue ? 'late' : ''}>
                    <span className={`dot ${end.done ? 'end' : 'open'}`} />{end.text}
                    {end.rel !== null && <> · <span className={end.rel > 0 ? 'late-text' : 'ok-text'}>{end.rel === 0 ? 'on the first date' : end.rel > 0 ? `${end.rel} day${end.rel === 1 ? '' : 's'} late` : `${-end.rel} day${end.rel === -1 ? '' : 's'} early`}</span></>}
                    {t.slippedSilently && <div className="small late-text">Slipped silently: the date passed with no new date logged in time.</div>}
                  </li>
                </ol>
              </li>
            );
          })}
        </ol>
      </aside>
    </div>
  );
}
