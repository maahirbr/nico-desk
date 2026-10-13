'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { DateField } from './DateField';
import { focusOnDesktop } from './motion';
import { Select } from './Select';
import { api, Modal as ModalShell, type Opt } from './task-ui';
import { notify } from './toast';
import { composing, isRealEnter } from './ime';

// Starting a project, or changing one later. What a project needs before it starts: a name,
// an owner (who may also lead it), and a date; a one-line description helps. Only the people added
// here appear in the project's owner pickers and on their own Home. Everything else (team roles, sub-projects, a partner)
// can be added now or later.

export type ProjectValues = {
  name: string; kind: 'tasks' | 'plan'; ownerId: string; leadId: string; goal: string; eyebrow: string; phase: string;
  launchOn: string; targetLabel: string; workstreams: string[]; members: { personId: string; role: string }[];
  partnerName: string; partnerPeople: string[];
  viewers?: string[]; // set when editing: who may see the project without being on it
};

// What the target date is. Anything else is typed in under Other.
const LABELS = ['Deadline', 'Launch', 'Event', 'Quarter end'];
const OTHER = 'Other…';
// The description's length limit. It matches the server's rule in lib/projectBody.ts.
const GOAL_MAX = 600;

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
      <input value={draft} enterKeyHint="done" autoComplete="off" placeholder={value.length ? 'Add another' : placeholder} onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (isRealEnter(e) || (e.key === ',' && !composing(e))) { e.preventDefault(); add(); } if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1)); }}
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
    workstreams: [], members: [], partnerName: '', partnerPeople: [], viewers: [],
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // The reason Start is not ready shows only after a try, so a fresh form opens clean.
  const [tried, setTried] = useState(false);
  const set = <K extends keyof ProjectValues>(k: K, v: ProjectValues[K]) => setF({ ...f, [k]: v });
  const [otherLabel, setOtherLabel] = useState(!LABELS.includes(f.targetLabel));
  const [sameLead, setSameLead] = useState(f.leadId === f.ownerId);
  // With the tick on, the owner leads. The stored leadId is then not used, and is cleared so it cannot come back stale.
  const leadId = sameLead ? f.ownerId : f.leadId;
  const taken = (id: string) => id === f.ownerId || id === leadId;
  const free = people.filter((p) => !taken(p.id) && !f.members.some((m) => m.personId === p.id));
  // Why Start or Save cannot go yet, in plain words, shown above the buttons after a try.
  const why = f.name.trim().length < 2 ? 'Give the project a name.'
    : !leadId ? 'Pick a project lead, or tick that the owner is also the lead.'
    : otherLabel && !f.targetLabel.trim() ? 'Type what the date is, or pick one from the list.'
    : null;

  return (
    <form className="pform" onSubmit={async (e) => {
      e.preventDefault();
      if (why) { setTried(true); return; }
      setBusy(true); setErr(null);
      const body = {
        name: f.name, kind: f.kind, ownerId: f.ownerId, leadId, goal: f.goal, eyebrow: f.eyebrow, phase: f.phase, launchOn: f.launchOn || null,
        targetLabel: f.targetLabel, workstreams: f.workstreams, members: f.members.filter((m) => m.personId),
        ...(f.kind === 'plan' ? { partnerName: f.partnerName, partnerPeople: f.partnerPeople } : {}),
        ...(f.viewers ? { viewers: f.viewers.filter((v) => !taken(v) && !f.members.some((m) => m.personId === v)) } : {}),
      };
      try {
        const p = await api(editing ? `/projects/${projectId}` : '/projects', editing ? 'PATCH' : 'POST', body);
        notify(editing ? 'Project saved' : 'Project started');
        onDone();
        if (editing) router.refresh(); else router.push(`/projects/${p.id}`);
      } catch (er) { setErr((er as Error).message); } finally { setBusy(false); }
    }}>
      <fieldset>
        <label className="f"><span>Project Name</span><input ref={focusOnDesktop} maxLength={80} aria-invalid={tried && f.name.trim().length < 2 ? true : undefined} enterKeyHint="next" autoComplete="off" value={f.name} placeholder="e.g. SS27 Drop 1" onChange={(e) => set('name', e.target.value)} /></label>
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
          <input maxLength={GOAL_MAX} enterKeyHint="next" autoComplete="off" value={f.goal} placeholder="In one line" onChange={(e) => set('goal', e.target.value)} />
        </label>
        <label className="f"><span>Category (optional)</span><input maxLength={120} enterKeyHint="next" autoComplete="off" value={f.eyebrow} placeholder="e.g. House & Home" onChange={(e) => set('eyebrow', e.target.value)} /></label>
      </fieldset>

      <fieldset>
        <div className="row">
          <div className="f target-date"><span>Target Date</span>
            <div className="target-date-pair">
              <Select aria-label="What the date is" value={otherLabel ? OTHER : f.targetLabel}
                onChange={(v) => { setOtherLabel(v === OTHER); set('targetLabel', v === OTHER ? '' : v); }}>
                {[...LABELS, OTHER].map((l) => <option key={l}>{l}</option>)}
              </Select>
              {otherLabel && <input className="other-label" aria-label="Your label" maxLength={40} enterKeyHint="done" autoComplete="off" placeholder="e.g. Delivery" value={f.targetLabel} onChange={(e) => set('targetLabel', e.target.value)} />}
              <DateField aria-label="Target date" value={f.launchOn} onChange={(e) => set('launchOn', e.target.value)} />
            </div>
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend>People</legend>
        {f.kind === 'plan' && <span className="pform-side">Nicobar</span>}
        <label className="f"><span>Project Owner</span>
          <Select value={f.ownerId} onChange={(v) => setF({ ...f, ownerId: v, leadId: f.leadId === v ? '' : f.leadId, members: f.members.filter((m) => m.personId !== v) })}>
            {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </label>
        <label className="same-lead">
          <input type="checkbox" checked={sameLead} onChange={(e) => {
            setSameLead(e.target.checked);
            // On: drop any separate lead. Off: start with none chosen, so the person picks on purpose.
            setF({ ...f, leadId: '' });
          }} />
          The owner is also the project lead
        </label>
        {!sameLead && (
          <label className="f"><span>Project Lead</span>
            <Select value={f.leadId} onChange={(v) => setF({ ...f, leadId: v, members: f.members.filter((m) => m.personId !== v) })}>
              <option value="" disabled>Pick a person</option>
              {people.filter((p) => p.id !== f.ownerId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </label>
        )}
        <span className="pform-sub">Other People</span>
        <p className="dim small pform-note">Only the people added here can own tasks in this project, and they will see it in their view.</p>
        {f.members.map((m, i) => (
          <div key={i} className="member-row">
            <Select value={m.personId} aria-label="Person" onChange={(v) => set('members', f.members.map((x, j) => (j === i ? { ...x, personId: v } : x)))}>
              <option value="">Pick a person</option>
              {people.filter((p) => p.id === m.personId || (!taken(p.id) && !f.members.some((x) => x.personId === p.id))).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
            <input value={m.role} maxLength={60} enterKeyHint="done" autoComplete="off" placeholder="Their role in this project, e.g. Sourcing, Design, etc." aria-label="Role on this project"
              onChange={(e) => set('members', f.members.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)))} />
            <button type="button" className="row-btn del" aria-label="Remove person" onClick={() => set('members', f.members.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        {free.length > 0 && <button type="button" className="mini-btn" onClick={() => set('members', [...f.members, { personId: '', role: '' }])}>+ Add person</button>}

        {f.viewers && (
          <>
            <span className="pform-sub">Can Also View</span>
            <p className="dim small pform-note">For people set to own projects only on the Roster. They see this project and its tasks, and own nothing in it.</p>
            {f.viewers.length > 0 && (
              <div className="chips-input">
                {f.viewers.map((v) => (
                  <span key={v} className="chip">{people.find((p) => p.id === v)?.name ?? v}<button type="button" aria-label={`Remove ${people.find((p) => p.id === v)?.name ?? v}`} onClick={() => set('viewers', f.viewers!.filter((x) => x !== v))}>×</button></span>
                ))}
              </div>
            )}
            {free.some((p) => !f.viewers!.includes(p.id)) && (
              <Select value="" aria-label="Add a viewer" onChange={(v) => v && set('viewers', [...f.viewers!, v])}>
                <option value="">+ Add a viewer</option>
                {free.filter((p) => !f.viewers!.includes(p.id)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            )}
          </>
        )}

        {f.kind === 'plan' && (
          <>
            <span className="pform-side">Partner</span>
            <label className="f"><span>Partner Name</span><input maxLength={80} enterKeyHint="next" autoComplete="off" value={f.partnerName} placeholder="e.g. Studio" onChange={(e) => set('partnerName', e.target.value)} /></label>
            <div className="f"><span>Their People</span><ChipsInput value={f.partnerPeople} onChange={(v) => set('partnerPeople', v)} placeholder="Names. Press Enter after each" /></div>
          </>
        )}
      </fieldset>

      <fieldset>
        <legend>Sub-Projects (optional)</legend>
        <ChipsInput value={f.workstreams} onChange={(v) => set('workstreams', v)} placeholder="e.g. Hampers, Packaging. Press Enter after each" />
      </fieldset>

      {err && <p className="err banner" role="alert">{err}</p>}
      {tried && why && <p className="err small pform-why" id="pform-why" role="alert">{why}</p>}
      <div className="row pform-actions">
        <button type="button" className="btn ghost" onClick={onDone}>Cancel</button>
        <button className="btn" disabled={busy} aria-describedby={tried && why ? 'pform-why' : undefined}>{editing ? 'Save project' : 'Start project'}</button>
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
