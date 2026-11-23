'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { DateField } from './DateField';
import { Fold, FoldChev } from './Fold';
import { focusOnDesktop } from './motion';
import { Select } from './Select';
import { roleFor } from './OwnerPicker';
import { SHOW_SETUP_EVENT, setupKey } from './setupEvents';
import { api, Modal as ModalShell, type Opt } from './task-ui';
import { notify } from './toast';
import { composing, isRealEnter } from './ime';
import { PartnerTeamInput, type RosterOpt } from './PartnerTeam';

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
// Due Date and End Date replace Deadline (the PM's call, 2 Nov); a project saved as Deadline opens as Due Date.
const LABELS = ['Due Date', 'End Date', 'Launch', 'Event', 'Quarter end'];
const OTHER = 'Other…';
// The description's length limit. It matches the server's rule in lib/projectBody.ts.
const GOAL_MAX = 600;

// sortable (23 Nov, the PM's call): drag a chip onto another to put it there, for the order of sub-projects.
function ChipsInput({ value, onChange, placeholder, sortable = false }: { value: string[]; onChange: (v: string[]) => void; placeholder: string; sortable?: boolean }) {
  const [draft, setDraft] = useState('');
  const [dragged, setDragged] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const from = useRef<number | null>(null); // read on drop, so a quick drag never sees an old state
  const drop = (to: number) => {
    const at = from.current;
    if (at === null || at === to) return;
    const next = [...value];
    const [moved] = next.splice(at, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };
  const add = () => {
    const parts = draft.split(',').map((x) => x.trim()).filter(Boolean);
    if (parts.length) onChange([...new Set([...value, ...parts])]);
    setDraft('');
  };
  return (
    <div className="chips-input">
      {value.map((v, i) => (
        <span key={v} className={`chip${sortable ? ' chip-sort' : ''}${dragged === i ? ' dragging' : ''}${over === i && dragged !== null && dragged !== i ? ' drop-here' : ''}`}
          draggable={sortable} title={sortable ? 'Drag to change the order' : undefined}
          onDragStart={sortable ? (e) => { from.current = i; setDragged(i); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', v); } : undefined}
          onDragOver={sortable ? (e) => { e.preventDefault(); setOver(i); } : undefined}
          onDragLeave={sortable ? () => setOver((o) => (o === i ? null : o)) : undefined}
          onDrop={sortable ? (e) => { e.preventDefault(); drop(i); from.current = null; setDragged(null); setOver(null); } : undefined}
          onDragEnd={sortable ? () => { from.current = null; setDragged(null); setOver(null); } : undefined}>
          {sortable && value.length > 1 && <span className="chip-grip" aria-hidden>⋮⋮</span>}{v}
          <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(value.filter((x) => x !== v))}>×</button></span>
      ))}
      <input value={draft} enterKeyHint="done" autoComplete="off" placeholder={value.length ? 'Add another' : placeholder} onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (isRealEnter(e) || (e.key === ',' && !composing(e))) { e.preventDefault(); add(); } if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1)); }}
        onBlur={add} />
    </div>
  );
}

