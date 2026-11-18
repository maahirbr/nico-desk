'use client';

import { useRouter } from 'next/navigation';
import { isPartnerProject } from '@/lib/planUtil';
import { useEffect, useState } from 'react';
import { countdown, membersExceptLead } from '@/lib/planUtil';
import type { ArchiveAsk, Member, Project } from '@/lib/plan';
import { fmtDate } from '@/lib/time';
import { Avatar, PersonLink } from './chips';
import { CopyLink } from './CopyLink';
import { Help } from './HelpMode';
import { ProjectForm } from './ProjectForm';
import { OPEN_SETTINGS_EVENT } from './setupEvents';
import { api, Modal, type Opt } from './task-ui';
import { notify } from './toast';

// The top of a project page: what it is, when it is due, who is on it. Settings edits all of it.

// access (15 Nov): what this person may do in Settings, which everyone sees (lib/plan.ts projectAccess). full: change
// anything; people: add people only; view: read only. canEdit (archive, restore) is full access.
// archiveAsk (15 Nov): a member's open ask to archive it. Everyone on the project sees it; full access answers it.
export function ProjectHeader({ project: p, members, viewers, names, people, meId, access, isAdmin = false, today, archiveAsk = null }: {
  project: Project; members: Member[]; viewers: string[]; names: Record<string, string>; people: Opt[]; meId: string; access: 'full' | 'people' | 'view'; isAdmin?: boolean; today: string; archiveAsk?: ArchiveAsk | null;
}) {
  const canEdit = access === 'full';
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  // The setup check-list's "Add people" and "Name the partner" open Settings from here, at the part the step names.
  const [focus, setFocus] = useState<'members' | 'partner' | undefined>();
  const mayEdit = access !== 'view' && !p.archivedAt;
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
  // archive: the reason first, for everyone (15 Nov). request: a member's ask to the owner and lead.
  const [ask, setAsk] = useState<null | { kind: 'drop'; message: string } | { kind: 'delete' } | { kind: 'archive' } | { kind: 'request' }>(null);
  const [words, setWords] = useState('');
  const move = async (what: 'archive' | 'restore', dropOpen?: string, reason?: string) => {
    setBusy(true); setErr(null);
    try {
      await api(`/projects/${p.id}/${what}`, 'POST', dropOpen !== undefined ? { dropOpen } : reason ? { reason } : undefined);
      notify(what === 'archive' ? 'Project archived' : 'Project restored');
      setAsk(null);
      router.refresh();
    } catch (e) {
      if ((e as { code?: string }).code === 'open_work' && dropOpen === undefined) { setWords(reason ?? ''); setAsk({ kind: 'drop', message: (e as Error).message }); }
      else setErr((e as Error).message);
    } finally { setBusy(false); }
  };
  const request = async () => {
    setBusy(true); setErr(null);
    try { await api(`/projects/${p.id}/archive-ask`, 'POST', { reason: words.trim() }); notify('Sent to the owner and lead'); setAsk(null); router.refresh(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const notNow = async () => {
    setBusy(true); setErr(null);
    try { await api(`/projects/${p.id}/archive-ask`, 'DELETE'); notify('Kept. They will see your answer.'); router.refresh(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
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
        <PersonLink key={m.personId} id={m.personId} className="tm"><Avatar id={m.personId} name={names[m.personId] ?? '?'} /><span><b>{names[m.personId]}</b><span className="dim">{m.role === 'Member' ? (people.find((x) => x.id === m.personId)?.role || m.role) : m.role}</span></span></PersonLink>
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
          {isPartnerProject(p) && p.partnerName && !p.partnerPeople.length && <span><b>Partner</b> {p.partnerName}</span>}
        </p>
        {p.archivedAt && <p className="archived-note">Archived. Its tasks stay readable and no new tasks can be added.</p>}
        {archiveAsk && !p.archivedAt && (
          <div className="callout archive-ask" role="status">
            <span><b>{archiveAsk.askedBy === meId ? 'You' : archiveAsk.askedByName}</b> asked to archive this project on {fmtDate(archiveAsk.askedAt.slice(0, 10))}: “{archiveAsk.reason}”{access !== 'full' && <span className="dim"> The owner or lead will decide.</span>}</span>
            {access === 'full' && <span className="row archive-ask-acts">
              <button className="btn" disabled={busy} onClick={() => { setErr(null); setWords(archiveAsk.reason); setAsk({ kind: 'archive' }); }}>Archive</button>
              <button className="btn ghost" disabled={busy} onClick={notNow}>Not now</button>
            </span>}
          </div>
        )}
        {p.intro && <p className="phead-goal">{p.intro}</p>}
        {isPartnerProject(p) ? (
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
          {!p.archivedAt && <button className="btn ghost" onClick={() => { setFocus(undefined); setEditing(true); }}>Settings</button>}
          {canEdit && p.archivedAt && <button className="btn ghost" disabled={busy} onClick={() => move('restore')}>Restore project</button>}
          {canEdit && !p.archivedAt && <button className="btn ghost" disabled={busy} onClick={() => { setErr(null); setWords(''); setAsk({ kind: 'archive' }); }}>Archive project</button>}
          {/* A member sees Archive too, as an ask to the owner and lead (the PM's call, 15 Nov). */}
          {access === 'people' && !p.archivedAt && !p.personalFor && <button className="btn ghost" disabled={busy || !!archiveAsk} title={archiveAsk ? 'Already asked' : undefined}
            onClick={() => { setErr(null); setWords(''); setAsk({ kind: 'request' }); }}>{archiveAsk ? 'Archive asked' : 'Archive project'}</button>}
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
      {(ask?.kind === 'archive' || ask?.kind === 'request') && (
        <Modal title={ask.kind === 'archive' ? 'Archive project' : 'Ask to archive'} onClose={() => { setAsk(null); setErr(null); }}>
          <div className="drawer-form">
            <p className="small dim">{ask.kind === 'archive'
              ? 'It leaves the project list. Its tasks stay readable, and Restore brings it back.'
              : 'Only the owner, lead or an admin can archive a project. This sends them your reason in the app, and they decide.'}</p>
            <label className="f"><span>Reason <span className="req" aria-hidden="true">*</span></span>
              <textarea rows={2} maxLength={280} value={words} placeholder="e.g. The launch is done" onChange={(e) => setWords(e.target.value)} />
            </label>
            {err && <p className="err small" role="alert">{err}</p>}
            <div className="row">
              <button className="btn" disabled={busy || !words.trim()} onClick={() => (ask.kind === 'archive' ? move('archive', undefined, words.trim()) : request())}>{ask.kind === 'archive' ? 'Archive' : 'Send request'}</button>
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
          <ProjectForm people={people} meId={meId} projectId={p.id} access={access} focus={focus} onDone={() => setEditing(false)} initial={{
            name: p.name, kind: p.kind, ownerId: p.ownerId, leadId: p.leadId, goal: p.intro ?? '', eyebrow: p.eyebrow ?? '', phase: p.phase ?? '',
            launchOn: p.launchOn ?? '', targetLabel: label, workstreams: p.kind === 'plan' ? p.pillars.filter((x) => x.key !== 'general').map((x) => x.label) : p.workstreams,
            members, partnerName: p.partnerName ?? '', partnerPeople: p.partnerPeople, viewers,
          }} />
        </Modal>
      )}
    </header>
  );
}
