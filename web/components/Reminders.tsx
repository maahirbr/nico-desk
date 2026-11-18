'use client';

import { useRef, useState } from 'react';
import type { ReminderDraft } from '@/lib/reminders';
import { bodyFor, bodyHtmlFor, subjectFor } from '@/lib/reminderText';
import { fmtDate } from '@/lib/time';
import { Avatar, PersonLink } from './chips';
import { Help } from './HelpMode';
import { useReadOnly } from './readonly';
import { RichText } from './RichText';
import { CheckTick } from './task-ui';
import { isRealEnter } from './ime';

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

// enabled: Gmail send is on. resend: the From line when Resend sends for a lead without Gmail (18 Nov), else null.
export type SendState = { enabled: boolean; connected: boolean; from: string; resend?: string | null };

const list = (s: string) => s.split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean);

export type Contact = { name: string; email: string };

// Cc and Bcc (15 Nov, the PM's call): type part of a name or an address and the team's matches drop down, as in Gmail.
// Enter (or a click) adds the highlighted one as a bubble with its initial and an ✕; Enter after a full address adds it
// as typed. Backspace in an empty box takes the last bubble off. The parent keeps a comma list of the addresses.
function EmailsField({ label, value, onChange, contacts, readOnly }: { label: string; value: string; onChange: (v: string) => void; contacts: Contact[]; readOnly: boolean }) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const [draft, setDraft] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const emails = list(value);
  const typed = draft.trim().toLowerCase();
  const chosen = new Set(emails.map((x) => x.toLowerCase()));
  const matches = typed ? contacts.filter((c) => !chosen.has(c.email.toLowerCase()) && (c.name.toLowerCase().includes(typed) || c.email.toLowerCase().includes(typed))).slice(0, 6) : [];
  const nameOf = (email: string) => contacts.find((c) => c.email.toLowerCase() === email.toLowerCase())?.name ?? email;
  const set = (next: string[]) => onChange(next.join(', '));
  // The cursor stays in the box after a bubble is added, so the next name can follow straight away.
  const take = (email: string) => { if (!chosen.has(email.toLowerCase())) set([...emails, email]); setDraft(''); setOpen(false); setHi(0); requestAnimationFrame(() => input.current?.focus()); };
  const drop = (email: string) => set(emails.filter((e) => e !== email));
  return (
    <div className="f"><span>{label}</span>
      <span className="email-pick">
        <span className={`email-box${readOnly ? ' ro' : ''}`} data-keep-focus onClick={(e) => (e.currentTarget.querySelector('input') as HTMLInputElement | null)?.focus()}>
          {emails.map((e) => (
            <span key={e} className="email-chip" title={e}><Avatar name={nameOf(e)} /><span>{nameOf(e)}</span>
              {!readOnly && <button type="button" aria-label={`Remove ${nameOf(e)}`} onClick={(ev) => { ev.stopPropagation(); drop(e); }}>×</button>}</span>
          ))}
          {!readOnly && <input key="typing" ref={input} type="text" inputMode="email" autoComplete="off" value={draft} aria-label={label}
            placeholder={emails.length ? '' : 'Name or email, then Enter'}
            role="combobox" aria-expanded={open && matches.length > 0} aria-autocomplete="list"
            onFocus={() => setOpen(true)} onBlur={() => { setTimeout(() => setOpen(false), 150); if (draft.includes('@')) take(draft.trim()); }}
            onChange={(e) => { setDraft(e.target.value); setOpen(true); setHi(0); }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' && matches.length) { e.preventDefault(); setHi((h) => (h + 1) % matches.length); }
              else if (e.key === 'ArrowUp' && matches.length) { e.preventDefault(); setHi((h) => (h - 1 + matches.length) % matches.length); }
              else if (e.key === 'Escape') setOpen(false);
              else if (e.key === 'Backspace' && !draft && emails.length) drop(emails[emails.length - 1]);
              else if (isRealEnter(e) || e.key === ',') {
                e.preventDefault();
                if (open && matches[hi]) take(matches[hi].email);
                else if (draft.includes('@')) take(draft.trim().replace(/,$/, ''));
              }
            }} />}
        </span>
        {open && matches.length > 0 && (
          <span className="email-sugg" role="listbox" aria-label={`${label} suggestions`}>
            {matches.map((c, i) => (
              <span key={c.email} role="option" aria-selected={i === hi} className={i === hi ? 'on' : ''}
                onMouseDown={(e) => { e.preventDefault(); take(c.email); }}><Avatar name={c.name} /><span className="email-sugg-text"><b>{c.name}</b><span className="dim small">{c.email}</span></span></span>
            ))}
          </span>
        )}
      </span>
    </div>
  );
}

async function connectGmail(setSaid: (s: string) => void) {
  const res = await fetch('/api/v1/connections/gmail', { method: 'POST' }).catch(() => null);
  const j = res?.ok ? ((await res.json().catch(() => null)) as { url?: string } | null) : null;
  if (j?.url) window.location.assign(j.url); else setSaid('Could not reach Google. Try again in a moment.');
}

