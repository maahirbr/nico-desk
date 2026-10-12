'use client';

import { createContext, useContext, useState } from 'react';

// Each project's people by id, loaded once in the layout. A task in a project can only go to its people;
// "+ Add someone to this project" brings someone new in, with their role, as the task is assigned.

const ProjectPeople = createContext<Record<string, string[]>>({});

export function ProjectPeopleProvider({ value, children }: { value: Record<string, string[]>; children: React.ReactNode }) {
  return <ProjectPeople.Provider value={value}>{children}</ProjectPeople.Provider>;
}

type Opt = { id: string; name: string };
const ADD = '__add';

// onChange gets the owner, and a role when that person is joining the project (empty until typed).
export function OwnerPicker({ projectId, value, onChange, people, disabled = false }: {
  projectId?: string | null; value: string; onChange: (ownerId: string, role?: string) => void; people: Opt[]; disabled?: boolean;
}) {
  const map = useContext(ProjectPeople);
  const members = projectId ? map[projectId] ?? [] : null;
  const [adding, setAdding] = useState(false);
  const [pick, setPick] = useState('');
  const [role, setRole] = useState('');
  const [before, setBefore] = useState(value);

  if (!members) {
    return <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>;
  }
  const inProject = people.filter((p) => members.includes(p.id) || p.id === value && !adding);
  const others = people.filter((p) => !members.includes(p.id));

  if (adding) {
    return (
      <div className="owner-add">
        <select value={pick} aria-label="Person to add to the project" onChange={(e) => { setPick(e.target.value); onChange(e.target.value, role); }}>
          <option value="" disabled>Choose a person</option>
          {others.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input value={role} maxLength={60} placeholder="Their role, e.g. Packaging" aria-label="Their role on this project"
          onChange={(e) => { setRole(e.target.value); if (pick) onChange(pick, e.target.value); }} />
        <button type="button" className="act" onClick={() => { setAdding(false); setPick(''); setRole(''); onChange(before); }}>Cancel</button>
      </div>
    );
  }
  return (
    <select value={value} disabled={disabled} onChange={(e) => {
      if (e.target.value === ADD) { setBefore(value); setAdding(true); onChange('', ''); return; }
      onChange(e.target.value);
    }}>
      {!inProject.some((p) => p.id === value) && <option value="" disabled>Choose a person</option>}
      {inProject.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      {others.length > 0 && <option value={ADD}>+ Add someone to this project</option>}
    </select>
  );
}

// The fields to send with a task: the owner, plus their role only when they are joining the project.
export const ownerFields = (ownerId: string, role: string | undefined) => (role !== undefined ? { ownerId, ownerRole: role } : { ownerId });
// Ready to send: someone is chosen, and a person joining the project has a role.
export const ownerReady = (ownerId: string, role: string | undefined) => !!ownerId && (role === undefined || role.trim().length >= 2);
export const useProjectPeople = () => useContext(ProjectPeople);
