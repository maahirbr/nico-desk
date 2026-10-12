'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { focusOnDesktop } from './motion';
import { api, Modal as ModalShell, type Opt } from './task-ui';
import { notify } from './toast';

// Starting a project, or changing one later. What a project needs before it starts: a name,
// an owner (who may also lead it), and a date; a one-line description helps. Only the people added
// here appear in the project's owner pickers and on their own Home. Everything else (team roles, sub-projects, a partner)
// can be added now or later.

export type ProjectValues = {
  name: string; kind: 'tasks' | 'plan'; ownerId: string; leadId: string; goal: string; eyebrow: string; phase: string;
  launchOn: string; targetLabel: string; workstreams: string[]; members: { personId: string; role: string }[];
  partnerName: string; partnerPeople: string[];
};

// What the target date is. Anything else is typed in under Other.
const LABELS = ['Deadline', 'Launch', 'Event', 'Quarter End'];
const OTHER = 'Other…';

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
    name: '', kind: 'tasks', ownerId: meId, leadId: meId, goal: '', eyebrow: '', phase: '', launchOn: '', targetLabel: 'Deadline',
    workstreams: [], members: [], partnerName: '', partnerPeople: [],
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof ProjectValues>(k: K, v: ProjectValues[K]) => setF({ ...f, [k]: v });
  const [otherLabel, setOtherLabel] = useState(!LABELS.includes(f.targetLabel));
  const [sameLead, setSameLead] = useState(f.leadId === f.ownerId);
  const leadId = sameLead ? f.ownerId : f.leadId;
  const taken = (id: string) => id === f.ownerId || id === leadId;
  const free = people.filter((p) => !taken(p.id) && !f.members.some((m) => m.personId === p.id));
  const ready = f.name.trim().length >= 2 && !!leadId && (!otherLabel || f.targetLabel.trim().length > 0);

  return (
    <form className="pform" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setErr(null);
      const body = {
        name: f.name, kind: f.kind, ownerId: f.ownerId, leadId, goal: f.goal, eyebrow: f.eyebrow, phase: f.phase, launchOn: f.launchOn || null,
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
        <label className="f"><span>Project Name</span><input ref={focusOnDesktop} required maxLength={80} value={f.name} placeholder="e.g. SS27 Drop 1" onChange={(e) => set('name', e.target.value)} /></label>
        {!editing && (
          <div className="kind-pick" role="radiogroup" aria-label="Kind of project">
            <button type="button" role="radio" aria-checked={f.kind === 'tasks'} onClick={() => set('kind', 'tasks')}>
              <b>Internal</b><span>A task board the Nicobar team runs, with owners and dates.</span>
            </button>
            <button type="button" role="radio" aria-checked={f.kind === 'plan'} onClick={() => set('kind', 'plan')}>
              <b>Partner / Collaboration</b><span>Work shared with an outside partner who owns some tasks, like a brand collab or a consultant.</span>
            </button>
          </div>
        )}
        <label className="f"><span>Project Description</span>
          <input maxLength={160} value={f.goal} placeholder="In one line" onChange={(e) => set('goal', e.target.value)} />
        </label>
        <label className="f"><span>Category (Optional)</span><input maxLength={120} value={f.eyebrow} placeholder="e.g. House & Home" onChange={(e) => set('eyebrow', e.target.value)} /></label>
      </fieldset>

      <fieldset>
        <div className="row">
          <div className="f target-date"><span>Target Date</span>
            <div className="target-date-pair">
              <select aria-label="What the date is" value={otherLabel ? OTHER : f.targetLabel}
                onChange={(e) => { const v = e.target.value; setOtherLabel(v === OTHER); set('targetLabel', v === OTHER ? '' : v); }}>
                {[...LABELS, OTHER].map((l) => <option key={l}>{l}</option>)}
              </select>
              {otherLabel && <input className="other-label" aria-label="Your label" maxLength={40} placeholder="e.g. Delivery" value={f.targetLabel} onChange={(e) => set('targetLabel', e.target.value)} />}
              <input type="date" aria-label="Target date" value={f.launchOn} onChange={(e) => set('launchOn', e.target.value)} />
            </div>
          </div>
          <label className="f"><span>Phase (Optional)</span><input maxLength={60} value={f.phase} placeholder="e.g. Sampling" onChange={(e) => set('phase', e.target.value)} /></label>
        </div>
      </fieldset>

      <fieldset>
        <legend>People</legend>
        {f.kind === 'plan' && <span className="pform-side">Nicobar</span>}
        <label className="f"><span>Project Owner</span>
          <select value={f.ownerId} onChange={(e) => setF({ ...f, ownerId: e.target.value, leadId: f.leadId === e.target.value ? '' : f.leadId, members: f.members.filter((m) => m.personId !== e.target.value) })}>
            {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="same-lead">
          <input type="checkbox" checked={sameLead} onChange={(e) => { setSameLead(e.target.checked); if (!e.target.checked && f.leadId === f.ownerId) set('leadId', ''); }} />
          The owner is also the Project Lead
        </label>
        {!sameLead && (
          <label className="f"><span>Project Lead</span>
            <select value={f.leadId} onChange={(e) => setF({ ...f, leadId: e.target.value, members: f.members.filter((m) => m.personId !== e.target.value) })}>
              <option value="">Pick a person</option>
              {people.filter((p) => p.id !== f.ownerId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        )}
        <span className="pform-sub">Other People</span>
        <p className="dim small pform-note">Only the people added here can own tasks in this project, and they will see it in their view.</p>
        {f.members.map((m, i) => (
          <div key={i} className="member-row">
            <select value={m.personId} aria-label="Person" onChange={(e) => set('members', f.members.map((x, j) => (j === i ? { ...x, personId: e.target.value } : x)))}>
              <option value="">Pick a person</option>
              {people.filter((p) => p.id === m.personId || (!taken(p.id) && !f.members.some((x) => x.personId === p.id))).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input value={m.role} maxLength={60} placeholder="Their role in this project, e.g. Sourcing, Design, etc." aria-label="Role on this project"
              onChange={(e) => set('members', f.members.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)))} />
            <button type="button" className="row-btn del" aria-label="Remove person" onClick={() => set('members', f.members.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        {free.length > 0 && <button type="button" className="mini-btn" onClick={() => set('members', [...f.members, { personId: '', role: '' }])}>+ Add Person</button>}

        {f.kind === 'plan' && (
          <>
            <span className="pform-side">Partner</span>
            <label className="f"><span>Partner Name</span><input maxLength={80} value={f.partnerName} placeholder="e.g. Studio" onChange={(e) => set('partnerName', e.target.value)} /></label>
            <div className="f"><span>Their People</span><ChipsInput value={f.partnerPeople} onChange={(v) => set('partnerPeople', v)} placeholder="Names. Press Enter after each" /></div>
          </>
        )}
      </fieldset>

      <fieldset>
        <legend>Sub-Projects (Optional)</legend>
        <ChipsInput value={f.workstreams} onChange={(v) => set('workstreams', v)} placeholder="e.g. Hampers, Packaging. Press Enter after each" />
      </fieldset>

      {err && <p className="err banner" role="alert">{err}</p>}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn ghost" onClick={onDone}>Cancel</button>
        <button className="btn" disabled={busy || !ready}>{editing ? 'Save Project' : 'Start Project'}</button>
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
        <ModalShell title="Start a Project" onClose={() => setOpen(false)} wide>
          <ProjectForm people={people} meId={meId} onDone={() => setOpen(false)} />
        </ModalShell>
      )}
    </>
  );
}
