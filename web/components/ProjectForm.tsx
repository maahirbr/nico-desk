'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { focusOnDesktop } from './motion';
import { api, Modal as ModalShell, type Opt } from './task-ui';
import { notify } from './toast';

// Starting a project, or changing one later. What a project needs before it starts: a name,
// what done looks like, a lead, and a date. Everything else (team roles, sub-projects, a partner)
// can be added now or later.

export type ProjectValues = {
  name: string; kind: 'tasks' | 'plan'; ownerId: string; goal: string; eyebrow: string; phase: string;
  launchOn: string; targetLabel: string; workstreams: string[]; members: { personId: string; role: string }[];
  partnerName: string; partnerPeople: string[];
};

const LABELS = ['Launch', 'Go-live', 'Send date', 'Event date', 'End date', 'Quarter end'];

function ChipsInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const parts = draft.split(',').map((x) => x.trim()).filter(Boolean);
    if (parts.length) onChange([...new Set([...value, ...parts])]);
    setDraft('');
  };
  return (
    <div className="chips-input">
      {value.map((v) => (
        <span key={v} className="chip">{v}<button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(value.filter((x) => x !== v))}>×</button></span>
      ))}
      <input value={draft} placeholder={value.length ? 'Add another' : placeholder} onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1)); }}
        onBlur={add} />
    </div>
  );
}

