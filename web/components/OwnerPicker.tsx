'use client';

import { createContext, useContext, useState } from 'react';
import { Select } from './Select';

// Each project's people by id, loaded once in the layout. A task in a project can only go to its people;
// "+ Add someone to this project" brings someone new in, with their role, as the task is assigned. Only the
// project owner, a lead or an admin sees it (mayAddTo), the same rule joinProject enforces in lib/service.ts.

const ProjectPeople = createContext<Record<string, string[]>>({});
const MayAddTo = createContext<string[]>([]);

export function ProjectPeopleProvider({ value, mayAddTo, children }: { value: Record<string, string[]>; mayAddTo: string[]; children: React.ReactNode }) {
  return <ProjectPeople.Provider value={value}><MayAddTo.Provider value={mayAddTo}>{children}</MayAddTo.Provider></ProjectPeople.Provider>;
}

type Opt = { id: string; name: string };
const ADD = '__add';

// onChange gets the owner, and a role when that person is joining the project (empty until typed).
export function OwnerPicker({ projectId, value, onChange, people, disabled = false }: {
  projectId?: string | null; value: string; onChange: (ownerId: string, role?: string) => void; people: Opt[]; disabled?: boolean;
}) {
  const map = useContext(ProjectPeople);
  const mayAdd = useContext(MayAddTo).includes(projectId ?? '');
  const members = projectId ? map[projectId] ?? [] : null;
  const [adding, setAdding] = useState(false);
  const [pick, setPick] = useState('');
  const [role, setRole] = useState('');
  const [before, setBefore] = useState(value);

  if (!members) {
    return <Select value={value} disabled={disabled} onChange={(v) => onChange(v)}>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>;
  }
  const inProject = people.filter((p) => members.includes(p.id) || p.id === value && !adding);
  const others = mayAdd ? people.filter((p) => !members.includes(p.id)) : [];

  if (adding) {
    return (
      <div className="owner-add">
        <Select value={pick} aria-label="Person to add to the project" onChange={(v) => { setPick(v); onChange(v, role); }}>
          <option value="" disabled>Choose a person</option>
          {others.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
        <input value={role} maxLength={60} placeholder="Their role, e.g. Packaging" aria-label="Their role on this project"
          onChange={(e) => { setRole(e.target.value); if (pick) onChange(pick, e.target.value); }} />
        <button type="button" className="act" onClick={() => { setAdding(false); setPick(''); setRole(''); onChange(before); }}>Cancel</button>
      </div>
    );
  }
  return (
    <Select value={value} disabled={disabled} onChange={(v) => {
      if (v === ADD) { setBefore(value); setAdding(true); onChange('', ''); return; }
      onChange(v);
    }}>
      {!inProject.some((p) => p.id === value) && <option value="" disabled>Choose a person</option>}
      {inProject.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      {others.length > 0 && <option value={ADD}>+ Add someone to this project</option>}
    </Select>
  );
}

// The fields to send with a task: the owner, plus their role only when they are joining the project.
export const ownerFields = (ownerId: string, role: string | undefined) => (role !== undefined ? { ownerId, ownerRole: role } : { ownerId });
// Ready to send: someone is chosen, and a person joining the project has a role.
export const ownerReady = (ownerId: string, role: string | undefined) => !!ownerId && (role === undefined || role.trim().length >= 2);
export const useProjectPeople = () => useContext(ProjectPeople);
