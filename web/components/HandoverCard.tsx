'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { HandoverItem } from '@/lib/service';
import { fmtDate } from '@/lib/time';
import { useProjectPeople } from './OwnerPicker';
import { useReadOnly } from './readonly';
import { Select } from './Select';
import { TaskLink } from './TaskLink';
import { notify } from './toast';

// "Handover from Ravi" on Home (3 Nov): what an admin handed to me when Ravi was removed. Keep each item, or give it to
// someone else; either way it leaves the card. A task can only go to someone on its project (the usual rule). The card
// stays until everything is sorted. Under View as it shows but cannot be changed.
type Opt = { id: string; name: string };

export function HandoverCard({ items, people, meId, projectNames, onOpen }: {
  items: HandoverItem[]; people: Opt[]; meId: string; projectNames: Record<string, string>; onOpen: (taskId: string) => void;
}) {
  const router = useRouter();
  const readOnly = useReadOnly();
  const map = useProjectPeople();
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const shown = items.filter((i) => !gone.has(i.id));
  if (shown.length === 0) return null;
  const settle = async (i: HandoverItem, to: string | null) => {
    setBusy(true);
    try {
      const r = await fetch(`/api/v1/handovers/${i.id}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(to ? { to } : {}) });
      if (!r.ok) throw new Error((await r.json().catch(() => null))?.error?.message ?? 'Could not save that. Try again.');
      setGone((g) => new Set([...g, i.id]));
      if (to) notify(`Given to ${people.find((p) => p.id === to)?.name.split(' ')[0] ?? 'them'}`);
      router.refresh();
    } catch (e) { notify((e as Error).message); } finally { setBusy(false); }
  };
  const keepAll = async () => {
    setBusy(true);
    const r = await fetch('/api/v1/handovers/keep-all', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }).catch(() => null);
    setBusy(false);
    if (r?.ok) { setGone(new Set(items.map((i) => i.id))); router.refresh(); } else notify('Could not save that. Try again.');
  };
  // One card per person removed, newest hand-over first is not needed: usually there is one.
  const from = [...new Set(shown.map((i) => i.fromId))];
  return (
    <>
      {from.map((fid) => {
        const list = shown.filter((i) => i.fromId === fid);
        const who = list[0].fromName.split(' ')[0];
        return (
          <section key={fid} className="callout handover" aria-label={`Handover from ${who}`}>
            <div className="callout-head">
              <h2>Handover from {who} <span className="count-badge">{list.length}</span></h2>
              {!readOnly && <button className="mini-btn" disabled={busy} onClick={keepAll}>Keep all</button>}
            </div>
            <p className="small dim handover-lede">{who} was removed from NicoDesk. {list[0].byName.split(' ')[0]} handed this to you. Keep what&rsquo;s yours, or give it to someone else.</p>
            {list.map((i) => {
              // Who it can go to: for a task on a project, that project's people; otherwise anyone active. Never back to me.
              const pool = i.kind === 'task' && i.projectId ? people.filter((p) => (map[i.projectId!] ?? []).includes(p.id)) : people;
              const options = pool.filter((p) => p.id !== meId);
              return (
                <div key={i.id} className="callout-row handover-row">
                  <span className="wait-body">
                    <span className="wait-title">
                      {i.kind === 'project'
                        ? <><b>{i.role === 'lead' ? 'Lead' : 'Owner'}</b> of {i.title}</>
                        : <TaskLink id={i.refId} className="callout-link" onOpen={() => onOpen(i.refId)}>{i.title}</TaskLink>}
                    </span>
                    <span className="upd-meta">
                      {i.kind === 'block' ? 'Now waiting on you' : i.kind === 'task' ? `Due ${i.dueOn ? fmtDate(i.dueOn) : '—'}` : 'Project'}
                      {i.kind !== 'project' && i.projectId && projectNames[i.projectId] && <> · {projectNames[i.projectId]}</>}
                    </span>
                  </span>
                  {!readOnly && (
                    <span className="handover-acts">
                      <button className="mini-btn" disabled={busy} onClick={() => settle(i, null)}>Keep</button>
                      <Select value="" aria-label={`Give “${i.title}” to`} disabled={busy} onChange={(to) => { if (to) void settle(i, to); }}>
                        <option value="">Give to…</option>
                        {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                      </Select>
                    </span>
                  )}
                </div>
              );
            })}
          </section>
        );
      })}
    </>
  );
}
