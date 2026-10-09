'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { Health, Task } from '@/lib/derive';
import { Avatar } from './chips';

// Client pieces. Every write goes to /api/v1, so the same rules apply as for any other caller.

type ApiErr = { code: string; message: string; field?: string };

async function api(path: string, method: string, body?: unknown): Promise<{ ok: true; data: any } | { ok: false; error: ApiErr }> {
  const res = await fetch(`/api/v1${path}`, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return { ok: true, data: null };
  const data = await res.json().catch(() => null);
  if (!res.ok) return { ok: false, error: data?.error ?? { code: 'server_error', message: `Request failed (${res.status}).` } };
  return { ok: true, data };
}

function useSubmit() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(path: string, method: string, body?: unknown, after?: (data: any) => void) {
    setBusy(true);
    setError(null);
    const r = await api(path, method, body);
    setBusy(false);
    if (!r.ok) {
      setError(r.error.message);
      return false;
    }
    after ? after(r.data) : router.refresh();
    return true;
  }
  return { busy, error, run };
}

const Err = ({ e }: { e: string | null }) => (e ? <p className="err" role="alert">{e}</p> : null);

// ---------- frame ----------

const ICON: Record<string, React.ReactNode> = {
  '/me': <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5Z" />,
  '/team': <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />,
  '/search': <path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.35-4.35" />,
  more: <path d="M5 12h.01M12 12h.01M19 12h.01" />,
  '/week': <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />,
  '/status': <path d="M4 6h16M4 12h10M4 18h6" />,
  '/ledger': <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  '/reminders': <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />,
  '/projects': <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />,
  '/admin': <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />,
};

const Icon = ({ d }: { d: React.ReactNode }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{d}</svg>
);

export function Nav({ isAdmin, isLead = false }: { isAdmin: boolean; isLead?: boolean }) {
  const path = usePathname();
  const main = [['/me', 'Home'], ['/team', 'Team'], ['/projects', 'Projects']];
  const more = [['/ledger', 'Ledger'], ...(isLead || isAdmin ? [['/reminders', 'Reminders']] : []), ...(isAdmin ? [['/admin', 'Roster']] : [])];
  const here = (href: string) => path === href || path.startsWith(`${href}/`) || (href === '/team' && (path === '/week' || path === '/status'));
  const [moreOpen, setMoreOpen] = useState(more.some(([h]) => here(h)));
  const link = ([href, label]: string[]) => (
    <Link key={href} href={href} aria-current={here(href) ? 'page' : undefined}><Icon d={ICON[href]} />{label}</Link>
  );
  return (
    <nav className="nav" aria-label="Views">
      {main.map(link)}
      <button className="nav-more" aria-expanded={moreOpen} onClick={() => setMoreOpen(!moreOpen)}>
        <Icon d={ICON.more} />More<span className="chev-r" aria-hidden>{moreOpen ? '▾' : '▸'}</span>
      </button>
      <div className={`nav-sub${moreOpen ? ' open' : ''}`}>{more.map(link)}</div>
      <Link className="nav-new" href="/tasks/new" aria-current={path === '/tasks/new' ? 'page' : undefined}>+ New task</Link>
    </nav>
  );
}

export function SignOut() {
  const router = useRouter();
  return (
    <button className="act" title="Sign out" aria-label="Sign out"
      onClick={async () => { await api('/session', 'DELETE'); router.push('/signin'); router.refresh(); }}>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
      </svg>
    </button>
  );
}

// Shown when the desk owner is looking at the desk as someone else.
export function SwitchToOwner({ id, viewing }: { id: string; viewing: string }) {
  const router = useRouter();
  return (
    <div className="viewing-as">
      <span>Viewing as {viewing.split(' ')[0]}</span>
      <button className="act" onClick={async () => { const r = await api('/session', 'POST', { personId: id }); if (r.ok) { router.push('/me'); router.refresh(); } }}>
        Switch back to you
      </button>
    </div>
  );
}

