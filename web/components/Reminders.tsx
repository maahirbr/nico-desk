'use client';

import { useState } from 'react';
import type { ReminderDraft } from '@/lib/reminders';
import { Avatar } from './chips';

// Each draft opens in the lead's own Gmail (or mail app) with the text filled in. The lead
// reads it and presses Send there; this page only records that a reminder went out.

function ago(iso: string | null): string {
  if (!iso) return '';
  const n = Math.floor((Date.now() - Date.parse(iso)) / 86400000);
  return n <= 0 ? 'reminded today' : n === 1 ? 'reminded yesterday' : `reminded ${n} days ago`;
}

async function record(personId: string, channel: string, subject: string, itemCount: number) {
  await fetch('/api/v1/reminders', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ personId, channel, subject, itemCount }),
  }).catch(() => {});
}

function Card({ d }: { d: ReminderDraft }) {
  const [subject, setSubject] = useState(d.subject);
  const [body, setBody] = useState(d.body);
  const [to, setTo] = useState(d.to ?? '');
  const [last, setLast] = useState(d.lastAt);
  const [said, setSaid] = useState('');
  const mark = (channel: string) => { record(d.personId, channel, subject, d.items.length); setLast(new Date().toISOString()); };
  const gmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const over = d.items.filter((i) => i.days < 0).length;
  return (
    <section className="card remind-card">
      <div className="remind-head">
        <span className="person-cell"><Avatar name={d.name} lg /><span><b>{d.name}</b>
          <span className="small dim"> · {d.items.length} {d.items.length === 1 ? 'item' : 'items'}{over ? `, ${over} overdue` : ''}{last ? ` · ${ago(last)}` : ''}</span></span></span>
      </div>
      <label className="f"><span>To</span><input type="email" value={to} placeholder="No email on file. Add one, or copy the text instead" onChange={(e) => setTo(e.target.value)} /></label>
      <label className="f"><span>Subject</span><input value={subject} maxLength={200} onChange={(e) => setSubject(e.target.value)} /></label>
      <label className="f"><span>Email</span><textarea rows={Math.min(16, 6 + d.items.length * 2)} value={body} onChange={(e) => setBody(e.target.value)} /></label>
      <div className="row remind-actions">
        <a className={`btn${to ? '' : ' disabled'}`} href={to ? gmail : undefined} target="_blank" rel="noopener noreferrer" aria-disabled={!to}
          onClick={(e) => { if (!to) { e.preventDefault(); return; } mark('gmail'); setSaid('Opened in Gmail. Check it and press Send there.'); }}>Open in Gmail</a>
        <a className={`btn ghost${to ? '' : ' disabled'}`} href={to ? mailto : undefined} aria-disabled={!to}
          onClick={(e) => { if (!to) { e.preventDefault(); return; } mark('mail_app'); setSaid('Opened in your mail app.'); }}>Mail app</a>
        <button className="btn ghost" onClick={async () => {
          try { await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`); mark('copy'); setSaid('Copied. Paste it into an email or chat.'); }
          catch { setSaid('Could not copy. Select the text and copy it.'); }
        }}>Copy</button>
        {said && <span className="small dim">{said}</span>}
      </div>
    </section>
  );
}

export function ReminderCards({ drafts }: { drafts: ReminderDraft[] }) {
  return <div className="remind-list">{drafts.map((d) => <Card key={d.personId} d={d} />)}</div>;
}