// access (15 Nov): full changes anything; people (one of the project's people) may only add people; view only reads.
// The parts someone may not change sit in disabled fieldsets, so they read the same but cannot be touched.
export function ProjectForm({ people, meId, initial, projectId, onDone, focus, access = 'full', roster = [], isAdmin = false }: {
  roster?: RosterOpt[]; isAdmin?: boolean; // the Roster, for the partner team (23 Nov)
  people: Opt[]; meId: string; initial?: ProjectValues; projectId?: string; onDone: () => void; access?: 'full' | 'people' | 'view';
  focus?: 'members' | 'partner'; // set when a setup step opened Settings: that part is brought into view
}) {
  const router = useRouter();
  const editing = !!projectId;
  const lock = access !== 'full';
  const firstN = initial?.members.length ?? 0; // the people already on it: in people access, these stay as they are
  // Brings back the setup check-list this person hid on this project (components/SetupList.tsx).
  const showSetup = () => {
    try { localStorage.removeItem(setupKey(meId, projectId!)); } catch { /* storage blocked: the list was never hidden */ }
    window.dispatchEvent(new Event(SHOW_SETUP_EVENT));
    notify('The setup list is back on the project page');
  };
  // A plain "Member" (the old default) opens as the person's Roster job title (18 Nov, the PM's call), still editable;
  // saving keeps it.
  const titled = (ms: ProjectValues['members']) => ms.map((m) => (m.role.trim() === 'Member' && people.find((p) => p.id === m.personId)?.role ? { ...m, role: people.find((p) => p.id === m.personId)!.role! } : m));
  const [f, setF] = useState<ProjectValues>(initial ? { ...initial, members: titled(initial.members), targetLabel: initial.targetLabel === 'Deadline' ? 'Due Date' : initial.targetLabel } : {
    name: '', kind: 'tasks', ownerId: meId, leadId: meId, goal: '', eyebrow: '', phase: '', launchOn: '', targetLabel: 'Due Date',
    workstreams: [], members: [], partnerName: '', partnerPeople: [], viewers: [],
  });
  // Partner: an old plan board, or a task board with a partner named (since 1 Nov, the PM's call). A new partner project is
  // a task board, the same as an internal one, plus the partner's name and people.
  const [partner, setPartner] = useState(f.kind === 'plan' || !!f.partnerName);
  // More options start folded (19 Nov, the PM's call). In Settings they open only when the project already uses one:
  // a viewer or a sub-project. A partner has its own section, so it does not open them.
  const [more, setMore] = useState(editing && ((f.viewers?.length ?? 0) > 0 || f.workstreams.length > 0));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // A setup step opens the form at its own part. This runs once on open, so typing later never scrolls the form.
  // focusOnDesktop keeps the phone keyboard shut: on a phone the part only scrolls into view. The focus waits a frame:
  // the scroll's own event fires in that frame, and KeyboardDismiss would blur a text field focused before it.
  const peopleRef = useRef<HTMLSpanElement>(null);
  const partnerRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = focus === 'members' ? peopleRef.current : focus === 'partner' ? partnerRef.current : null;
    if (!el) return;
    el.scrollIntoView({ block: 'center' });
    const raf = requestAnimationFrame(() => focusOnDesktop(focus === 'members' ? (el.parentElement?.querySelector<HTMLElement>('.member-add') ?? null) : el));
    return () => cancelAnimationFrame(raf);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- once, on open
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
    : partner && !f.partnerName.trim() ? 'Give the partner a name.'
    : null;

  return (
    <form className="pform" onSubmit={async (e) => {
      e.preventDefault();
      if (access === 'view') { onDone(); return; }
      if (access === 'people') {
        const added = f.members.slice(firstN).filter((m) => m.personId);
        if (!added.length) { onDone(); return; }
        setBusy(true); setErr(null);
        try { await api(`/projects/${projectId}/people`, 'POST', { members: added }); notify(added.length === 1 ? 'Person added' : `${added.length} people added`); onDone(); router.refresh(); }
        catch (er) { setErr((er as Error).message); } finally { setBusy(false); }
        return;
      }
      if (why) { setTried(true); return; }
      setBusy(true); setErr(null);
      const body = {
        name: f.name, kind: f.kind, ownerId: f.ownerId, leadId, goal: f.goal, eyebrow: f.eyebrow, phase: f.phase, launchOn: f.launchOn || null,
        targetLabel: f.targetLabel, workstreams: f.workstreams, members: f.members.filter((m) => m.personId),
        ...(partner ? { partnerName: f.partnerName, partnerPeople: f.partnerPeople } : f.kind === 'tasks' && editing ? { partnerName: '', partnerPeople: [] } : {}),
        ...(f.viewers ? { viewers: f.viewers.filter((v) => !taken(v) && !f.members.some((m) => m.personId === v)) } : {}),
      };
      try {
        const p = await api(editing ? `/projects/${projectId}` : '/projects', editing ? 'PATCH' : 'POST', body);
        notify(editing ? 'Project saved' : 'Project started');
        onDone();
        if (editing) router.refresh(); else { router.push(`/projects/${p.id}`); router.refresh(); }
      } catch (er) { setErr((er as Error).message); } finally { setBusy(false); }
    }}>
      {/* Basics, People, Partner (on a partner project), then More options folded (the PM's layout, 2 Nov). */}
      {lock && <p className="small dim pform-lock">{access === 'people' ? 'You can add people. The owner, lead or an admin changes the rest.' : 'Only the owner, lead or an admin can change these.'}</p>}
      <fieldset className="pform-group" disabled={lock}>
        <label className="f"><span>Project Name <span className="req" aria-hidden="true">*</span></span><input ref={focus ? undefined : focusOnDesktop} maxLength={80} aria-invalid={tried && f.name.trim().length < 2 ? true : undefined} enterKeyHint="next" autoComplete="off" value={f.name} onChange={(e) => set('name', e.target.value)} /></label>
        {!editing && (
          <div className="kind-pick" role="radiogroup" aria-label="Kind of project">
            <button type="button" role="radio" aria-checked={!partner} onClick={() => setPartner(false)}>
              <b>Internal</b><span>A task board the Nico Tribe runs.</span>
            </button>
            <button type="button" role="radio" aria-checked={partner} onClick={() => setPartner(true)}>
              <b>Partner / Collaboration</b><span>The same task board, shared with an outside partner, like a brand collab or a consultant.</span>
            </button>
          </div>
        )}
        <label className="f"><span>Project Description</span>
          <input maxLength={GOAL_MAX} enterKeyHint="next" autoComplete="off" value={f.goal} onChange={(e) => set('goal', e.target.value)} />
        </label>
        <label className="f"><span>Category</span><input maxLength={120} enterKeyHint="next" autoComplete="off" value={f.eyebrow} placeholder="e.g. House & Home" onChange={(e) => set('eyebrow', e.target.value)} /></label>
        <div className="row pform-date">
          <label className="f pform-date-type"><span>Date Type</span>
            <Select value={otherLabel ? OTHER : f.targetLabel} onChange={(v) => { setOtherLabel(v === OTHER); set('targetLabel', v === OTHER ? '' : v); }}>
              {[...LABELS, OTHER].map((l) => <option key={l}>{l}</option>)}
            </Select>
          </label>
          {otherLabel && <label className="f pform-date-type"><span>Your Label</span><input maxLength={40} enterKeyHint="done" autoComplete="off" placeholder="e.g. Delivery" value={f.targetLabel} onChange={(e) => set('targetLabel', e.target.value)} /></label>}
          <label className="f"><span>{f.targetLabel.trim() || 'Date'}</span><DateField noQuick value={f.launchOn} onChange={(e) => set('launchOn', e.target.value)} /></label>
        </div>
      </fieldset>

      <fieldset className="pform-group">
        <legend>People</legend>
        {partner && <span className="pform-side">Nicobar</span>}
        <fieldset className="pform-plain" disabled={lock}>
        <label className="f"><span>Project Owner <span className="req" aria-hidden="true">*</span></span>
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
          <label className="f"><span>Project Lead <span className="req" aria-hidden="true">*</span></span>
            <Select value={f.leadId} onChange={(v) => setF({ ...f, leadId: v, members: f.members.filter((m) => m.personId !== v) })}>
              <option value="" disabled>Pick a person</option>
              {people.filter((p) => p.id !== f.ownerId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </label>
        )}
        </fieldset>
        <span className="pform-sub" ref={peopleRef}>Team Members</span>
        <p className="dim small pform-note">Only people added here can own tasks in this project.</p>
        {f.members.map((m, i) => (
          <fieldset key={i} className="pform-plain" disabled={access === 'view' || (lock && i < firstN)}>
          <div className="member-row">
            {/* Picking someone fills their role with their Roster job title (17 Nov), unless a role was typed; it can be changed. */}
            <Select value={m.personId} aria-label="Person" onChange={(v) => set('members', f.members.map((x, j) => (j === i ? { ...x, personId: v, role: roleFor(people, x.role, x.personId, v) } : x)))}>
              <option value="">Pick a person</option>
              {people.filter((p) => p.id === m.personId || (!taken(p.id) && !f.members.some((x) => x.personId === p.id))).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
            <input value={m.role} maxLength={60} enterKeyHint="done" autoComplete="off" placeholder={i === 0 ? 'Their role in this project, e.g. Sourcing, Design, etc.' : undefined} aria-label="Role on this project"
              onChange={(e) => set('members', f.members.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)))} />
            {!(lock && i < firstN) && <button type="button" className="row-btn del" aria-label="Remove person" onClick={() => set('members', f.members.filter((_, j) => j !== i))}>✕</button>}
          </div>
          </fieldset>
        ))}
        {access !== 'view' && free.length > 0 && <button type="button" className="mini-btn member-add" onClick={() => set('members', [...f.members, { personId: '', role: '' }])}>+ Add person</button>}
      </fieldset>

      {partner && (
        <fieldset className="pform-group" disabled={lock}>
          <legend>Partner</legend>
          <label className="f"><span>Partner Name <span className="req" aria-hidden="true">*</span></span><input ref={partnerRef} maxLength={80} enterKeyHint="next" autoComplete="off" value={f.partnerName} placeholder="e.g. TheCRUX" onChange={(e) => set('partnerName', e.target.value)} /></label>
          <div className="f"><span>Partner Team</span><PartnerTeamInput value={f.partnerPeople} onChange={(v) => set('partnerPeople', v)} roster={roster} company={f.partnerName} isAdmin={isAdmin} /></div>
        </fieldset>
      )}

      <div className="pform-more">
        <button type="button" className="log-toggle small-toggle" aria-expanded={more} onClick={() => setMore(!more)}><FoldChev /> More options</button>
        <Fold open={more} scroll={false}>
          <fieldset className="pform-more-in pform-plain" disabled={lock}>
            {f.viewers && (
              <div className="f">
                <span>Viewer</span>
                <p className="dim small pform-note">They can see this project and its tasks, but not own any.</p>
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
              </div>
            )}
            <div className="f"><span>Sub-Projects</span><ChipsInput sortable value={f.workstreams} onChange={(v) => set('workstreams', v)} placeholder="e.g. Design, Sourcing, Marketing, Launch. Press Enter after each" /></div>
            {/* A task board can take a partner after it is made, or drop one (19 Nov, the PM's call). Adding one opens the same
                Partner section a new partner project has; nothing changes until Save. An old plan board keeps its partner. */}
            {editing && !lock && f.kind === 'tasks' && (
              <div className="f"><span>Partner</span>
                {partner
                  ? <button type="button" className="mini-btn pform-partner-btn" onClick={() => setPartner(false)}>Make it internal again</button>
                  : <button type="button" className="mini-btn pform-partner-btn" onClick={() => { setPartner(true); setTimeout(() => { partnerRef.current?.scrollIntoView({ block: 'center' }); partnerRef.current?.focus(); }, 0); }}>+ Add a partner</button>}
              </div>
            )}
          </fieldset>
        </Fold>
      </div>

      {err && <p className="err banner" role="alert">{err}</p>}
      {tried && why && <p className="err small pform-why" id="pform-why" role="alert">{why}</p>}
      <div className="row pform-actions">
        {editing && !lock && <button type="button" className="act pform-setup" onClick={showSetup}>Show the setup list</button>}
        {access === 'view' ? <button type="button" className="btn" onClick={onDone}>Close</button> : (<>
        <button type="button" className="btn ghost" onClick={onDone}>Cancel</button>
        <button className="btn" disabled={busy} aria-describedby={tried && why && !lock ? 'pform-why' : undefined}>{access === 'people' ? 'Add people' : editing ? 'Save project' : 'Start project'}</button>
        </>)}
      </div>
    </form>
  );
}

export function NewProjectButton({ people, meId, roster = [], isAdmin = false }: { people: Opt[]; meId: string; roster?: RosterOpt[]; isAdmin?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn" onClick={() => setOpen(true)}>+ New project</button>
      {open && (
        <ModalShell title="Start a Project" onClose={() => setOpen(false)} wide>
          <ProjectForm people={people} meId={meId} roster={roster} isAdmin={isAdmin} onDone={() => setOpen(false)} />
        </ModalShell>
      )}
    </>
  );
}
