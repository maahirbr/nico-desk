'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { SentenceRead } from '@/lib/sentence';
import { DateField } from './DateField';
import { OwnerPicker, ownerFields, ownerReady, useProjectPeople } from './OwnerPicker';
import { Select } from './Select';
import { arrivals } from './motion';
import { api, type Opt } from './task-ui';
import { notify } from './toast';

// Several tasks from one Quick Add ("Sam, can you ... by Friday? And then Kabir, can you ..."). Each one is a card the
// person checks: name, owner, due date, project. Add makes it through the normal task route, Skip leaves it, and Add all
// makes every card that is ready. Nothing is made until a button is pressed.

type Row = { title: string; ownerId: string; ownerRole?: string; dueOn: string; projectId: string; state: 'open' | 'busy' | 'added' | 'skipped'; err: string | null };

export function TaskDrafts({ drafts, people, projects, projectId, today, onBack, onDone }: {
  drafts: SentenceRead[]; people: Opt[]; projects?: Opt[]; projectId?: string; today: string; onBack: () => void; onDone: () => void;
}) {
  const router = useRouter();
  const map = useProjectPeople();
  const [rows, setRows] = useState<Row[]>(() => drafts.map((d) => {
    const pid = projectId ?? d.projectId ?? '';
    const owner = d.ownerId && (!pid || (map[pid] ?? []).includes(d.ownerId)) ? d.ownerId : '';
    return { title: d.title, ownerId: owner, dueOn: d.dueOn ?? '', projectId: pid, state: 'open', err: owner || !d.ownerId ? null : 'That person is not on this project. Pick the owner, or add them.' };
  }));
  const set = (i: number, r: Partial<Row>) => setRows((all) => all.map((x, j) => (j === i ? { ...x, ...r } : x)));
  const ready = (r: Row) => r.state === 'open' && r.title.trim().length >= 3 && ownerReady(r.ownerId, r.ownerRole) && !!r.dueOn;
  const left = rows.filter((r) => r.state === 'open' || r.state === 'busy').length;
  const added = rows.filter((r) => r.state === 'added').length;

  async function add(i: number): Promise<boolean> {
    const r = rows[i];
    set(i, { state: 'busy', err: null });
    try {
      const made = await api('/tasks', 'POST', { title: r.title.trim(), ...ownerFields(r.ownerId, r.ownerRole), dueOn: r.dueOn, projectId: r.projectId || null });
      if (made?.id) arrivals.add(made.id);
      set(i, { state: 'added' });
      return true;
    } catch (e) { set(i, { state: 'open', err: (e as Error).message }); return false; }
  }
  async function addAll() {
    let n = 0;
    for (let i = 0; i < rows.length; i++) if (ready(rows[i]) && await add(i)) n++;
    if (n) { notify(n === 1 ? 'Task added' : `${n} tasks added`); router.refresh(); }
  }
  function finish() { if (added) router.refresh(); onDone(); }

  return (
    <div className="stack">
      <div className="inbox-head">
        <h2>{drafts.length} tasks found</h2>
        {left > 0 && <button type="button" className="btn" disabled={!rows.some(ready)} onClick={() => void addAll()}>Add all</button>}
      </div>
      <p className="hint" style={{ margin: 0 }}>Check each one, then add it.</p>
      <ul className="stack" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {rows.map((r, i) => (
          <li key={i} className="pc">
            {r.state === 'added' ? <p className="small dim pc-gone">Added: {r.title}</p>
              : r.state === 'skipped' ? <p className="small dim pc-gone">Skipped: {r.title} <button type="button" className="mini-btn" onClick={() => set(i, { state: 'open' })}>Undo</button></p>
              : (<>
                <label className="f"><span>Task</span><input value={r.title} maxLength={200} onChange={(e) => set(i, { title: e.target.value })} /></label>
                <div className="row">
                  <label className="f"><span>Owner</span>
                    <OwnerPicker key={r.projectId} projectId={r.projectId || null} value={r.ownerId} people={people} onChange={(ownerId, ownerRole) => set(i, { ownerId, ownerRole, err: null })} />
                  </label>
                  <label className="f"><span>Due Date</span><DateField min={today} value={r.dueOn} onChange={(e) => set(i, { dueOn: e.target.value })} /></label>
                </div>
                {projects && !projectId && (
                  <label className="f"><span>Project</span>
                    <Select value={r.projectId} onChange={(p) => set(i, { projectId: p, ownerRole: undefined, ownerId: !p || (map[p] ?? []).includes(r.ownerId) ? r.ownerId : '' })}>
                      <option value="">None</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </Select>
                  </label>
                )}
                {r.err && <p className="err small" role="alert" style={{ margin: 0 }}>{r.err}</p>}
                {!r.dueOn && <p className="hint" style={{ margin: 0 }}>Pick a due date to add this one.</p>}
                <div className="row pc-actions" style={{ justifyContent: 'flex-end' }}>
                  <button type="button" className="mini-btn" onClick={() => set(i, { state: 'skipped' })}>Skip</button>
                  <button type="button" className="btn small-btn" disabled={!ready(r)} onClick={async () => { if (await add(i)) { notify('Task added'); router.refresh(); } }}>{r.state === 'busy' ? 'Adding…' : 'Add'}</button>
                </div>
              </>)}
          </li>
        ))}
      </ul>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        {left > 0 ? <button type="button" className="btn ghost" onClick={onBack}>Back to one task</button>
          : <button type="button" className="btn" onClick={finish}>Done</button>}
      </div>
    </div>
  );
}
