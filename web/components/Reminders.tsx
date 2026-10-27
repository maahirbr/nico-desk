'use client';

import { useState } from 'react';
import type { ReminderDraft } from '@/lib/reminders';
import { bodyFor, subjectFor } from '@/lib/reminderText';
import { fmtDate } from '@/lib/time';
import { Avatar, PersonLink } from './chips';
import { Help } from './HelpMode';
import { useReadOnly } from './readonly';
import { EmptyMark, ICON } from './icons';
import { CheckTick } from './task-ui';

// Each draft opens in the lead's own Gmail (or mail app) with the text filled in. The lead
// reads it and presses Send there; this page only records that a reminder went out.
// Each item has a tick box. An item the app thinks may not be needed starts unticked, with the reason beside it.
// Ticking an item in or out rebuilds the subject and the text, so a hand edit is replaced.

function ago(iso: string | null): string {
  if (!iso) return '';
  const n = Math.floor((Date.now() - Date.parse(iso)) / 86400000);
  return n <= 0 ? 'reminded today' : n === 1 ? 'reminded yesterday' : `reminded ${n} days ago`;
}

async function record(personId: string, channel: string, subject: string, itemKeys: string[]) {
  await fetch('/api/v1/reminders', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ personId, channel, subject, itemCount: itemKeys.length, itemKeys }),
  }).catch(() => {});
}

function Card({ d, appUrl }: { d: ReminderDraft; appUrl: string }) {
  const [on, setOn] = useState(() => new Set(d.items.filter((i) => !i.flag).map((i) => i.key)));
  const [subject, setSubject] = useState(d.subject);
  const [body, setBody] = useState(d.body);
  const [to, setTo] = useState(d.to ?? '');
  const [last, setLast] = useState(d.lastAt);
  const [said, setSaid] = useState('');
  const readOnly = useReadOnly(); // an admin viewing as the lead sees the drafts but cannot open or log them
  const mark = (channel: string) => { record(d.personId, channel, subject, [...on]); setLast(new Date().toISOString()); };
  const tick = (key: string, yes: boolean) => {
    const next = new Set(on);
    if (yes) next.add(key); else next.delete(key);
    const picked = d.items.filter((i) => next.has(i.key));
    setOn(next); setSubject(subjectFor(picked)); setBody(bodyFor(d.name, picked, appUrl)); setSaid('');
  };
  const none = on.size === 0;
  const can = !!to && !none;
  const gmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const over = d.items.filter((i) => i.days < 0).length;
  const out = d.items.length - on.size;
  return (
    <section className="card remind-card" id={`remind-${d.personId}`}>
      <div className="remind-head">
        <span className="person-cell"><Avatar id={d.personId} name={d.name} lg /><span><PersonLink id={d.personId}><b>{d.name}</b></PersonLink>
          <span className="small dim"> · {d.items.length} {d.items.length === 1 ? 'item' : 'items'}{over ? `, ${over} overdue` : ''}{out ? ` · ${out} left out` : ''}{last ? ` · ${ago(last)}` : ''}</span></span></span>
      </div>
      <ul className="remind-items" aria-label={`Items in the reminder to ${d.name}`}>
        {d.items.map((i) => (
          <li key={i.key} className={on.has(i.key) ? '' : 'out'}>
            <span className="trow-check"><input type="checkbox" checked={on.has(i.key)} disabled={readOnly} aria-label={`Include “${i.title}”`}
              onChange={(e) => tick(i.key, e.target.checked)} /><CheckTick /></span>
            <span className="remind-item-text"><span>{i.title}</span>
              <span className="small dim"> · {i.where} · {i.days < 0 ? `was due ${fmtDate(i.dueOn)}` : `due ${fmtDate(i.dueOn)}`}</span>
              {i.flag && <Help term="remind_flag"><span className="small remind-flag">{i.flag}</span></Help>}</span>
          </li>
        ))}
      </ul>
      <label className="f"><span>To</span><input type="email" value={to} readOnly={readOnly} placeholder="No email on file. Add one, or copy the text instead" onChange={(e) => setTo(e.target.value)} /></label>
      <label className="f"><span>Subject</span><input value={subject} readOnly={readOnly} maxLength={200} onChange={(e) => setSubject(e.target.value)} /></label>
      <label className="f"><span>Email</span><textarea readOnly={readOnly} rows={Math.min(16, 6 + d.items.length * 2)} value={body} onChange={(e) => setBody(e.target.value)} /></label>
      {!readOnly && <div className="row remind-actions">
        <Help term="remind_gmail" host><a className={`btn${can ? '' : ' disabled'}`} href={can ? gmail : undefined} target="_blank" rel="noopener noreferrer" aria-disabled={!can}
          onClick={(e) => { if (!can) { e.preventDefault(); return; } mark('gmail'); setSaid('Opened in Gmail. Check it and press Send there.'); }}>Open in Gmail</a></Help>
        <Help term="remind_mail" host><a className={`btn ghost${can ? '' : ' disabled'}`} href={can ? mailto : undefined} aria-disabled={!can}
          onClick={(e) => { if (!can) { e.preventDefault(); return; } mark('mail_app'); setSaid('Opened in your mail app.'); }}>Mail app</a></Help>
        <Help term="remind_copy" host><button className="btn ghost" disabled={none} onClick={async () => {
          try { await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`); mark('copy'); setSaid('Copied. Paste it into an email or chat.'); }
          catch { setSaid('Could not copy. Select the text and copy it.'); }
        }}>Copy</button></Help>
        {none ? <span className="small dim">Tick at least one item to send this reminder.</span> : said && <span className="small dim">{said}</span>}
      </div>}
    </section>
  );
}

// A search box over the drafts, so a lead can find one person's reminder quickly (the PM's call, 14 Oct).
export function ReminderCards({ drafts, appUrl }: { drafts: ReminderDraft[]; appUrl: string }) {
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const shown = needle ? drafts.filter((d) => d.name.toLowerCase().includes(needle)) : drafts;
  return (
    <>
      {drafts.length > 1 && (
        <input className="find-person remind-find" type="search" value={q} placeholder="Find a person" aria-label="Find a person by name"
          onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') setQ(''); }} />
      )}
      {shown.length === 0
        ? <div className="empty-state"><EmptyMark d={ICON['/search']} /><p>No one matches &ldquo;{q.trim()}&rdquo;.</p><button className="btn ghost" onClick={() => setQ('')}>Clear search</button></div>
        : <div className="remind-list">{shown.map((d) => <Card key={d.personId} d={d} appUrl={appUrl} />)}</div>}
    </>
  );
}
