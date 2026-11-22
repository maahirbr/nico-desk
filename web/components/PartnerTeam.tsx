'use client';

import Link from 'next/link';
import { useState } from 'react';
import { composing, isRealEnter } from './ime';

// The partner team (23 Nov, the PM's call). Typing shows people from the Roster, the partner's own company first; picking
// one links them: they join the project on Save, so they see it when they sign in, and tasks given to them are theirs. A
// name typed for someone not on the Roster stays, marked "Not on the Roster", with an Add to Roster shortcut for admins.
// Linking itself happens on the server (lib/service.ts linkPartnerTeam), by the same rule: one Roster person by that name.
export type RosterOpt = { id: string; name: string; full: string; dept: string; partner: boolean };

const key = (s: string) => s.trim().toLowerCase();
export function rosterHit(roster: RosterOpt[], name: string): RosterOpt | null {
  const hits = roster.filter((r) => key(r.full) === key(name) || key(r.name) === key(name));
  return hits.length === 1 ? hits[0] : null;
}

export function PartnerTeamInput({ value, onChange, roster, company, isAdmin }: {
  value: string[]; onChange: (v: string[]) => void; roster: RosterOpt[]; company: string; isAdmin: boolean;
}) {
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState(false);
  const firm = key(company);
  const q = key(draft);
  const taken = new Set(value.map(key));
  const rank = (r: RosterOpt) => (r.partner && firm && key(r.dept) === firm ? 0 : r.partner ? 1 : 2);
  const shown = q.length < 1 ? [] : roster
    .filter((r) => !taken.has(key(r.full)) && (key(r.full).includes(q) || key(r.name).includes(q)))
    .sort((a, b) => rank(a) - rank(b) || a.full.localeCompare(b.full)).slice(0, 6);
  const add = (names: string[]) => {
    const fresh = names.map((x) => x.trim()).filter((x) => x && !taken.has(key(x)));
    if (fresh.length) onChange([...value, ...fresh]);
    setDraft(''); setOpen(false);
  };
  return (
    <div className="ptm">
      <div className="ptm-box">
      <div className="chips-input">
        {value.map((v) => {
          const hit = rosterHit(roster, v);
          return (
            <span key={v} className={`chip${hit ? ' chip-linked' : ' chip-loose'}`} title={hit ? `On the Roster: ${hit.full} sees this project once they sign in.` : 'Not on the Roster: add them there so they can sign in and see this project.'}>
              {hit && <span className="chip-tick" aria-hidden>✓</span>}{v}
              <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(value.filter((x) => x !== v))}>×</button>
            </span>
          );
        })}
        <input value={draft} enterKeyHint="done" autoComplete="off" role="combobox" aria-expanded={open && shown.length > 0} aria-autocomplete="list"
          placeholder={value.length ? 'Add another' : 'Type a name. People on the Roster show up'}
          onChange={(e) => { setDraft(e.target.value); setOpen(true); }}
          onKeyDown={(e) => {
            if (isRealEnter(e) || (e.key === ',' && !composing(e))) { e.preventDefault(); add(shown.length === 1 && e.key !== ',' ? [shown[0].full] : draft.split(',')); }
            if (e.key === 'Escape') setOpen(false);
            if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={() => setTimeout(() => { if (draft.trim()) add(draft.split(',')); setOpen(false); }, 150)} />
      </div>
      {open && shown.length > 0 && (
        <div className="ptm-list" role="listbox" aria-label="People on the Roster">
          {shown.map((r) => (
            <button key={r.id} type="button" role="option" aria-selected={false} className="ptm-opt" onMouseDown={(e) => e.preventDefault()} onClick={() => add([r.full])}>
              <b>{r.full}</b><span className="dim small">{[r.partner ? 'Partner' : '', r.dept].filter(Boolean).join(' · ')}</span>
            </button>
          ))}
        </div>
      )}
      </div>
      {value.some((v) => !rosterHit(roster, v)) && (
        <p className="small dim ptm-hint">
          Not on the Roster: {value.filter((v) => !rosterHit(roster, v)).map((v, i) => (
            <span key={v}>{i > 0 && ', '}{v}{isAdmin && <> (<Link className="rlink" href={`/admin?add=${encodeURIComponent(v)}&company=${encodeURIComponent(company)}`} target="_blank">Add to Roster</Link>)</>}</span>
          ))}. They need to be on the Roster to sign in and see this project.
        </p>
      )}
    </div>
  );
}
