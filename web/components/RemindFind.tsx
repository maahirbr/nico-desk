'use client';

import { useEffect, useState } from 'react';
import { isRealEnter } from './ime';

// Find a person's reminder (moved 15 Nov to the right end of the filter bar, the PM's pick): hides the other cards as you
// type. Unlike the filters to its left it needs no Apply, and Enter does not send the form. Nothing is fetched.
export function RemindFind() {
  const [q, setQ] = useState('');
  const [none, setNone] = useState(false);
  useEffect(() => {
    const needle = q.trim().toLowerCase();
    let n = 0;
    document.querySelectorAll<HTMLElement>('.remind-card[data-find]').forEach((el) => {
      const hit = !needle || (el.dataset.find ?? '').includes(needle);
      el.hidden = !hit;
      if (hit) n++;
    });
    setNone(!!needle && n === 0);
  }, [q]);
  return (
    <span className="remind-find">
      <input className="find-person" type="search" value={q} placeholder="Find a person" aria-label="Find a person by name"
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => { if (isRealEnter(e)) e.preventDefault(); if (e.key === 'Escape') setQ(''); }} />
      {none && <span className="small dim" role="status">No one matches. <button type="button" className="linkbtn" onClick={() => setQ('')}>Clear</button></span>}
    </span>
  );
}
