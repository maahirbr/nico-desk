'use client';

import { useState } from 'react';
import type { ReminderDraft } from '@/lib/reminders';
import { bodyFor, subjectFor } from '@/lib/reminderText';
import { fmtDate } from '@/lib/time';
import { Avatar, PersonLink } from './chips';
import { Help } from './HelpMode';
import { useReadOnly } from './readonly';
import { EmptyMark, ICON } from './icons';
import { RichText, textToHtml } from './RichText';
import { CheckTick } from './task-ui';

// Each draft opens in the lead's own Gmail (or mail app) with the text filled in, or, when the lead has connected
// Gmail (lib/gmailSend.ts), goes out from here when they press Send. Either way the lead presses Send.
// Formatting only travels with Send: a Gmail or mail-app draft link carries plain text.
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

export type SendState = { enabled: boolean; connected: boolean; from: string };

const list = (s: string) => s.split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean);

async function connectGmail(setSaid: (s: string) => void) {
  const res = await fetch('/api/v1/connections/gmail', { method: 'POST' }).catch(() => null);
  const j = res?.ok ? ((await res.json().catch(() => null)) as { url?: string } | null) : null;
  if (j?.url) window.location.assign(j.url); else setSaid('Could not reach Google. Try again in a moment.');
}

function Card({ d, appUrl, send }: { d: ReminderDraft; appUrl: string; send: SendState }) {
  const [on, setOn] = useState(() => new Set(d.items.filter((i) => !i.flag).map((i) => i.key)));
  const [subject, setSubject] = useState(d.subject);
  const [body, setBody] = useState(d.body); // the plain text, for Gmail, the mail app and Copy
  const [html, setHtml] = useState(() => textToHtml(d.body));
  const [seed, setSeed] = useState(() => ({ n: 0, html: textToHtml(d.body) })); // a new n remounts the editor
  const [to, setTo] = useState(d.to ?? '');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [copies, setCopies] = useState(false);
  const [last, setLast] = useState(d.lastAt);
  const [said, setSaid] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const readOnly = useReadOnly(); // an admin viewing as the lead sees the drafts but cannot open or log them
  const mark = (channel: string) => { record(d.personId, channel, subject, [...on]); setLast(new Date().toISOString()); };
  const tick = (key: string, yes: boolean) => {
    const next = new Set(on);
    if (yes) next.add(key); else next.delete(key);
    const picked = d.items.filter((i) => next.has(i.key));
    const text = bodyFor(d.name, picked, appUrl);
    setOn(next); setSubject(subjectFor(picked)); setBody(text); setSeed((x) => ({ n: x.n + 1, html: textToHtml(text) })); setSaid(''); setSent(false);
  };
  const none = on.size === 0;
  const can = !!to && !none;
  const extra = (k: string, v: string) => (list(v).length ? `&${k}=${encodeURIComponent(list(v).join(','))}` : '');
  const gmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}${extra('cc', cc)}${extra('bcc', bcc)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}${extra('cc', cc)}${extra('bcc', bcc)}&body=${encodeURIComponent(body)}`;
  const sendNow = async () => {
    if (!can || busy) return;
    setBusy(true); setSaid('Sending…');
    const res = await fetch('/api/v1/reminders/send', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ personId: d.personId, to: list(to), cc: list(cc), bcc: list(bcc), subject, html, text: body, itemKeys: [...on] }),
    }).catch(() => null);
    const j = res ? ((await res.json().catch(() => null)) as { from?: string; error?: { code?: string; message?: string } } | null) : null;
    setBusy(false);
    if (res?.ok) { setSent(true); setLast(new Date().toISOString()); setSaid(`Sent from ${j?.from ?? send.from}.`); return; }
    setSaid(j?.error?.message ?? 'Could not send. Check your connection and try again.');
  };
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
      <p className="small remind-from"><span className="dim">From</span> {send.from}</p>
      <div className="remind-to">
        <label className="f"><span>To</span><input type="text" inputMode="email" value={to} readOnly={readOnly} placeholder="No email on file. Add one, or copy the text instead" onChange={(e) => { setTo(e.target.value); setSent(false); }} /></label>
        {!readOnly && !copies && <button type="button" className="linkbtn" onClick={() => setCopies(true)}>Cc / Bcc</button>}
      </div>
      {copies && <div className="row">
        <label className="f"><span>Cc</span><input type="text" inputMode="email" value={cc} readOnly={readOnly} placeholder="Separate addresses with commas" onChange={(e) => setCc(e.target.value)} /></label>
        <label className="f"><span>Bcc</span><input type="text" inputMode="email" value={bcc} readOnly={readOnly} placeholder="Separate addresses with commas" onChange={(e) => setBcc(e.target.value)} /></label>
      </div>}
      <label className="f"><span>Subject</span><input value={subject} readOnly={readOnly} maxLength={200} onChange={(e) => setSubject(e.target.value)} /></label>
      <div className="f"><span>Email</span>
        <RichText key={seed.n} initial={seed.html} label="Email" readOnly={readOnly} onChange={(h, t) => { setHtml(h); setBody(t); }} /></div>
      {!readOnly && <div className="row remind-actions">
        {send.enabled && (send.connected
          ? <Help term="remind_send" host><button className="btn" disabled={!can || busy || sent} onClick={sendNow}>{sent ? 'Sent' : busy ? 'Sending…' : 'Send'}</button></Help>
          : <Help term="remind_send" host><button className="btn" onClick={() => connectGmail(setSaid)}>Connect Gmail to send</button></Help>)}
        <Help term="remind_gmail" host><a className={`btn${send.enabled ? ' ghost' : ''}${can ? '' : ' disabled'}`} href={can ? gmail : undefined} target="_blank" rel="noopener noreferrer" aria-disabled={!can}
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
export function ReminderCards({ drafts, appUrl, send }: { drafts: ReminderDraft[]; appUrl: string; send: SendState }) {
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
        : <div className="remind-list">{shown.map((d) => <Card key={d.personId} d={d} appUrl={appUrl} send={send} />)}</div>}
    </>
  );
}
