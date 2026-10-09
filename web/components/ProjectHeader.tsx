'use client';

import { useState } from 'react';
import { countdown } from '@/lib/planUtil';
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
  return (
    <header className="phead">
      <div className="phead-main">
        {p.eyebrow && <div className="eyebrow">{p.eyebrow}</div>}
        <h1>{p.name}</h1>
        <p className="phead-meta">
          {p.launchOn && <span><b>{label}</b> {fmtDate(p.launchOn)} <span className={cd?.past ? 'late-text' : 'dim'}>· {left}</span></span>}
          {p.phase && <span><b>Phase</b> {p.phase}</span>}
          {p.kind === 'plan' && p.partnerName && <span><b>Partner</b> {p.partnerName}</span>}
        </p>
        {p.intro && <p className="phead-goal">{p.intro}</p>}
        <div className="phead-team">
          <span className="tm"><Avatar name={names[p.ownerId] ?? '?'} /><span><b>{names[p.ownerId]}</b><span className="dim">Project lead</span></span></span>
          {members.map((m) => (
            <span key={m.personId} className="tm"><Avatar name={names[m.personId] ?? '?'} /><span><b>{names[m.personId]}</b><span className="dim">{m.role}</span></span></span>
          ))}
        </div>
      </div>
      {canEdit && <button className="btn ghost" onClick={() => setEditing(true)}>Settings</button>}
      {editing && (
        <Modal title="Project settings" onClose={() => setEditing(false)} wide>
          <ProjectForm people={people} meId={meId} projectId={p.id} onDone={() => setEditing(false)} initial={{
            name: p.name, kind: p.kind, ownerId: p.ownerId, goal: p.intro ?? '', eyebrow: p.eyebrow ?? '', phase: p.phase ?? '',
            launchOn: p.launchOn ?? '', targetLabel: label, workstreams: p.kind === 'plan' ? p.pillars.map((x) => x.label) : p.workstreams,
            members, partnerName: p.partnerName ?? '', partnerPeople: p.partnerPeople,
          }} />
        </Modal>
      )}
    </header>
  );
}
