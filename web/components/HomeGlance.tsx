'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  barShare, lineY, loadSummary, teamSummary, trendRuns, trendSummary, weekSummary,
  type Glance, type LoadRow, type TeamRow, type TrendWeek, type WeekSplit,
} from '@/lib/glance';
import { fmtDate } from '@/lib/time';
import { PersonLink } from './chips';
import { useFirstView } from './motion';
import { useRemembered } from './remember';

// Home at a glance: four small charts drawn from tokens (no chart library), so every skin colours them in day
// and night. Done is the Done status green, open is the quiet ink, late is the late red. Colour never carries the
// number alone: each bar has its count written beside it, and each chart has a plain sentence for screen readers.
// The draw-in plays once per browser tab (CSS in globals.css, .glance-in) and not at all under reduced motion.

// The pieces below are also used by the person page and the project page (PersonGlance, components/ProjectVisuals.tsx).
export function Card({ title, href, link, summary, wide, children }: { title: string; href?: string; link?: string; summary: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <section className={`card glance-card${wide ? ' wide' : ''}`} aria-label={title}>
      <div className="glance-head">
        <h3>{title}</h3>
        {href && link && <Link href={href} className="rlink small dim">{link}</Link>}
      </div>
      <p className="glance-sr">{summary}</p>
      {children}
    </section>
  );
}

export function WeekBar({ s }: { s: WeekSplit }) {
  const parts = [['done', s.done, 'Done'], ['open', s.open, 'Open'], ['late', s.late, 'Late']] as const;
  return (
    <div aria-hidden>
      <div className="glance-track glance-split">
        {parts.map(([k, n]) => n > 0 && <span key={k} className={`gs-${k}`} style={{ flexGrow: n }} />)}
      </div>
      {s.total === 0 ? <p className="empty glance-empty">Nothing due or finished this week.</p> : (
        <ul className="glance-legend">
          {parts.map(([k, n, label]) => <li key={k}><i className={`gs-${k}`} /><b>{n}</b> {label.toLowerCase()}</li>)}
        </ul>
      )}
    </div>
  );
}

const W = 240, H = 64, PAD = 8;

