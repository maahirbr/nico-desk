'use client';

import { useEffect, useState } from 'react';
import type { PlanLine, Proposal } from '@/lib/planUtil';
import { fmtDate } from '@/lib/time';

// Meeting minutes in, proposals out: nothing changes until a person accepts each one.

type Op = (b: Record<string, unknown>) => Promise<boolean>;

type Source = 'paste' | 'granola' | 'fireflies' | 'wispr';
type Read = { title: string; date: string; text: string; source?: { provider: 'granola' | 'fireflies'; id: string; link?: string | null } };
const NAME: Record<Source, string> = { paste: 'Paste', granola: 'Granola', fireflies: 'Fireflies', wispr: 'Wispr Flow' };

export function ImportPanel({ what, busy, today, onRead }: { what: 'plan' | 'tasks'; busy: boolean; today: string; onRead: (b: Read) => void }) {
  const [tab, setTab] = useState<Source>('paste');
  const [f, setF] = useState({ title: '', date: today, text: '' });
  return (
    <div className="card imp-panel">
      <div className="imp-head"><h3>Import meeting minutes</h3></div>
      <nav className="tabs imp-tabs" aria-label="Where the minutes come from">
        {(Object.keys(NAME) as Source[]).map((k) => (
          <button key={k} className="tab" aria-pressed={tab === k} onClick={() => setTab(k)}>{NAME[k]}</button>
        ))}
      </nav>
      <p className="sub">Next steps become proposals to review. Nothing changes on the {what === 'plan' ? 'plan' : 'board'} until someone accepts them{what === 'tasks' ? '; each accepted step becomes a task with an owner and a date' : ''}.</p>
      {tab === 'paste' && (
        <div className="stack">
          <div className="row">
            <label className="f" style={{ flex: '0 1 180px' }}><span>Meeting date</span><input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
            <label className="f"><span>Meeting name</span><input value={f.title} placeholder="e.g. Weekly working session" onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
          </div>
          <textarea rows={7} value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })}
            placeholder={'Paste the minutes, or just the Next Steps:\n(Kabir Sethi) Send the studio the column list (Oct 12, 2026)\nRohan: share the board template by 14 Oct'} />
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" disabled={busy || !f.text.trim() || !f.date} onClick={() => onRead(f)}>{busy ? 'Reading…' : 'Read minutes'}</button>
          </div>
        </div>
      )}
      {(tab === 'granola' || tab === 'fireflies') && <SourceList key={tab} provider={tab} busy={busy} onRead={onRead} />}
      {tab === 'wispr' && (
        <div className="stack small">
          <p style={{ margin: 0 }}>Wispr Flow doesn’t offer an API that apps like this one can read. It only connects to AI assistants such as Claude.</p>
          <ol className="steps">
            <li>Open the meeting in Wispr Flow.</li>
            <li>Copy the summary, or just its <b>Next steps</b> section.</li>
            <li>Paste it under <button className="act" onClick={() => setTab('paste')}>Paste</button> and press Read minutes.</li>
          </ol>
        </div>
      )}
    </div>
  );
}

