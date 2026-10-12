'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { countdown, membersExceptLead } from '@/lib/planUtil';
import type { Member, Project } from '@/lib/plan';
import { fmtDate } from '@/lib/time';
import { Avatar, PersonLink } from './chips';
import { Help } from './HelpMode';
import { ProjectForm } from './ProjectForm';
import { api, Modal, type Opt } from './task-ui';
import { notify } from './toast';

// The top of a project page: what it is, when it is due, who is on it. Settings edits all of it.

export function ProjectHeader({ project: p, members, names, people, meId, canEdit, today }: {
  project: Project; members: Member[]; names: Record<string, string>; people: Opt[]; meId: string; canEdit: boolean; today: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Archive is refused while work is open: the message says how much, and shows here.
  const move = async (what: 'archive' | 'restore') => {
    setBusy(true); setErr(null);
    try {
      await api(`/projects/${p.id}/${what}`, 'POST');
      notify(what === 'archive' ? 'Project archived' : 'Project restored');
      router.refresh();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const cd = p.launchOn ? countdown(today, p.launchOn) : null;
  const label = p.targetLabel ?? (p.kind === 'plan' ? 'End date' : 'Launch');
  const left = cd ? `${cd.months ? `${cd.months} mo ` : ''}${cd.days} d ${cd.past ? 'ago' : 'to go'}` : '';
  return (
    <header className="phead">
      <div className="phead-main">
        <h1>{p.name}</h1>
        {p.eyebrow && <div className="eyebrow">{p.eyebrow}</div>}
        <p className="phead-meta">
          {p.launchOn && <span><b>{label}</b> {fmtDate(p.launchOn)} <span className={cd?.past ? 'late-text' : 'dim'}>· {left}</span></span>}
          {p.phase && <span><b>Phase</b> {p.phase}</span>}
          {p.kind === 'plan' && p.partnerName && <span><b>Partner</b> {p.partnerName}</span>}
        </p>
        {p.archivedAt && <p className="archived-note">Archived. Its tasks stay readable and no new tasks can be added.</p>}
        {p.intro && <p className="phead-goal">{p.intro}</p>}
        <div className="phead-team">
          <PersonLink id={p.ownerId} className="tm"><Avatar name={names[p.ownerId] ?? '?'} /><span><b>{names[p.ownerId]}</b><span className="dim"><Help term="project_lead">Project lead</Help></span></span></PersonLink>
          {membersExceptLead(members, p.ownerId).map((m) => (
            <PersonLink key={m.personId} id={m.personId} className="tm"><Avatar name={names[m.personId] ?? '?'} /><span><b>{names[m.personId]}</b><span className="dim">{m.role}</span></span></PersonLink>
          ))}
        </div>
      </div>
      {canEdit && (
        <div className="phead-actions">
          {!p.archivedAt && <button className="btn ghost" onClick={() => setEditing(true)}>Settings</button>}
          <button className="btn ghost" disabled={busy} onClick={() => move(p.archivedAt ? 'restore' : 'archive')}>{p.archivedAt ? 'Restore project' : 'Archive project'}</button>
          {err && <p className="err small" role="alert">{err}</p>}
        </div>
      )}
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