export function SignInList({ people }: { people: { id: string; name: string; role: string; roles: string }[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <ul>
        {people.map((p) => (
          <li key={p.id}>
            <button
              onClick={async () => {
                const r = await api('/session', 'POST', { personId: p.id });
                if (!r.ok) return setError(r.error.message);
                router.push('/me');
                router.refresh();
              }}
            >
              <Avatar name={p.name} lg />
              <span><div className="p-name">{p.name}</div><div className="p-role">{p.role}</div></span>
              {p.roles && <span className="p-tag">{p.roles}</span>}
            </button>
          </li>
        ))}
      </ul>
      <Err e={error} />
    </>
  );
}

// ---------- create ----------

type Opt = { id: string; name: string };

export function NewTaskForm({ people, projects, meId, today }: { people: Opt[]; projects: Opt[]; meId: string; today: string }) {
  const router = useRouter();
  const { busy, error, run } = useSubmit();
  const [f, setF] = useState({ title: '', ownerId: meId, dueOn: '', projectId: '', note: '' });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <form
      className="card form-card stack"
      onSubmit={(e) => {
        e.preventDefault();
        run('/tasks', 'POST', { title: f.title, ownerId: f.ownerId, dueOn: f.dueOn, projectId: f.projectId || null, note: f.note || null },
          (t: Task) => router.push(`/tasks/${t.id}`));
      }}
    >
      <label className="f"><span>Task</span><input required minLength={3} maxLength={200} value={f.title} onChange={set('title')} /></label>
      <div className="row">
        <label className="f"><span>Owner</span>
          <select value={f.ownerId} onChange={set('ownerId')}>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        </label>
        <label className="f"><span>Due date (locked once set)</span><input type="date" required min={today} value={f.dueOn} onChange={set('dueOn')} /></label>
        <label className="f"><span>Project</span>
          <select value={f.projectId} onChange={set('projectId')}>
            <option value="">None</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
      </div>
      <label className="f"><span>One-line note ({140 - f.note.length} left)</span><input maxLength={140} value={f.note} onChange={set('note')} /></label>
      <div><button className="btn" disabled={busy}>Create task</button></div>
      <Err e={error} />
    </form>
  );
}

// ---------- task actions (SPEC.md 4.3) ----------

const HEALTH_WORDS: [Health, string][] = [
  ['not_started', 'Not started'],
  ['on_track', 'In progress'],
];

export function TaskActions({
  t, may, people, projects, today,
}: {
  t: Task;
  may: { edit: boolean; reassign: boolean; health: boolean; renegotiate: boolean; close: boolean; reopen: boolean; block: boolean; unblock: boolean; priority: boolean; update: boolean };
  people: Opt[];
  projects: Opt[];
  today: string;
}) {
  const v = t.version;
  const open = t.statusCategory === 'open';
  return (
    <div className="actions">
      {open && may.health && <HealthForm t={t} today={today} />}
      {open && may.renegotiate && <RenegotiateForm t={t} today={today} />}
      {open && may.close && <CloseForm t={t} />}
      {!open && may.reopen && <ReasonForm title="Reopen" path={`/tasks/${t.id}/reopen`} label="Why reopen" button="Reopen" body={(reason) => ({ version: v, reason })} />}
      {open && may.block && !t.blocked && <BlockForm t={t} people={people.filter((p) => p.id !== t.ownerId)} />}
      {t.blocked && may.unblock && <UnblockForm t={t} />}
      {may.priority && <PriorityForm t={t} />}
      {may.update && <ReasonForm title="Add an update" path={`/tasks/${t.id}/updates`} label="Update (no field changes)" button="Add to log" min={1} body={(text) => ({ text })} />}
      {may.edit && <EditForm t={t} people={people} projects={projects} canReassign={may.reassign} />}
    </div>
  );
}

// Not started or in progress. Ahead, at risk and late are worked out from the dates.
function HealthForm({ t }: { t: Task; today: string }) {
  const { busy, error, run } = useSubmit();
  const now: Health = !t.health || t.health === 'not_started' ? 'not_started' : 'on_track';
  const [health, setHealth] = useState<Health>(now);
  const [reason, setReason] = useState('');
  const back = health === 'not_started' && now !== 'not_started';
  return (
    <form className="panel stack" onSubmit={(e) => {
      e.preventDefault();
      run(`/tasks/${t.id}/health`, 'POST', { version: t.version, health, ...(reason ? { reason } : {}) });
    }}>
      <h3>Status</h3>
      <label className="f"><span>Now</span>
        <select value={health} onChange={(e) => setHealth(e.target.value as Health)}>
          {HEALTH_WORDS.map(([h, w]) => <option key={h} value={h}>{w}</option>)}
        </select>
      </label>
      {back && <label className="f"><span>Why did work stop?</span><textarea required minLength={10} maxLength={280} value={reason} onChange={(e) => setReason(e.target.value)} /></label>}
      <div><button className="btn" disabled={busy || health === now}>Set status</button></div>
      <Err e={error} />
    </form>
  );
}

