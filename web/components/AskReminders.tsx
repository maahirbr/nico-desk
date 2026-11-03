'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Avatar } from './chips';
import { useReadOnly } from './readonly';

// "Waiting on a reply" on Reminders: asks for an update with no answer after a couple of days (lib/asks.ts). Each one
// can open a short draft in the lead's own Gmail. Nothing is sent until the lead presses Send there; the page only
// records that a reminder went out, as the drafts below do.
export type AskItem = { id: string; taskId: string; title: string; ownerId: string; ownerName: string; askerName: string; question: string | null; days: number; to: string | null };

const daysAgo = (n: number) => (n <= 0 ? 'today' : n === 1 ? 'yesterday' : `${n} days ago`);

export function AskReminders({ items, days, appUrl }: { items: AskItem[]; days: number; appUrl: string }) {
  const readOnly = useReadOnly();
  const [sent, setSent] = useState<Set<string>>(new Set());
  return (
    <section className="card remind-card" aria-label="Waiting on a reply">
      <div className="remind-head"><span><b>Waiting on a reply</b><span className="small dim"> · asks for an update with no answer after {days} days</span></span></div>
      <ul className="remind-items ask-remind">
        {items.map((i) => {
          const subject = `Update needed: ${i.title}`;
          const body = [`Hi ${i.ownerName},`, '', `${i.askerName} asked for an update on “${i.title}” ${daysAgo(i.days)}${i.question ? `: “${i.question}”` : '.'}`, '',
            'Could you add a line on where it stands, or change its status, here:', appUrl].join('\n');
          const gmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(i.to ?? '')}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
          return (
            <li key={i.id}>
              <Avatar id={i.ownerId} name={i.ownerName} />
              <span className="remind-item-text">
                <span><b>{i.ownerName}</b> · <Link className="rlink" href={`/tasks/${i.taskId}`}>{i.title}</Link></span>
                <span className="small dim"> · {i.askerName} asked {daysAgo(i.days)}{i.question ? `: “${i.question}”` : ''}</span>
              </span>
              {!readOnly && i.to && (sent.has(i.id) ? <span className="small dim">Opened in Gmail</span> : (
                <a className="mini-btn" href={gmail} target="_blank" rel="noopener noreferrer" onClick={() => {
                  setSent(new Set([...sent, i.id]));
                  fetch('/api/v1/reminders', { method: 'POST', headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ personId: i.ownerId, channel: 'gmail', subject, itemCount: 1, itemKeys: [`ask:${i.id}`] }) }).catch(() => {});
                }}>Draft reminder</a>
              ))}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
