'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Task } from '@/lib/derive';
import { ago } from '@/lib/updates';
import { api } from './task-ui';
import { notify } from './toast';

// "Waiting on you": other people's tasks blocked on you. A block stays here until it is cleared, not for a
// week like an update. Done clears it with a few words on what you did, which the owner then sees in Updates.

export function WaitingCard({ tasks, names, projectNames, now, onOpen }: {
  tasks: Task[]; names: Record<string, string>; projectNames: Record<string, string>; now: string; onOpen: (id: string) => void;
}) {
  const [doing, setDoing] = useState<string | null>(null);
  if (!tasks.length) return null;
  return (
    <section className="callout" aria-label="Waiting on you">
      <h2>Waiting on you <span className="count-badge">{tasks.length}</span></h2>
      {tasks.map((t) => (
        <div key={t.id} className="wait-item">
          <div className="callout-row wait-row">
            <span className="wait-body">
              <span className="wait-title">
                <b>{names[t.ownerId]?.split(' ')[0]}</b>
                {' · '}
                <button className="callout-link" onClick={() => onOpen(t.id)}>{t.title}</button>
              </span>
              <span className="upd-meta">
                “{t.blocked?.ask}”{t.blocked?.at && <> · {ago(t.blocked.at, now)}</>}{t.projectId && projectNames[t.projectId] && <> · {projectNames[t.projectId]}</>}
              </span>
            </span>
            {doing !== t.id && <button className="mini-btn" onClick={() => setDoing(t.id)}>Done</button>}
          </div>
          {doing === t.id && <DoneForm task={t} owner={names[t.ownerId]?.split(' ')[0] ?? 'The owner'} onClose={() => setDoing(null)} />}
        </div>
      ))}
    </section>
  );
}

function DoneForm({ task, owner, onClose }: { task: Task; owner: string; onClose: () => void }) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <form className="wait-done" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setErr(null);
      try {
        await api(`/tasks/${task.id}/unblock`, 'POST', { version: task.version, note });
        notify(`Block cleared. ${owner} will see what you did.`);
        onClose();
        router.refresh();
      } catch (er) { setErr((er as Error).message); setBusy(false); }
    }}>
      <label className="f"><span>What did you do?</span>
        <input autoFocus required maxLength={280} value={note} placeholder="e.g. Sent the numbers on email" onChange={(e) => setNote(e.target.value)} />
      </label>
      {err && <p className="err" role="alert">{err}</p>}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn" disabled={busy || !note.trim()}>Clear Block</button>
      </div>
    </form>
  );
}