function RenegotiateForm({ t, today }: { t: Task; today: string }) {
  const { busy, error, run } = useSubmit();
  const [newDueOn, setDue] = useState('');
  const [reason, setReason] = useState('');
  return (
    <form className="panel stack" onSubmit={(e) => { e.preventDefault(); run(`/tasks/${t.id}/renegotiate`, 'POST', { version: t.version, newDueOn, reason }); }}>
      <h3>Renegotiate the date</h3>
      <p className="hint">The first date stays on record. Doing this before the date passes counts as open.</p>
      <label className="f"><span>New date</span><input type="date" required min={today} value={newDueOn} onChange={(e) => setDue(e.target.value)} /></label>
      <label className="f"><span>Reason</span><textarea required minLength={10} maxLength={280} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
      <div><button className="btn" disabled={busy}>Log new date</button></div>
      <Err e={error} />
    </form>
  );
}

function CloseForm({ t }: { t: Task }) {
  const { busy, error, run } = useSubmit();
  const [reason, setReason] = useState('');
  return (
    <div className="panel stack">
      <h3>Close</h3>
      <div><button className="btn" disabled={busy} onClick={() => run(`/tasks/${t.id}/close`, 'POST', { version: t.version, as: 'done' })}>Mark done</button></div>
      <label className="f"><span>Or drop it, with a reason</span><textarea minLength={10} maxLength={280} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
      <div><button className="btn ghost" disabled={busy || reason.trim().length < 10}
        onClick={() => run(`/tasks/${t.id}/close`, 'POST', { version: t.version, as: 'dropped', reason })}>Drop</button></div>
      <Err e={error} />
    </div>
  );
}

function BlockForm({ t, people }: { t: Task; people: Opt[] }) {
  const { busy, error, run } = useSubmit();
  const [onId, setOn] = useState('');
  const [ask, setAsk] = useState('');
  return (
    <form className="panel stack" onSubmit={(e) => { e.preventDefault(); run(`/tasks/${t.id}/block`, 'POST', { version: t.version, onId: onId || null, ask }); }}>
      <h3>Mark blocked</h3>
      <label className="f"><span>Block reason</span><textarea required minLength={10} maxLength={280} value={ask} onChange={(e) => setAsk(e.target.value)} /></label>
      <label className="f"><span>Waiting on someone in the team? (optional)</span>
        <select value={onId} onChange={(e) => setOn(e.target.value)}><option value="">No one, or someone outside</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      </label>
      <p className="hint">A named person sees it in the app. Nothing is emailed.</p>
      <div><button className="btn" disabled={busy}>Mark blocked</button></div>
      <Err e={error} />
    </form>
  );
}

function UnblockForm({ t }: { t: Task }) {
  const { busy, error, run } = useSubmit();
  const [note, setNote] = useState('');
  return (
    <form className="panel stack" onSubmit={(e) => { e.preventDefault(); run(`/tasks/${t.id}/unblock`, 'POST', { version: t.version, note }); }}>
      <h3>Clear the block</h3>
      <label className="f"><span>What unblocked it (optional)</span><input maxLength={280} value={note} onChange={(e) => setNote(e.target.value)} /></label>
      <div><button className="btn" disabled={busy}>Clear block</button></div>
      <Err e={error} />
    </form>
  );
}

function PriorityForm({ t }: { t: Task }) {
  const { busy, error, run } = useSubmit();
  const [value, setValue] = useState(t.priority?.value ?? 'normal');
  return (
    <form className="panel stack" onSubmit={(e) => { e.preventDefault(); run(`/tasks/${t.id}/priority`, 'POST', { version: t.version, value }); }}>
      <h3>Priority (leads only)</h3>
      <label className="f"><span>Priority</span>
        <select value={value} onChange={(e) => setValue(e.target.value as typeof value)}>
          <option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option>
        </select>
      </label>
      <div><button className="btn" disabled={busy || value === t.priority?.value}>Set priority</button></div>
      <Err e={error} />
    </form>
  );
}

function ReasonForm({ title, path, label, button, body, min = 10 }: { title: string; path: string; label: string; button: string; body: (s: string) => unknown; min?: number }) {
  const { busy, error, run } = useSubmit();
  const [text, setText] = useState('');
  return (
    <form className="panel stack" onSubmit={async (e) => { e.preventDefault(); if (await run(path, 'POST', body(text))) setText(''); }}>
      <h3>{title}</h3>
      <label className="f"><span>{label}</span><textarea required minLength={min} maxLength={280} value={text} onChange={(e) => setText(e.target.value)} /></label>
      <div><button className="btn" disabled={busy}>{button}</button></div>
      <Err e={error} />
    </form>
  );
}

