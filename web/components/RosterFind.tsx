'use client';

import { useEffect, useState } from 'react';

// Find someone on the Roster (14 Nov): filters the table's rows as you type, by name, nickname, job title, department
// or email (each row's data-find). Escape clears it. Only hides rows on this page; nothing is fetched.
export function RosterFind({ total }: { total: number }) {
  const [q, setQ] = useState('');
  const [shown, setShown] = useState(total);
  useEffect(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let n = 0;
    document.querySelectorAll<HTMLTableRowElement>('table.roster tbody tr[data-find]').forEach((tr) => {
      const hit = words.every((w) => (tr.dataset.find ?? '').includes(w));
      tr.hidden = !hit;
      if (hit) n++;
    });
    setShown(n);
  }, [q]);
  return (
    <div className="roster-find">
      <input className="find-person" type="search" value={q} placeholder="Find a person" aria-label="Find a person by name, job title, department or email"
        onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') setQ(''); }} />
      {q.trim() && <span className="small dim" role="status">{shown === 0 ? <>No one matches “{q.trim()}”. <button type="button" className="linkbtn" onClick={() => setQ('')}>Clear</button></> : `${shown} of ${total}`}</span>}
    </div>
  );
}