export function TrendLine({ weeks, subject = 'Your' }: { weeks: TrendWeek[]; subject?: string }) {
  if (weeks.every((w) => w.rate === null)) {
    return <p className="empty glance-empty" aria-hidden>No finished tasks in the last four weeks yet. {subject} on-time rate shows here once something closes.</p>;
  }
  const x = (i: number) => ((i + 0.5) / weeks.length) * W;
  return (
    <div aria-hidden>
      <svg className="glance-svg" viewBox={`0 0 ${W} ${H}`} focusable="false">
        <line className="gl-grid" x1="0" x2={W} y1={lineY(100, H, PAD)} y2={lineY(100, H, PAD)} />
        <line className="gl-grid" x1="0" x2={W} y1={lineY(0, H, PAD)} y2={lineY(0, H, PAD)} />
        {trendRuns(weeks).map((run, k) => run.length > 1 && (
          <polyline key={k} className="gl-line" pathLength={1} points={run.map(([i, r]) => `${x(i)},${lineY(r, H, PAD)}`).join(' ')} />
        ))}
        {weeks.map((w, i) => w.rate !== null && <circle key={w.weekStart} className="gl-dot" cx={x(i)} cy={lineY(w.rate, H, PAD)} r="3.5" />)}
      </svg>
      <ol className="glance-weeks">
        {weeks.map((w) => (
          <li key={w.weekStart}>
            <b>{w.rate === null ? '–' : `${w.rate}%`}</b>
            <span className="dim">{fmtDate(w.weekStart)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// A bar whose length is its share of the longest, with the late part of it in the late colour.
function LoadBar({ open, late, max }: { open: number; late: number; max: number }) {
  return (
    <span className="glance-track" aria-hidden>
      {open > 0 && (
        <span className="glance-fill" style={{ width: `${barShare(open, max) * 100}%` }}>
          {open - late > 0 && <span className="gs-open" style={{ flexGrow: open - late }} />}
          {late > 0 && <span className="gs-late" style={{ flexGrow: late }} />}
        </span>
      )}
    </span>
  );
}

const counts = (open: number, late: number) => (
  <span className="glance-n">{open} open{late > 0 && <> <span className="late-text">· {late} late</span></>}</span>
);

function LoadList({ rows }: { rows: LoadRow[] }) {
  if (!rows.some((r) => r.open > 0)) {
    return <p className="empty glance-empty" aria-hidden>{rows.length ? 'No open tasks in your projects.' : 'No open tasks, and you are not on a project yet.'}</p>;
  }
  const max = Math.max(...rows.map((r) => r.open));
  return (
    <ul className="glance-rows">
      {rows.map((r) => (
        <li key={r.id ?? 'none'}>
          <div className="glance-row-top">
            {r.id ? <Link href={`/projects/${r.id}`} className="rlink glance-name">{r.name}</Link> : <span className="glance-name">{r.name}</span>}
            {counts(r.open, r.late)}
          </div>
          <LoadBar open={r.open} late={r.late} max={max} />
        </li>
      ))}
    </ul>
  );
}

const TEAM_ROWS = 5;

function TeamTable({ rows }: { rows: TeamRow[] }) {
  if (rows.length === 0) return <p className="empty glance-empty">No one on the team has an open task.</p>;
  const max = Math.max(...rows.map((r) => r.open));
  // The biggest lists first; the rest are one click away on the Team page, so this card stays short.
  const shown = rows.slice(0, TEAM_ROWS);
  return (
    <table className="glance-table">
      <caption className="glance-sr">Open and late tasks per person</caption>
      <tbody>
        {shown.map((r) => (
          <tr key={r.id}>
            <th scope="row"><PersonLink id={r.id}>{r.name}</PersonLink></th>
            <td><LoadBar open={r.open} late={r.late} max={max} /></td>
            <td>{counts(r.open, r.late)}</td>
          </tr>
        ))}
      </tbody>
      {rows.length > shown.length && <tfoot><tr><td colSpan={3} className="dim">and {rows.length - shown.length} more on the Team page</td></tr></tfoot>}
    </table>
  );
}

// Whose charts these are on a teammate's page: this week and the on-time rate, the first two Home cards. The page
// passes them only to a viewer who may see that person's on-time record (lib/service.ts personView).
export function PersonGlance({ personId, firstName, mine, week, trend }: { personId: string; firstName: string; mine: boolean; week: WeekSplit; trend: TrendWeek[] }) {
  const first = useFirstView(`person-glance:${personId}`);
  const draw = typeof window === 'undefined' ? true : first;
  const subject = mine ? 'Your' : `${firstName}'s`;
  return (
    <div className={`glance-grid glance-two${draw ? ' glance-in' : ''}`} suppressHydrationWarning>
      <Card title="This week" summary={weekSummary(week)}><WeekBar s={week} /></Card>
      <Card title="On-time rate" href={`/ledger?person=${personId}`} link="See the ledger" summary={trendSummary(trend, subject)}><TrendLine weeks={trend} subject={subject} /></Card>
    </div>
  );
}

// On a phone the strip starts shut, so the page opens on the person's own work. That is decided in CSS from the
// section's data-choice ("auto" until the person has used the toggle), so the first paint is already right and
// nothing jumps. Once they open or close it, the choice is kept (components/remember.ts) and wins on every screen.
const PHONE = '(max-width: 767px)';

export function HomeGlance({ glance }: { glance: Glance }) {
  // Whether the strip is open comes back the next time Home is opened in this browser. null means no choice yet.
  const [kept, keep] = useRemembered('home-glance', { open: null as boolean | null }, (raw) => (typeof raw.open === 'boolean' ? { open: raw.open } : {}));
  const first = useFirstView('home-glance');
  // Only for aria-expanded and the toggle: what "auto" means on this screen. The look itself comes from CSS.
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const q = window.matchMedia(PHONE);
    setPhone(q.matches);
    const on = () => setPhone(q.matches);
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, []);
  const open = kept.open ?? !phone;
  // The server always writes the class, so a hard load draws in with no flash; a client visit to Home already
  // seen in this tab leaves it out, and so does reduced motion.
  const draw = typeof window === 'undefined' ? true : first;
  const { week, trend, load, team } = glance;
  return (
    <section className="glance" aria-label="Home at a glance" data-choice={kept.open === null ? 'auto' : kept.open ? 'open' : 'closed'}>
      <div className="list-head">
        <button className="log-toggle small-toggle" aria-expanded={open} onClick={() => keep('open', !open)}>
          <span className="glance-caret" aria-hidden /> At a glance
        </button>
      </div>
      {kept.open !== false && (
        <div className={`glance-grid${draw ? ' glance-in' : ''}`} suppressHydrationWarning>
          <Card title="This week" href="/team?view=status" link="See the week" summary={weekSummary(week)}><WeekBar s={week} /></Card>
          <Card title="On-time rate" href="/ledger" link="See the ledger" summary={trendSummary(trend)}><TrendLine weeks={trend} /></Card>
          <Card title="Your load by project" href="/projects" link="All projects" summary={loadSummary(load)}><LoadList rows={load} /></Card>
          {team && <Card title="Team load" href="/team" link="See the team" summary={teamSummary(team)} wide><TeamTable rows={team} /></Card>}
        </div>
      )}
    </section>
  );
}