function EditForm({ t, people, projects, canReassign }: { t: Task; people: Opt[]; projects: Opt[]; canReassign: boolean }) {
  const { busy, error, run } = useSubmit();
  const [f, setF] = useState({ title: t.title, note: t.note ?? '', projectId: t.projectId ?? '', ownerId: t.ownerId });
  const body: Record<string, unknown> = { version: t.version };
  if (f.title !== t.title) body.title = f.title;
  if (f.note !== (t.note ?? '')) body.note = f.note || null;
  if (f.projectId !== (t.projectId ?? '')) body.projectId = f.projectId || null;
  if (f.ownerId !== t.ownerId) body.ownerId = f.ownerId;
  return (
    <form className="panel stack" onSubmit={(e) => { e.preventDefault(); run(`/tasks/${t.id}`, 'PATCH', body); }}>
      <h3>Edit</h3>
      <label className="f"><span>Task</span><input required minLength={3} maxLength={200} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
      <label className="f"><span>One-line note</span><input maxLength={140} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
      <div className="row">
        <label className="f"><span>Project</span>
          <select value={f.projectId} onChange={(e) => setF({ ...f, projectId: e.target.value })}>
            <option value="">None</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        {canReassign && (
          <label className="f"><span>Owner</span>
            <select value={f.ownerId} onChange={(e) => setF({ ...f, ownerId: e.target.value })}>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          </label>
        )}
      </div>
      <div><button className="btn" disabled={busy || Object.keys(body).length === 1}>Save</button></div>
      <Err e={error} />
    </form>
  );
}

// ---------- tick to close ----------

// Ticks a task done from any list. Undoing is a reopen, which needs a lead and a reason, so it
// happens on the task page instead.
export function DoneBox({ id, version, title }: { id: string; version: number; title: string }) {
  const { busy, error, run } = useSubmit();
  const [done, setDone] = useState(false);
  return (
    <>
      <input type="checkbox" className="done-box" aria-label={`Mark “${title}” done`} checked={done} disabled={busy || done}
        onChange={async () => { setDone(true); if (!(await run(`/tasks/${id}/close`, 'POST', { version, as: 'done' }))) setDone(false); }} />
      {error && <span className="err small" role="alert">{error}</span>}
    </>
  );
}

// ---------- notices ----------

export function MarkRead({ id }: { id: string }) {
  const { busy, run } = useSubmit();
  return <button className="act" disabled={busy} onClick={() => run(`/me/notices/${id}/read`, 'POST')}>Mark read</button>;
}

// ---------- roster ----------

export function AddPersonForm({ teamId }: { teamId: string }) {
  const { busy, error, run } = useSubmit();
  const blank = { displayName: '', role: '', department: '', email: '', lead: false, admin: false };
  const [f, setF] = useState(blank);
  return (
    <form className="card form-card stack" onSubmit={async (e) => {
      e.preventDefault();
      const appRoles = [...(f.lead ? ['lead'] : []), ...(f.admin ? ['admin'] : [])];
      if (await run(`/teams/${teamId}/people`, 'POST', { displayName: f.displayName, role: f.role, department: f.department, email: f.email, appRoles })) setF(blank);
    }}>
      <div className="row">
        <label className="f"><span>Name</span><input required value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} /></label>
        <label className="f"><span>Job title</span><input required value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} /></label>
        <label className="f"><span>Department</span><input required value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })} /></label>
        <label className="f"><span>Email</span><input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
      </div>
      <div className="row">
        <label className="check"><input type="checkbox" checked={f.lead} onChange={(e) => setF({ ...f, lead: e.target.checked })} /> Lead</label>
        <label className="check"><input type="checkbox" checked={f.admin} onChange={(e) => setF({ ...f, admin: e.target.checked })} /> Admin</label>
        <button className="btn" disabled={busy}>Add to roster</button>
      </div>
      <Err e={error} />
    </form>
  );
}

export function PersonControls({ id, active, roles, self }: { id: string; active: boolean; roles: string[]; self: boolean }) {
  const { busy, error, run } = useSubmit();
  const toggle = (r: string) => (roles.includes(r) ? roles.filter((x) => x !== r) : [...roles, r]).filter((x) => x !== 'member');
  return (
    <span className="row" style={{ gap: 12 }}>
      <button className="act" disabled={busy || self} onClick={() => run(`/people/${id}`, 'PATCH', { active: !active })}>
        {active ? 'Mark inactive' : 'Mark active'}
      </button>
      <button className="act" disabled={busy} onClick={() => run(`/people/${id}`, 'PATCH', { appRoles: toggle('lead') })}>
        {roles.includes('lead') ? 'Remove lead' : 'Make lead'}
      </button>
      <Err e={error} />
    </span>
  );
}
