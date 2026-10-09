import { notFound } from 'next/navigation';
import { requireMe } from '@/lib/auth';
import { ApiError } from '@/lib/errors';
import { lookups } from '@/lib/page';
import { getTask, markAssignedSeen, taskLog } from '@/lib/service';
import { fmtDate, fmtStamp, today } from '@/lib/time';
import Link from 'next/link';
import { Person, StatusChips, dueLine } from '@/components/chips';
import { TaskActions } from '@/components/client';
import { logLine as line } from '@/components/logText';

export const dynamic = 'force-dynamic';

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireMe();
  const { id } = await params;
  const { d, names, projectNames, activeOpts, projects, isLead } = await lookups(me);
  let t;
  try {
    t = await getTask(d, id);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  if (t.teamId !== me.team.id) notFound();
  if (t.ownerId === me.person.id) await markAssignedSeen(d, me.person.id, t.id);
  const log = await taskLog(d, t.id, undefined, 200);
  const isOwner = t.ownerId === me.person.id;
  const mirror = t.readOnly;
  const may = {
    edit: !mirror && (isOwner || isLead || t.createdBy === me.person.id),
    reassign: !mirror && (isOwner || isLead),
    health: !mirror && (isOwner || isLead),
    renegotiate: !mirror && (isOwner || isLead),
    close: !mirror && (isOwner || isLead),
    reopen: !mirror && isLead,
    block: !mirror && isOwner,
    unblock: !mirror && (isOwner || isLead || t.blocked?.onId === me.person.id),
    priority: !mirror && isLead,
    update: !mirror && (isOwner || isLead),
  };
  const acts = !mirror && Object.values(may).some(Boolean);
  return (
    <>
      <Link className="crumb" href="/me">← My tasks</Link>
      <div className="task-head">
        <h1>{t.title}</h1>
        <StatusChips t={t} names={names} />
      </div>
      {t.blocked && (
        <div className="ask">
          <span className="caps">{t.blocked.onId ? `Blocked on ${names[t.blocked.onId]}` : 'Blocked'}</span> <span className="small dim">since {fmtStamp(t.blocked.at)}</span>
          <div>{t.blocked.ask}</div>
        </div>
      )}
      <div className={acts ? 'task-grid' : ''}>
        <div>
          <div className="card card-pad">
            <p className="section-title">Details</p>
            <dl className="facts">
              <dt>Owner</dt><dd><Person name={names[t.ownerId]} /></dd>
              <dt>Due</dt><dd>{dueLine(t)}</dd>
              {t.renegotiations.length > 0 && (<><dt>Moves</dt><dd className="small">
                {t.renegotiations.map((r) => (
                  <div key={r.at}>{fmtDate(r.from)} → {fmtDate(r.to)} on {fmtStamp(r.at)}, {r.kind === 'open' ? 'in time' : 'after the date passed'}{r.reason && `: ${r.reason}`}</div>
                ))}
              </dd></>)}
              {t.outcome && (<><dt>Outcome</dt><dd>
                Judged against the first date, {fmtDate(t.firstDueOn)}.
                {t.metRevisedDate !== null && (t.metRevisedDate ? ' Met the renegotiated date.' : ' Missed the renegotiated date too.')}
              </dd></>)}
              <dt>Project</dt><dd>{t.projectId ? projectNames[t.projectId] : 'None'}</dd>
              {t.note && (<><dt>Note</dt><dd>{t.note}</dd></>)}
              {t.priority && (<><dt>Priority</dt><dd>{t.priority.value}, set by {names[t.priority.setBy]} on {fmtStamp(t.priority.setAt)}</dd></>)}
              <dt>Origin</dt><dd>{t.origin === 'app' ? 'Made in nico-desk' : t.origin === 'sheet' ? 'Read from a Sheet. Edit it there.' : 'From a meeting note'}</dd>
              {t.createdBy && t.createdBy !== t.ownerId && (<><dt>Assigned by</dt><dd>{names[t.createdBy]}</dd></>)}
            </dl>
          </div>

          <div className="card card-pad">
            <p className="section-title">Update log</p>
            <ol className="log">
              {log.map((e) => (
                <li key={e.id}>
                  <span className="when">{fmtStamp(e.at)}</span>
                  <span>
                    <b>{e.actorName ?? (e.origin === 'sheet' ? 'Sheet reader' : 'System')}</b>{' '}{line(e, names, projectNames)}
                    {e.reason && <div className="why">Reason: {e.reason}</div>}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {acts && (
          <aside>
            <TaskActions t={t} may={may} people={activeOpts} projects={projects} today={today()} />
          </aside>
        )}
      </div>
    </>
  );
}