export function ProjectForm({ people, meId, initial, projectId, onDone }: {
  people: Opt[]; meId: string; initial?: ProjectValues; projectId?: string; onDone: () => void;
}) {
  const router = useRouter();
  const editing = !!projectId;
  const [f, setF] = useState<ProjectValues>(initial ?? {
    name: '', kind: 'tasks', ownerId: meId, goal: '', eyebrow: '', phase: '', launchOn: '', targetLabel: 'Launch',
    workstreams: [], members: [], partnerName: '', partnerPeople: [],
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof ProjectValues>(k: K, v: ProjectValues[K]) => setF({ ...f, [k]: v });
  const free = people.filter((p) => p.id !== f.ownerId && !f.members.some((m) => m.personId === p.id));
  const ready = f.name.trim().length >= 2 && f.goal.trim().length >= 10 && (f.kind === 'tasks' || f.workstreams.length > 0);

  return (
    <form className="pform" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setErr(null);
      const body = {
        name: f.name, kind: f.kind, ownerId: f.ownerId, goal: f.goal, eyebrow: f.eyebrow, phase: f.phase, launchOn: f.launchOn || null,
        targetLabel: f.targetLabel, workstreams: f.workstreams, members: f.members.filter((m) => m.personId),
        ...(f.kind === 'plan' ? { partnerName: f.partnerName, partnerPeople: f.partnerPeople } : {}),
      };
      try {
        const p = await api(editing ? `/projects/${projectId}` : '/projects', editing ? 'PATCH' : 'POST', body);
        notify(editing ? 'Project saved' : 'Project started');
        onDone();
        if (editing) router.refresh(); else router.push(`/projects/${p.id}`);
      } catch (er) { setErr((er as Error).message); } finally { setBusy(false); }
    }}>
      <fieldset>
        <legend>The project</legend>
        <label className="f"><span>Name</span><input ref={focusOnDesktop} required maxLength={80} value={f.name} placeholder="e.g. Festive gifting" onChange={(e) => set('name', e.target.value)} /></label>
        {!editing && (
          <div className="kind-pick" role="radiogroup" aria-label="Kind of project">
            <button type="button" role="radio" aria-checked={f.kind === 'tasks'} onClick={() => set('kind', 'tasks')}>
              <b>Task board</b><span>A list of tasks with owners and dates, grouped by sub-project. Most projects.</span>
            </button>
            <button type="button" role="radio" aria-checked={f.kind === 'plan'} onClick={() => set('kind', 'plan')}>
              <b>Partner plan</b><span>Lines of work with an outside partner, checkpoints, and what they need from us.</span>
            </button>
          </div>
        )}
        <label className="f"><span>What done looks like</span>
          <textarea rows={2} maxLength={600} value={f.goal} placeholder="One or two sentences anyone on the team would agree with" onChange={(e) => set('goal', e.target.value)} />
        </label>
        <label className="f"><span>Category line (optional)</span><input maxLength={120} value={f.eyebrow} placeholder="e.g. Gifting · Hampers · Corporate orders" onChange={(e) => set('eyebrow', e.target.value)} /></label>
      </fieldset>

      <fieldset>
        <legend>Dates</legend>
        <div className="row">
          <label className="f" style={{ flex: '0 1 160px' }}><span>The date is a</span>
            <select value={f.targetLabel} onChange={(e) => set('targetLabel', e.target.value)}>{LABELS.map((l) => <option key={l}>{l}</option>)}</select>
          </label>
          <label className="f"><span>Date</span><input type="date" value={f.launchOn} onChange={(e) => set('launchOn', e.target.value)} /></label>
          <label className="f"><span>Phase (optional)</span><input maxLength={60} value={f.phase} placeholder="e.g. Sampling" onChange={(e) => set('phase', e.target.value)} /></label>
        </div>
      </fieldset>

      <fieldset>
        <legend>People</legend>
        <label className="f"><span>Project lead</span>
          <select value={f.ownerId} onChange={(e) => setF({ ...f, ownerId: e.target.value, members: f.members.filter((m) => m.personId !== e.target.value) })}>
            {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        {f.members.map((m, i) => (
          <div key={i} className="member-row">
            <select value={m.personId} aria-label="Person" onChange={(e) => set('members', f.members.map((x, j) => (j === i ? { ...x, personId: e.target.value } : x)))}>
              <option value="">Pick a person</option>
              {people.filter((p) => p.id === m.personId || (p.id !== f.ownerId && !f.members.some((x) => x.personId === p.id))).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input value={m.role} maxLength={60} placeholder="Their role, e.g. Packaging POC" aria-label="Role on this project"
              onChange={(e) => set('members', f.members.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)))} />
            <button type="button" className="row-btn del" aria-label="Remove person" onClick={() => set('members', f.members.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        {free.length > 0 && <button type="button" className="mini-btn" onClick={() => set('members', [...f.members, { personId: '', role: '' }])}>+ Add a person and their role</button>}
      </fieldset>

      <fieldset>
        <legend>{f.kind === 'plan' ? 'Pillars' : 'Sub-projects (optional)'}</legend>
        <ChipsInput value={f.workstreams} onChange={(v) => set('workstreams', v)}
          placeholder={f.kind === 'plan' ? 'e.g. Foundations, People, Use cases. Press Enter after each' : 'e.g. Hampers, Packaging. Press Enter after each'} />
      </fieldset>

      {f.kind === 'plan' && (
        <fieldset>
          <legend>Partner</legend>
          <div className="row">
            <label className="f" style={{ flex: '0 1 220px' }}><span>Partner name</span><input maxLength={80} value={f.partnerName} placeholder="e.g. Studio" onChange={(e) => set('partnerName', e.target.value)} /></label>
            <div className="f"><span>Their people</span><ChipsInput value={f.partnerPeople} onChange={(v) => set('partnerPeople', v)} placeholder="First names. Press Enter after each" /></div>
          </div>
        </fieldset>
      )}

      {err && <p className="err banner" role="alert">{err}</p>}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn ghost" onClick={onDone}>Cancel</button>
        <button className="btn" disabled={busy || !ready}>{editing ? 'Save project' : 'Start project'}</button>
      </div>
    </form>
  );
}

export function NewProjectButton({ people, meId }: { people: Opt[]; meId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn" onClick={() => setOpen(true)}>+ New project</button>
      {open && (
        <ModalShell title="Start a project" onClose={() => setOpen(false)} wide>
          <ProjectForm people={people} meId={meId} onDone={() => setOpen(false)} />
        </ModalShell>
      )}
    </>
  );
}
