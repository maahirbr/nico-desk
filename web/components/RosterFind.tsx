'use client';

import { useEffect, useState } from 'react';
import { Select } from './Select';

// Find someone on the Roster (14 Nov): filters the table's rows as you type, by name, nickname, job title, department
// or email (each row's data-find). Escape clears it. An admin can also show one access at a time (17 Nov, the PM's
// call; a dropdown since 17 Nov): All, Admin, Leadership or Member (each row's data-role). Only hides rows on this page; nothing is fetched.
type Role = '' | 'admin' | 'leadership' | 'member' | 'partner';
const ROLES: { key: Role; word: string }[] = [{ key: '', word: 'All' }, { key: 'admin', word: 'Admin' }, { key: 'leadership', word: 'Leadership' }, { key: 'member', word: 'Member' }, { key: 'partner', word: 'Partner' }];

export function RosterFind({ total, roles = false }: { total: number; roles?: boolean }) {
  const [q, setQ] = useState('');
  const [role, setRole] = useState<Role>('');
  const [shown, setShown] = useState(total);
  useEffect(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let n = 0;
    document.querySelectorAll<HTMLTableRowElement>('table.roster tbody tr[data-find]').forEach((tr) => {
      const hit = words.every((w) => (tr.dataset.find ?? '').includes(w)) && (!role || tr.dataset.role === role);
      tr.hidden = !hit;
      if (hit) n++;
    });
    setShown(n);
  }, [q, role]);
  const filtering = !!q.trim() || !!role;
  return (
    <div className="roster-find">
      {roles && (
        <span className="roster-roles">
          <Select value={role} aria-label="Show access" onChange={(v) => setRole(v as Role)}>
            {ROLES.map((r) => <option key={r.word} value={r.key}>{r.word}</option>)}
          </Select>
        </span>
      )}
      <input className="find-person" type="search" value={q} placeholder="Find a person" aria-label="Find a person by name, job title, department or email"
        onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') setQ(''); }} />
      {filtering && <span className="small dim" role="status">{shown === 0 ? <>No one matches. <button type="button" className="linkbtn" onClick={() => { setQ(''); setRole(''); }}>Clear</button></> : `${shown} of ${total}`}</span>}
    </div>
  );
}
