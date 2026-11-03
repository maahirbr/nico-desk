'use client';

import type { AdoptionRow, AdoptionStatus } from '@/lib/activity';
import { addDays, fmtDate, istDate } from '@/lib/time';
import { Person } from './chips';
import { InviteMenu } from './CopyLink';
import { useUrlText } from './remember';
import { WhenTip } from './WhenTip';

// Who is using Nico Desk during the pilot (30 Oct). Four tiles count each status, say in a line what it means, and filter
// the table when pressed
// (kept in the address, ?status=). Each row: the status, when they were last active, a dot per day for the last 14
// (filled when they opened the app that day) and their interactions this week: one number, its breakdown on hover or tap
// (4 Nov). Never signed in rows offer Copy invite, so an
// admin can nudge them by hand; the app sends nothing.

const STATUS: Record<AdoptionStatus, { label: string; tone: string; help: string }> = {
  daily: { label: 'Daily', tone: 'done', help: 'Opened it every weekday (Mon\u2060–\u2060Fri) this past week' },
  some: { label: 'Some days', tone: 'active', help: 'Opened it this past week, but not every weekday' },
  quiet: { label: 'Gone quiet', tone: 'late', help: 'Signed in before, but not this past week' },
  never: { label: 'Never signed in', tone: 'idle', help: 'Has not signed in yet' },
};
const ORDER: AdoptionStatus[] = ['daily', 'some', 'quiet', 'never'];

// Saturday and Sunday: their dots are lighter, since Daily counts weekdays only.
const isWeekend = (d: string) => [0, 6].includes(new Date(`${d}T00:00:00Z`).getUTCDay());

function ago(at: string | null, today: string): string {
  if (!at) return '—';
  const d = istDate(at);
  const n = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${d}T00:00:00Z`)) / 86_400_000);
  return n <= 0 ? 'Today' : n === 1 ? 'Yesterday' : n < 30 ? `${n} days ago` : fmtDate(d);
}

export function ActivityView({ rows, today, readOnly, me }: { rows: AdoptionRow[]; today: string; readOnly: boolean; me: string }) {
  const [raw, setStatus] = useUrlText('status');
  const status = (ORDER as string[]).includes(raw) ? (raw as AdoptionStatus) : null;
  const shown = status ? rows.filter((r) => r.status === status) : rows;
  const fortnight = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  return (
    <>
      <div className="stats tiles act-tiles">
        {ORDER.map((k) => (
          <button key={k} className={`card stat act-${k}`} aria-pressed={status === k} title={STATUS[k].help}
            onClick={() => setStatus(status === k ? '' : k)}>
            <div className="stat-n">{rows.filter((r) => r.status === k).length}</div><div className="stat-l">{STATUS[k].label}</div>
            <div className="act-help">{STATUS[k].help}</div>
          </button>
        ))}
      </div>
      {status && <p className="small dim act-showing">Showing {STATUS[status].label.toLowerCase()} only. <button type="button" className="linkbtn" onClick={() => setStatus('')}>Show everyone</button></p>}
      <div className="card table-card"><table className="stacked act-table">
        <thead><tr><th>Name</th><th>Status</th><th>Last active</th><th>Last 14 days</th><th>Interactions (7 days)</th></tr></thead>
        <tbody>
          {shown.length === 0 && <tr><td colSpan={5} className="empty-cell">No one here right now.</td></tr>}
          {shown.map((r) => {
            const on = new Set(r.days);
            return (
              <tr key={r.id}>
                <td><Person name={r.name} id={r.id} /></td>
                <td data-label="Status"><span className={`st st-status tone-${STATUS[r.status].tone}`} title={STATUS[r.status].help}>{STATUS[r.status].label}</span></td>
                <td data-label="Last active">{ago(r.lastActive, today)}</td>
                <td data-label="Last 14 days">
                  <span className="act-dots" aria-label={`Opened on ${r.days.length} of the last 14 days`}>
                    {fortnight.map((d) => <span key={d} className={`act-dot${on.has(d) ? ' on' : ''}${isWeekend(d) ? ' wkend' : ''}`} title={`${fmtDate(d)}${on.has(d) ? ': opened' : ''}`} />)}
                  </span>
                </td>
                <td data-label={r.status === 'never' ? 'Invite' : 'Interactions (7 days)'}>
                  {r.status === 'never' ? (readOnly ? <span className="dim">—</span> : <InviteMenu email={r.email} name={r.name} from={me} />)
                    : <WhenTip delay={500} tap side="right" text={r.interactions.total ? r.interactions.parts.map(([w, n]) => `${n} ${w}`).join('\n') : 'Nothing this week'}>
                        <span className={`act-n${r.interactions.total ? '' : ' dim'}`} aria-label={`${r.interactions.total} interactions: ${r.interactions.parts.map(([w, n]) => `${n} ${w}`).join(', ') || 'none'}`}>{r.interactions.total}</span>
                      </WhenTip>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table></div>
    </>
  );
}
