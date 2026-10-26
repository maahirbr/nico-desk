'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { countdown, membersExceptLead } from '@/lib/planUtil';
import type { Member, Project } from '@/lib/plan';
import { fmtDate } from '@/lib/time';
import { Avatar, PersonLink } from './chips';
import { CopyLink } from './CopyLink';
import { Help } from './HelpMode';
import { ProjectForm } from './ProjectForm';
import { OPEN_SETTINGS_EVENT } from './setupEvents';
import { api, Modal, type Opt } from './task-ui';
import { notify } from './toast';

// The top of a project page: what it is, when it is due, who is on it. Settings edits all of it.

export function ProjectHeader({ project: p, members, viewers, names, people, meId, canEdit, isAdmin = false, today }: {
  project: Project; members: Member[]; viewers: string[]; names: Record<string, string>; people: Opt[]; meId: string; canEdit: boolean; isAdmin?: boolean; today: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  // The setup check-list's "Add people" and "Name the partner" open Settings from here, at the part the step names.
  const [focus, setFocus] = useState<'members' | 'partner' | undefined>();
  const mayEdit = canEdit && !p.archivedAt;
  useEffect(() => {
    if (!mayEdit) return;
    const open = (e: Event) => {
      const step = (e as CustomEvent<string>).detail;
      setFocus(step === 'members' || step === 'partner' ? step : undefined);
      setEditing(true);
    };
    window.addEventListener(OPEN_SETTINGS_EVENT, open);
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, open);
  }, [mayEdit]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Archive is refused while work is open. The refusal opens a dialog that says how much, and a reason drops it all
  // and archives in one step (26 Oct). Delete for good is an admin's, on an archived project, with the name typed.
  const [ask, setAsk] = useState<null | { kind: 'drop'; message: string } | { kind: 'delete' }>(null);
  const [words, setWords] = useState('');
  const move = async (what: 'archive' | 'restore', dropOpen?: string) => {
    setBusy(true); setErr(null);
    try {
      await api(`/projects/${p.id}/${what}`, 'POST', dropOpen === undefined ? undefined : { dropOpen });
      notify(what === 'archive' ? 'Project archived' : 'Project restored');
      setAsk(null);
      router.refresh();
    } catch (e) {
      if ((e as { code?: string }).code === 'open_work' && dropOpen === undefined) { setWords(''); setAsk({ kind: 'drop', message: (e as Error).message }); }
      else setErr((e as Error).message);
    } finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true); setErr(null);
    try {
      await api(`/projects/${p.id}`, 'DELETE', { name: words });
      notify('Project deleted');
      router.push('/projects');
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  };
  const cd = p.launchOn ? countdown(today, p.launchOn) : null;
  const label = p.targetLabel ?? (p.kind === 'plan' ? 'End date' : 'Launch');
  const left = cd ? `${cd.months ? `${cd.months} mo ` : ''}${cd.days} d ${cd.past ? 'ago' : 'to go'}` : '';
  const team = (
    <>
      <PersonLink id={p.ownerId} className="tm"><Avatar id={p.ownerId} name={names[p.ownerId] ?? '?'} /><span><b>{names[p.ownerId]}</b><span className="dim">{p.leadId === p.ownerId ? <><Help term="project_owner">Project owner</Help> and <Help term="project_lead">lead</Help></> : <Help term="project_owner">Project owner</Help>}</span></span></PersonLink>
      {p.leadId !== p.ownerId && <PersonLink id={p.leadId} className="tm"><Avatar id={p.leadId} name={names[p.leadId] ?? '?'} /><span><b>{names[p.leadId]}</b><span className="dim"><Help term="project_lead">Project lead</Help></span></span></PersonLink>}
      {membersExceptLead(membersExceptLead(members, p.ownerId), p.leadId).map((m) => (
        <PersonLink key={m.personId} id={m.personId} className="tm"><Avatar id={m.personId} name={names[m.personId] ?? '?'} /><span><b>{names[m.personId]}</b><span className="dim">{m.role}</span></span></PersonLink>
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
        {p.archivedAt && <p className="archived-note">Archived. Its tasks stay readable and no new tasks can be added.</p>}
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
      <div className="phead-actions">
        <div className="phead-btns">
          <CopyLink path={`/projects/${p.id}`} what="project" />
          {canEdit && !p.archivedAt && <button className="btn ghost" onClick={() => { setFocus(undefined); setEditing(true); }}>Settings</button>}
          {canEdit && <button className="btn ghost" disabled={busy} onClick={() => move(p.archivedAt ? 'restore' : 'archive')}>{p.archivedAt ? 'Restore project' : 'Archive project'}</button>}
          {isAdmin && p.archivedAt && <button className="btn ghost" disabled={busy} onClick={() => { setErr(null); setWords(''); setAsk({ kind: 'delete' }); }}>Delete for good</button>}
        </div>
        {err && !ask && <p className="err small" role="alert">{err}</p>}
      </div>
      {ask?.kind === 'drop' && (
        <Modal title="Archive project" onClose={() => { setAsk(null); setErr(null); }}>
          <div className="drawer-form">
            <p className="small"><b>{ask.message}</b></p>
            <p className="small dim">Open tasks are marked Dropped with this reason. Open lines of work are removed. Restore brings the project back, and the tasks stay on record.</p>
            <label className="f"><span>Reason</span>
              <textarea rows={2} maxLength={280} value={words} placeholder="A short reason" onChange={(e) => setWords(e.target.value)} />
            </label>
            {err && <p className="err small" role="alert">{err}</p>}
            <div className="row">
              <button className="btn" disabled={busy || !words.trim()} onClick={() => move('archive', words.trim())}>Drop and archive</button>
              <button className="btn ghost" onClick={() => { setAsk(null); setErr(null); }}>Cancel</button>
            </div>
          </div>
        </Modal>
      )}
      {ask?.kind === 'delete' && (
        <Modal title="Delete project for good" onClose={() => { setAsk(null); setErr(null); }}>
          <div className="drawer-form">
            <p className="small"><b>This removes the project, its tasks, comments and chat. It cannot be undone.</b></p>
            <p className="small dim">The change log keeps a record that it existed. To keep the work instead, leave it archived.</p>
            <label className="f"><span>Type the project name to confirm</span>
              <input value={words} placeholder={p.name} onChange={(e) => setWords(e.target.value)} autoComplete="off" />
            </label>
            {err && <p className="err small" role="alert">{err}</p>}
            <div className="row">
              <button className="btn danger" disabled={busy || words.trim().toLowerCase() !== p.name.trim().toLowerCase()} onClick={remove}>Delete for good</button>
              <button className="btn ghost" onClick={() => { setAsk(null); setErr(null); }}>Cancel</button>
            </div>
          </div>
        </Modal>
      )}
      {editing && (
        <Modal title="Project Settings" onClose={() => setEditing(false)} wide>
          <ProjectForm people={people} meId={meId} projectId={p.id} focus={focus} onDone={() => setEditing(false)} initial={{
            name: p.name, kind: p.kind, ownerId: p.ownerId, leadId: p.leadId, goal: p.intro ?? '', eyebrow: p.eyebrow ?? '', phase: p.phase ?? '',
            launchOn: p.launchOn ?? '', targetLabel: label, workstreams: p.kind === 'plan' ? p.pillars.filter((x) => x.key !== 'general').map((x) => x.label) : p.workstreams,
            members, partnerName: p.partnerName ?? '', partnerPeople: p.partnerPeople, viewers,
          }} />
        </Modal>
      )}
    </header>
  );
}