// Meetings from a connected source: pick one, and its action items are read like pasted minutes.
function SourceList({ provider, busy, onRead }: { provider: 'granola' | 'fireflies'; busy: boolean; onRead: (b: Read) => void }) {
  const [status, setStatus] = useState<'loading' | 'off' | 'on'>('loading');
  const [days, setDays] = useState(14);
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<{ id: string; title: string; date: string; attendees: string[] }[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pick, setPick] = useState<string | null>(null);

  async function load(d = days, query = q) {
    setMsg(null); setRows(null);
    const res = await fetch(`/api/v1/connections/${provider}/meetings?days=${d}${query ? `&q=${encodeURIComponent(query)}` : ''}`);
    const data = await res.json().catch(() => null);
    if (!res.ok) { setMsg(data?.error?.message ?? 'Could not load meetings.'); setRows([]); return; }
    setRows(data);
  }
  useEffect(() => {
    fetch('/api/v1/connections').then((r) => r.json()).then((s) => {
      const on = !!s?.[provider]?.connected;
      setStatus(on ? 'on' : 'off');
      if (on) load();
    }).catch(() => setStatus('off'));
  }, [provider]); // eslint-disable-line react-hooks/exhaustive-deps

  if (status === 'loading') return <p className="small dim">Checking the connection…</p>;
  if (status === 'off') return (
    <div className="stack small">
      <p style={{ margin: 0 }}>{NAME[provider]} isn’t connected yet. A lead adds the team’s {NAME[provider]} API key once: <a className="act" href="/connections">connect {NAME[provider]}</a>.</p>
    </div>
  );
  return (
    <div className="stack">
      <div className="row">
        <input type="search" className="search" placeholder={`Search ${NAME[provider]} meetings`} value={q} aria-label="Search meetings"
          onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') load(days, q); }} />
        <select value={days} aria-label="How far back" onChange={(e) => { setDays(Number(e.target.value)); load(Number(e.target.value), q); }}>
          <option value={7}>Last 7 days</option><option value={14}>Last 14 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option>
        </select>
        <button className="btn ghost" onClick={() => load(days, q)}>Search</button>
      </div>
      {msg && <p className="err" role="alert">{msg}</p>}
      {rows === null ? <p className="small dim">Loading meetings…</p> : rows.length === 0 && !msg ? <p className="small dim">No meetings in this range.</p> : (
        <div className="meet-list">
          {rows.map((m) => (
            <div key={m.id} className="meet">
              <div className="meet-main">
                <b>{m.title}</b>
                <span className="small dim">{m.date ? fmtDate(m.date) : ''}{m.attendees.length ? ` · ${m.attendees.slice(0, 4).join(', ')}${m.attendees.length > 4 ? ` +${m.attendees.length - 4}` : ''}` : ''}</span>
              </div>
              <button className="btn small-btn" disabled={busy || pick === m.id} onClick={async () => {
                setPick(m.id); setMsg(null);
                try {
                  const res = await fetch(`/api/v1/connections/${provider}/meetings/${encodeURIComponent(m.id)}`);
                  const note = await res.json();
                  if (!res.ok) throw new Error(note?.error?.message ?? 'Could not fetch the meeting.');
                  if (!note.text?.trim()) throw new Error('This meeting has no summary or action items yet.');
                  onRead({ title: note.title, date: note.date || new Date().toISOString().slice(0, 10), text: note.text, source: { provider, id: note.id, link: note.link } });
                } catch (e) { setMsg((e as Error).message); }
                finally { setPick(null); }
              }}>{pick === m.id ? 'Reading…' : 'Import'}</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Inbox({ mode, proposals, lines = [], people = [], workstreams = [], busy, today, op }: {
  mode: 'plan' | 'tasks'; proposals: Proposal[]; lines?: PlanLine[]; people?: { id: string; name: string }[]; workstreams?: string[];
  busy: boolean; today: string; op: Op;
}) {
  const [editingP, setEditingP] = useState<string | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const batches = [...new Set(proposals.map((p) => p.batch))];
  return (
    <section className="inbox">
      <div className="inbox-head"><h2>Meeting updates</h2><span className="count-badge">{proposals.length} to review</span></div>
      {batches.map((b) => {
        const items = proposals.filter((p) => p.batch === b).sort((x, y) => x.position - y.position);
        const m = items[0].meeting;
        const sure = items.filter((p) => p.confidence === 'sure' && (mode === 'tasks' || p.lineId)).length;
        return (
          <div key={b} className="card inbox-batch">
            <div className="batch-head">
              <div><div className="batch-title">{m.title}</div><div className="small dim">{fmtDate(m.date)} · {items.length} next steps</div></div>
              <div className="row">
                <button className="mini-btn" disabled={busy || !sure} onClick={() => op({ op: 'acceptSure', batch: b })}>Accept all sure ones ({sure})</button>
                <button className="mini-btn danger" disabled={busy}
                  onClick={() => { if (armed === b) { op({ op: 'dismissBatch', batch: b }); setArmed(null); } else { setArmed(b); setTimeout(() => setArmed(null), 5000); } }}>
                  {armed === b ? `Confirm dismiss ${items.length}` : 'Dismiss all'}
                </button>
              </div>
            </div>
            {items.map((p) => <ProposalCard key={p.id} mode={mode} p={p} lines={lines} people={people} workstreams={workstreams} busy={busy} today={today} editing={editingP === p.id}
              onEdit={() => setEditingP(editingP === p.id ? null : p.id)} op={op} />)}
          </div>
        );
      })}
    </section>
  );
}

function ProposalCard({ mode, p, lines, people, workstreams, busy, today, editing, onEdit, op }: {
  mode: 'plan' | 'tasks'; p: Proposal; lines: PlanLine[]; people: { id: string; name: string }[]; workstreams: string[];
  busy: boolean; today: string; editing: boolean; onEdit: () => void; op: Op;
}) {
  const [lineId, setLineId] = useState(p.lineId ?? '');
  const [ownerId, setOwnerId] = useState(p.ownerId ?? '');
  const [ws, setWs] = useState(p.workstream ?? '');
  const [f, setF] = useState({ task: p.task, ownerName: p.ownerName, ownerWith: p.ownerWith, dueOn: p.dueOn ?? '' });
  const unsure = mode === 'plan' ? p.confidence !== 'sure' || !p.lineId : !ownerId || !(editing ? f.dueOn : p.dueOn);
  return (
    <div className={`pc${unsure ? ' unsure' : ''}`}>
      <div className="pc-top">
        <span className={`pc-badge${unsure ? ' unsure' : ''}`}>{unsure ? (mode === 'plan' ? 'Check the line' : 'Needs owner and date') : mode === 'plan' ? 'Sure' : 'Ready'}</span>
        {mode === 'plan' ? (
          <select className="pc-line" value={lineId} aria-label="Line for this action" onChange={(e) => setLineId(e.target.value)}>
            <option value="">Other actions (no line)</option>
            {[...lines].sort((a, b) => a.num - b.num).map((l) => <option key={l.id} value={l.id}>{l.num}. {l.what}{p.alt.includes(l.id) ? '  (maybe)' : ''}</option>)}
          </select>
        ) : (
          <>
            <select className="pc-line" value={ownerId} aria-label="Owner" onChange={(e) => setOwnerId(e.target.value)}>
              <option value="">Owner: pick from the roster{p.ownerName ? ` (minutes say “${p.ownerName}”)` : ''}</option>
              {people.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
            {workstreams.length > 0 && (
              <select className="pc-line" value={ws} aria-label="Sub-project" onChange={(e) => setWs(e.target.value)}>
                <option value="">No sub-project</option>
                {workstreams.map((w) => <option key={w}>{w}</option>)}
              </select>
            )}
          </>
        )}
        {p.why && !unsure && <span className="pc-why">{p.why}</span>}
      </div>
      {editing ? (
        <div className="stack" style={{ gap: 8 }}>
          <textarea rows={2} value={f.task} onChange={(e) => setF({ ...f, task: e.target.value })} aria-label="Task" />
          <div className="row">
            <input value={f.ownerName} placeholder="Owner" aria-label="Owner" onChange={(e) => setF({ ...f, ownerName: e.target.value })} />
            <input value={f.ownerWith} placeholder="Supported by" aria-label="Supported by" onChange={(e) => setF({ ...f, ownerWith: e.target.value })} />
            <input type="date" value={f.dueOn} aria-label="Due date" onChange={(e) => setF({ ...f, dueOn: e.target.value })} />
          </div>
        </div>
      ) : (
        <div>
          <div className="pc-task">{p.task}</div>
          <div className="small dim">
            <b className="pc-owner">{p.ownerName || 'No owner named'}</b>{p.ownerWith && ` · with ${p.ownerWith}`}
            <span className={p.dueOn && p.dueOn < today ? 'late' : ''}>{p.dueOn ? ` · due ${fmtDate(p.dueOn)}` : ' · no date'}</span>
          </div>
        </div>
      )}
      <div className="row pc-actions">
        <button className="btn small-btn" disabled={busy || (mode === 'tasks' && unsure)} title={mode === 'tasks' && unsure ? 'Pick an owner, and a date under Edit' : undefined} onClick={() => op({
          op: 'acceptProposal', proposalId: p.id, lineId: lineId || null,
          ...(mode === 'tasks' ? { ownerId: ownerId || null, workstream: ws || null } : {}),
          ...(editing ? { task: f.task, ownerName: f.ownerName, ownerWith: f.ownerWith, dueOn: f.dueOn || null } : {}),
        })}>{mode === 'tasks' ? 'Accept as task' : 'Accept'}</button>
        <button className="mini-btn" disabled={busy} onClick={onEdit}>{editing ? 'Done editing' : 'Edit'}</button>
        <button className="mini-btn danger" disabled={busy} onClick={() => op({ op: 'rejectProposal', proposalId: p.id })}>Reject</button>
      </div>
    </div>
  );
}
