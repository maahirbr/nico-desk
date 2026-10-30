'use client';

import { useEffect, useRef, useState } from 'react';
import { addDays, fmtDate } from '@/lib/time';

// "Added since" on a project's task list (the PM's call, 30 Oct): a meeting's note-taker adds to-dos as it runs, and in
// its last minutes picks Today, or any day on the calendar, to read back what was added from 12 am India time that day.
// The button pops a small month calendar open; days after today cannot be picked. The value is a 'YYYY-MM-DD' day.

const CAL = <svg className="since-ico" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>;
const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Monday is 0. The date is read as a calendar day, so the browser's own zone never shifts it.
const weekday = (d: string) => (new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7;
export const sinceWords = (d: string, today: string) =>
  d === today ? 'today' : `${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][weekday(d)]} ${fmtDate(d)}`;
// "added today" or "added since Mon 5 Oct": the pill and the count line say it the same way.
export const addedWords = (d: string, today: string) => (d === today ? 'Added today' : `Added since ${sinceWords(d, today)}`);

export function AddedSince({ value, today, onChange }: { value: string | null; today: string; onChange: (d: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState((value ?? today).slice(0, 7)); // 'YYYY-MM' on show
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  const first = `${month}-01`;
  const shift = (n: number) => { const [y, m] = month.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); setMonth(d.toISOString().slice(0, 7)); };
  const inMonth: string[] = [];
  for (let d = first; d.startsWith(month); d = addDays(d, 1)) inMonth.push(d);
  const pick = (d: string | null) => { onChange(d); setOpen(false); };

  return (
    <div className="since" ref={box}>
      {value ? (
        <span className="pill since-on" aria-live="polite">
          <button type="button" className="since-open" aria-expanded={open} onClick={() => { setMonth(value.slice(0, 7)); setOpen(!open); }}>{CAL}{addedWords(value, today)}</button>
          <button type="button" className="since-x" aria-label="Clear added since" onClick={() => pick(null)}>✕</button>
        </span>
      ) : (
        <button type="button" className="pill" aria-expanded={open} onClick={() => { setMonth(today.slice(0, 7)); setOpen(!open); }}>{CAL}Added since…</button>
      )}
      {open && (
        <div className="since-pop" role="dialog" aria-label="Show tasks added since">
          <button type="button" className="btn ghost since-today" onClick={() => pick(today)}>Today</button>
          <div className="since-head">
            <button type="button" className="iconbtn" aria-label="Previous month" onClick={() => shift(-1)}>‹</button>
            <b>{MONTHS[Number(month.slice(5, 7)) - 1]} {month.slice(0, 4)}</b>
            <button type="button" className="iconbtn" aria-label="Next month" disabled={month >= today.slice(0, 7)} onClick={() => shift(1)}>›</button>
          </div>
          <div className="since-grid">
            {DAYS.map((d) => <span key={d} className="since-dow" aria-hidden>{d}</span>)}
            {Array.from({ length: weekday(first) }, (_, i) => <span key={`gap${i}`} />)}
            {inMonth.map((d) => (
              <button key={d} type="button" className="since-day" disabled={d > today} aria-pressed={d === value} data-today={d === today || undefined}
                aria-label={d === today ? 'Today' : `Since ${sinceWords(d, today)}`} onClick={() => pick(d)}>{Number(d.slice(8))}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
