'use client';

import { useState } from 'react';
import { countdown, membersExceptLead } from '@/lib/planUtil';
import type { Member, Project } from '@/lib/plan';
import { fmtDate } from '@/lib/time';
import { Avatar } from './chips';
import { ProjectForm } from './ProjectForm';
import { Modal, type Opt } from './task-ui';

// The top of a project page: what it is, when it is due, who is on it. Settings edits all of it.

export function ProjectHeader({ project: p, members, names, people, meId, canEdit, today }: {
  project: Project; members: Member[]; names: Record<string, string>; people: Opt[]; meId: string; canEdit: boolean; today: string;
}) {
  const [editing, setEditing] = useState(false);
  const cd = p.launchOn ? countdown(today, p.launchOn) : null;
  const label = p.targetLabel ?? (p.kind === 'plan' ? 'End date' : 'Launch');
  const left = cd ? `${cd.months ? `${cd.months} mo ` : ''}${cd.days} d ${cd.past ? 'ago' : 'to go'}` : '';
  const team = (
    <>
      <span className="tm"><Avatar name={names[p.ownerId] ?? '?'} /><span><b>{names[p.ownerId]}</b><span className="dim">{p.leadId === p.ownerId ? 'Project owner and lead' : 'Project owner'}</span></span></span>
      {p.leadId !== p.ownerId && <span className="tm"><Avatar name={names[p.leadId] ?? '?'} /><span><b>{names[p.leadId]}</b><span className="dim">Project lead</span></span></span>}
      {membersExceptLead(membersExceptLead(members, p.ownerId), p.leadId).map((m) => (
        <span key={m.personId} className="tm"><Avatar name={names[m.personId] ?? '?'} /><span><b>{names[m.personId]}</b><span className="dim">{m.role}</span></span></span>
      ))}
    </>
  );
  return (
    <header className="phead">
      <div className="phead-main">
        <h1>{p.name}</h1>
        {p.eyebrow && <div className="eyebrow">{p.eyebrow}</div>}
        <p className="phead-meta">
          {p.launchOn && <span><b>{label}</b> {fmtDate(p.launchOn)} <span className={cd?.past ? 'late-text' : 'dim'}>· {left}</span></span>}
          {p.phase && <span><b>Phase</b> {p.phase}</span>}
          {p.kind === 'plan' && p.partnerName && !p.partnerPeople.length && <span><b>Partner</b> {p.partnerName}</span>}
        </p>
        {p.intro && <p className="phead-goal">{p.intro}</p>}
        {p.kind === 'plan' ? (
          <div className="phead-sides">
            <span className="side-name">Nicobar</span>
            <div className="phead-team">{team}</div>
            {p.partnerPeople.length > 0 && <>
              <span className="side-name">{p.partnerName ?? 'Partner'}</span>
              <div className="phead-team">{p.partnerPeople.map((n) => <span key={n} className="tm"><Avatar name={n} /><b>{n}</b></span>)}</div>
            </>}
          </div>
        ) : <div className="phead-team">{team}</div>}
      </div>
      {canEdit && <button className="btn ghost" onClick={() => setEditing(true)}>Settings</button>}
      {editing && (
        <Modal title="Project Settings" onClose={() => setEditing(false)} wide>
          <ProjectForm people={people} meId={meId} projectId={p.id} onDone={() => setEditing(false)} initial={{
            name: p.name, kind: p.kind, ownerId: p.ownerId, leadId: p.leadId, goal: p.intro ?? '', eyebrow: p.eyebrow ?? '', phase: p.phase ?? '',
            launchOn: p.launchOn ?? '', targetLabel: label, workstreams: p.kind === 'plan' ? p.pillars.map((x) => x.label) : p.workstreams,
            members, partnerName: p.partnerName ?? '', partnerPeople: p.partnerPeople,
          }} />
        </Modal>
      )}
    </header>
  );
}