function Card({ d, appUrl, send, signOff, contacts }: { d: ReminderDraft; appUrl: string; send: SendState; signOff: string; contacts: Contact[] }) {
  const [on, setOn] = useState(() => new Set(d.items.filter((i) => !i.flag).map((i) => i.key)));
  // The first text, with the sender's sign-off (15 Nov): "Best," and their nickname or first name.
  const first = bodyFor(d.name, d.items.filter((i) => !i.flag), appUrl, signOff);
  const [subject, setSubject] = useState(d.subject);
  const [body, setBody] = useState(first); // the plain text, for Gmail, the mail app and Copy
  // Grouped by project, the project headings in bold (15 Nov, the PM's pick); the plain text goes to drafts.
  const firstHtml = bodyHtmlFor(d.name, d.items.filter((i) => !i.flag), appUrl, signOff);
  const [html, setHtml] = useState(firstHtml);
  const [seed, setSeed] = useState(() => ({ n: 0, html: firstHtml })); // a new n remounts the editor
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
    const text = bodyFor(d.name, picked, appUrl, signOff);
    setOn(next); setSubject(subjectFor(picked)); setBody(text); setSeed((x) => ({ n: x.n + 1, html: bodyHtmlFor(d.name, picked, appUrl, signOff) })); setSaid(''); setSent(false);
  };
  const none = on.size === 0;
  const can = !!to && !none;
  const viaResend = !send.connected && !!send.resend; // a connected Gmail wins, as on the server
  const canSend = send.connected || viaResend;
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
  return (
    <section className="card remind-card" id={`remind-${d.personId}`} data-find={d.name.toLowerCase()}>
      <div className="remind-head">
        <span className="person-cell"><Avatar id={d.personId} name={d.name} lg /><span><PersonLink id={d.personId}><b>{d.name}</b></PersonLink>
          {/* Only when they were last reminded (15 Nov): the count is plain from the list below. */}
          {last && <span className="small dim"> · {ago(last)}</span>}</span></span>
      </div>
      <ul className="remind-items" aria-label={`Items in the reminder to ${d.name}`}>
        {d.items.map((i) => (
          <li key={i.key} className={on.has(i.key) ? '' : 'out'}>
            <span className="trow-check"><input type="checkbox" checked={on.has(i.key)} disabled={readOnly} aria-label={`Include “${i.title}”`}
              onChange={(e) => tick(i.key, e.target.checked)} /><CheckTick /></span>
            <span className="remind-item-text"><span>{i.title}</span>
              <span className="small dim"> · {i.where} · </span>{i.days < 0 ? <span className="small late-text">overdue since {fmtDate(i.dueOn)}</span> : <span className="small dim">due {fmtDate(i.dueOn)}</span>}
              {i.flag && <Help term="remind_flag"><span className="small remind-flag">{i.flag}</span></Help>}</span>
          </li>
        ))}
      </ul>
      <p className="small remind-from"><span className="dim">From</span> {viaResend ? <>{send.resend} <span className="dim">· replies come to you</span></> : send.from}
        {viaResend && send.enabled && !readOnly && <> <button type="button" className="linkbtn" onClick={() => connectGmail(setSaid)}>Send from your Gmail instead</button></>}</p>
      <div className="remind-to">
        <label className="f"><span>To</span><input type="text" inputMode="email" value={to} readOnly={readOnly} placeholder="No email on file. Add one, or copy the text instead" onChange={(e) => { setTo(e.target.value); setSent(false); }} /></label>
        {!readOnly && !copies && <button type="button" className="linkbtn" onClick={() => setCopies(true)}>Cc / Bcc</button>}
      </div>
      {copies && <div className="remind-copies">
        <EmailsField label="Cc" value={cc} onChange={setCc} contacts={contacts} readOnly={readOnly} />
        <EmailsField label="Bcc" value={bcc} onChange={setBcc} contacts={contacts} readOnly={readOnly} />
      </div>}
      <label className="f"><span>Subject</span><input value={subject} readOnly={readOnly} maxLength={200} onChange={(e) => setSubject(e.target.value)} /></label>
      <div className="f"><span>Email</span>
        <RichText key={seed.n} initial={seed.html} label="Email" readOnly={readOnly} onChange={(h, t) => { setHtml(h); setBody(t); }} /></div>
      {!readOnly && <div className="row remind-actions">
        {(send.enabled || viaResend) && (canSend
          ? <Help term={viaResend ? 'remind_send_resend' : 'remind_send'} host><button className="btn" disabled={!can || busy || sent} onClick={sendNow}>{sent ? 'Sent' : busy ? 'Sending…' : 'Send'}</button></Help>
          : <Help term="remind_send" host><button className="btn" onClick={() => connectGmail(setSaid)}>Connect Gmail to send</button></Help>)}
        <Help term="remind_gmail" host><a className={`btn${send.enabled || viaResend ? ' ghost' : ''}${can ? '' : ' disabled'}`} href={can ? gmail : undefined} target="_blank" rel="noopener noreferrer" aria-disabled={!can}
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

// The cards. Finding a person is in the filter bar above (components/RemindFind.tsx, 15 Nov), which hides cards by data-find.
export function ReminderCards({ drafts, appUrl, send, signOff = '', contacts = [] }: { drafts: ReminderDraft[]; appUrl: string; send: SendState; signOff?: string; contacts?: Contact[] }) {
  return <div className="remind-list">{drafts.map((d) => <Card key={d.personId} d={d} appUrl={appUrl} send={send} signOff={signOff} contacts={contacts} />)}</div>;
}
