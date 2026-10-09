'use client';

import { useRouter } from 'next/navigation';
import { Fragment, useState } from 'react';
import type { PlanState, Project } from '@/lib/plan';
import {
  daysBetween, dueWords, lineLate, needsWhy, nextCheckpoint, ownerPending, sortedCheckpoints, stampRel, STATUSES, targetDate, totalPushes,
  type PlanAction, type PlanLine, type Proposal,
} from '@/lib/planUtil';
import { fmtDate } from '@/lib/time';
import { Avatar } from './chips';
import { ImportPanel, Inbox } from './Minutes';
import { Modal } from './task-ui';

// A partner plan: lines of work, each with an owner on our side, a partner person, a mode,
// checkpoints and a status. Rows open for detail. Every change is one call to
// /api/v1/projects/:id/plan, logged on the server.

type P = { id: string; name: string; role: string; department: string };

// Same words as tasks everywhere else; the stored values stay as they are.
const WORD: Record<string, string> = { 'Not started': 'Not started', 'In progress': 'In progress', Blocked: 'Blocked', Done: 'Done' };

const ST_C: Record<string, string> = { 'Not started': 'var(--black)', 'In progress': 'var(--amber)', Blocked: 'var(--red)', Done: 'var(--green)' };

function Stamp({ on, due, block }: { on: string; due: string | null; block?: boolean }) {
  const r = stampRel(on, due);
  return (
    <span className={`stamp${block ? ' block' : ''}`}>
      Done {fmtDate(on)}{r.rel && <span className={`stamp-rel ${r.kind}`}> · {r.rel}</span>}
    </span>
  );
}

const Pushed = ({ n, was }: { n: number; was: string | null }) =>
  n ? <span className="pushed" title={`Date moved later ${n} ${n === 1 ? 'time' : 'times'}`}>pushed {n}×{was ? ` · was ${fmtDate(was)}` : ''}</span> : null;

export function PlanBoard({ project, state, people, names, meId, today }: {
  project: Project; state: PlanState; people: P[]; names: Record<string, string>; meId: string; today: string;
}) {
  const router = useRouter();
  const partner = project.partnerName ?? 'Partner';
  const [pillar, setPillar] = useState('All');
  const [tile, setTile] = useState<string | null>(null);
  const [who, setWho] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [view, setView] = useState<'pillar' | 'date'>('pillar');
  const [openRows, setOpenRows] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [asking, setAsking] = useState<{ lineId: string; to: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [tab, setTab] = useState<'lines' | 'soon' | 'asks' | 'rhythm' | 'log'>('lines');
  const [addOpen, setAddOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [removedOpen, setRemovedOpen] = useState(false);

  async function op(body: Record<string, unknown>): Promise<boolean> {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/v1/projects/${project.id}/plan`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.message ?? `Request failed (${res.status}).`);
      if (data?.note) setNote(data.note);
      router.refresh();
      return true;
    } catch (e) { setError((e as Error).message); return false; }
    finally { setBusy(false); }
  }

  const { lines, actions } = state;
  const ownerName = (l: PlanLine) => (l.ownerId ? names[l.ownerId] ?? l.ownerId : '');
  const first = (n: string) => n.split(' ')[0].toLowerCase();
  const actionsFor = (lineId: string | null) => actions.filter((a) => (a.lineId ?? null) === lineId);
  const openActions = (lineId: string) => actionsFor(lineId).filter((a) => !a.done).length;

  // Our team: everyone who owns a line, then the rest of the roster.
  const ours = [...new Set(lines.filter((l) => l.ownerId).sort((a, b) => a.num - b.num).map((l) => l.ownerId!))];
  for (const p of people) if (!ours.includes(p.id)) ours.push(p.id);
  const isPartner = (k: string) => project.partnerPeople.includes(k);

  function involves(l: PlanLine, k: string): boolean {
    const nm = isPartner(k) ? k : names[k] ?? k;
    if (actions.some((a) => a.lineId === l.id && !a.done && (a.ownerName === nm || first(a.ownerName) === first(nm)))) return true;
    if (isPartner(k)) return l.partner === k;
    return l.ownerId === k || l.ownerWith.split(/[,;()]/).some((x) => x.trim() === nm || (x.trim() && first(x.trim()) === first(nm)));
  }
  function matches(l: PlanLine, query: string): boolean {
    const hay = [l.what, l.doneDef, l.note, ownerName(l), l.ownerWith, l.partner, l.partnerRole, l.byLabel, `line ${l.num}`,
      ...actionsFor(l.id).map((a) => `${a.task} ${a.ownerName} ${a.ownerWith}`), ...l.checkpoints.map((c) => c.label)].join(' ').toLowerCase();
    return query.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
  }

  const TILES = [
    { key: 'open', label: 'Open', match: (l: PlanLine) => l.status !== 'Done' },
    { key: 'progress', label: 'In progress', match: (l: PlanLine) => l.status === 'In progress' },
    { key: 'late', label: 'Late', match: (l: PlanLine) => lineLate(l, today), warn: true },
    { key: 'pending', label: 'Pending', sub: 'owner missing', match: ownerPending, soft: true },
    { key: 'pushed', label: 'Pushed', sub: 'date moved later', match: (l: PlanLine) => l.status !== 'Done' && totalPushes(l) > 0, amber: true },
    { key: 'done', label: 'Done', match: (l: PlanLine) => l.status === 'Done' },
  ];
  const visible = lines.filter((l) =>
    (pillar === 'All' || l.pillar === pillar) && (!tile || TILES.find((t) => t.key === tile)!.match(l)) && (!who || involves(l, who)) && (!q || matches(l, q)));
  const emptyText = q ? `No lines match “${q}”.` : who ? `No lines for ${isPartner(who) ? who : names[who]} with these filters.` : tile ? 'No lines match that tile right now.' : 'No lines yet.';

  const byNext = (a: PlanLine, b: PlanLine) => {
    const x = a.status === 'Done' ? '~' : nextCheckpoint(a)?.date ?? '9999';
    const y = b.status === 'Done' ? '~' : nextCheckpoint(b)?.date ?? '9999';
    return x < y ? -1 : x > y ? 1 : a.num - b.num;
  };

  // ---------- rows ----------

  function lineRow(l: PlanLine) {
    if (editing === l.id) return <EditLine key={l.id} l={l} project={project} people={people} busy={busy} onCancel={() => setEditing(null)}
      onSave={async (b) => { if (await op({ op: 'editLine', lineId: l.id, ...b })) setEditing(null); }} />;
    if (removing === l.id) return <ReasonRow key={l.id} title={l.what} label="Why is this line being removed? (required)" min={4} go="Remove" busy={busy}
      onCancel={() => setRemoving(null)} onGo={async (reason) => { if (await op({ op: 'removeLine', lineId: l.id, reason })) setRemoving(null); }} />;
    const open = !!openRows[l.id];
    const next = nextCheckpoint(l);
    const cps = l.checkpoints;
    const nm = next?.cpId ? l.checkpoints.find((c) => c.id === next.cpId) : null;
    const toggle = () => setOpenRows({ ...openRows, [l.id]: !open });
    const nAct = openActions(l.id);
    return (
      <Fragment key={l.id}>
        <tr className={`line-row${l.status === 'Done' ? ' done-row' : ''}${open ? ' is-open' : ''}`}
          onClick={(e) => { if (!(e.target as HTMLElement).closest('input,select,textarea,a,button,label')) toggle(); }}>
          <td className="check-cell">
            <input type="checkbox" aria-label={`Mark line ${l.num} done`} checked={l.status === 'Done'} disabled={busy}
              onChange={(e) => (e.target.checked ? op({ op: 'status', lineId: l.id, status: 'Done' }) : setAsking({ lineId: l.id, to: 'In progress' }))} />
          </td>
          <td className="num">{l.num}</td>
          <td className="what">
            <button className="row-open" aria-expanded={open} onClick={toggle}>
              <span className="chev" aria-hidden>{open ? '▾' : '▸'}</span>
              <span className="what-title">{l.what}{nAct > 0 && <span className="act-chip">{nAct} {nAct === 1 ? 'action' : 'actions'}</span>}</span>
            </button>
          </td>
          <td className="owner-td" data-label="Owner">
            {l.ownerId ? <span className="person-cell"><Avatar name={ownerName(l)} />{ownerName(l)}</span> : <span className="tbn">Pending</span>}
            {l.ownerWith && <div className="who-with">with {l.ownerWith}</div>}
          </td>
          <td className="owner-td" data-label={partner}>
            {l.partner ? <div className="pt-name">{l.partner}</div> : <span className="tbn">Pending</span>}
            <span className={`mode${l.mode === 'hands-on' ? '' : ' coach'}`}>{l.mode === 'hands-on' ? 'Hands-on' : 'Coaching'}</span>
          </td>
          <td className="by" data-label="Due">
            {l.status === 'Done'
              ? (l.completedOn ? <Stamp on={l.completedOn} due={targetDate(l)} block /> : <span className="dim">Done</span>)
              : next ? <span className={`by-main${next.date < today ? ' overdue' : ''}`}>{fmtDate(next.date)}</span>
                : <span className="dim small">{l.byLabel || 'No date'}</span>}
            {cps.length > 1 && <span className="ms-count" title="Checkpoints done"> · {cps.filter((c) => c.done).length}/{cps.length}</span>}
            {l.status !== 'Done' && totalPushes(l) > 0 && <div><Pushed n={totalPushes(l)} was={nm ? nm.origDueOn : l.origDueOn} /></div>}
          </td>
          <td>
            <select className="status-sel" value={l.status} disabled={busy} aria-label={`Status of line ${l.num}`}
              style={{ '--c': ST_C[l.status] } as React.CSSProperties}
              onChange={(e) => {
                const s = e.target.value;
                // Blocked, back to not started and reopening ask why; the rest is one click.
                if (!needsWhy(l.status, s)) { op({ op: 'status', lineId: l.id, status: s }); return; }
                setAsking({ lineId: l.id, to: s });
              }}>
              {STATUSES.map((s) => <option key={s} value={s}>{WORD[s]}</option>)}
            </select>
          </td>
          <td className="act-cell">
            <span className="row-actions">
              <button className="row-btn" title="Edit line" aria-label={`Edit line ${l.num}`} onClick={() => { setEditing(l.id); setRemoving(null); }}>✎</button>
              <button className="row-btn del" title="Remove line" aria-label={`Remove line ${l.num}`} onClick={() => { setRemoving(l.id); setEditing(null); }}>✕</button>
            </span>
          </td>
        </tr>
        {asking?.lineId === l.id && (
          <ReasonRow
            title={asking.to === 'Blocked' ? `Why is line ${l.num} blocked?` : `Line ${l.num}: changing to “${WORD[asking.to]}”`}
            label={asking.to === 'Blocked' ? 'Block reason (10 to 280 characters)' : 'Why? (10 to 280 characters)'}
            min={10} go={asking.to === 'Blocked' ? 'Mark blocked' : `Set ${WORD[asking.to].toLowerCase()}`} busy={busy}
            onCancel={() => setAsking(null)} onGo={async (reason) => { if (await op({ op: 'status', lineId: l.id, status: asking.to, reason })) setAsking(null); }} />
        )}
        {open && (
          <tr className="detail-row">
            <td colSpan={8}>
              <div className="detail-grid">
                <div>
                  {l.doneDef && <div className="d-block"><div className="d-label">Done looks like</div><p>{l.doneDef}</p></div>}
                  {l.note && <div className="d-block"><div className="d-label">Note</div><p className="what-note">{l.note}</p></div>}
                  {!l.doneDef && !l.note && <p className="dim small">No detail yet. Use ✎ to add what done looks like.</p>}
                </div>
                <div>
                  {l.partnerRole && <div className="d-block"><div className="d-label">{partner}’s role</div><p>{l.partnerRole}</p></div>}
                </div>
                <div>
                  {cps.length > 0 ? (
                    <div className="d-block"><div className="d-label">Checkpoints</div>
                      <ul className="ms">
                        {sortedCheckpoints(l).map((c) => (
                          <li key={c.id} className={`${c.done ? 'ticked' : ''}${next?.cpId === c.id && l.status !== 'Done' ? ' next' : ''}${!c.done && c.dueOn && c.dueOn < today ? ' late' : ''}`}>
                            <input type="checkbox" checked={c.done} disabled={busy} aria-label={`Tick checkpoint ${c.label}`}
                              onChange={(e) => op({ op: 'tickCheckpoint', lineId: l.id, cpId: c.id, done: e.target.checked })} />
                            <span>
                              <span className="ms-date">{c.dueOn ? fmtDate(c.dueOn) : 'No date'} </span><span className="ms-label">{c.label}</span>
                              {c.done && c.doneOn && <span className="ms-stamp"><Stamp on={c.doneOn} due={c.origDueOn ?? c.dueOn} /></span>}
                              {!c.done && c.pushCount > 0 && <span className="ms-stamp"><Pushed n={c.pushCount} was={c.origDueOn} /></span>}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : !l.dueOn && l.byLabel ? <div className="d-block"><div className="d-label">Timing</div><p>{l.byLabel}</p></div> : null}
                </div>
              </div>
              {actionsFor(l.id).length > 0 && (
                <div className="d-block" style={{ marginTop: 14 }}>
                  <div className="d-label">Actions from meetings</div>
                  <ActionList list={actionsFor(l.id)} busy={busy} today={today} op={op} />
                </div>
              )}
            </td>
          </tr>
        )}
      </Fragment>
    );
  }

  const table = (ls: PlanLine[], empty: string) => (
    <div className="card table-card plan-wrap">
      <table className="plan">
        <colgroup><col className="c-check" /><col className="c-num" /><col /><col className="c-owner" /><col className="c-partner" /><col className="c-due" /><col className="c-status" /><col className="c-act" /></colgroup>
        <thead>
          <tr>
            <th aria-label="Done" /><th>#</th><th>What</th>
            <th>Our owner</th>
            <th>{partner}</th><th>Due date</th><th>Status</th><th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>{ls.length ? ls.map(lineRow) : <tr><td colSpan={8} className="empty-cell">{empty}</td></tr>}</tbody>
      </table>
    </div>
  );

  let board: React.ReactNode;
  if (view === 'date') board = table([...visible].sort(byNext), emptyText);
  else {
    const groups = project.pillars.map((p) => ({ p, ls: visible.filter((l) => l.pillar === p.key).sort((a, b) => a.num - b.num) })).filter((g) => g.ls.length);
    board = groups.length ? groups.map((g) => <Fragment key={g.p.key}><h3 className="pillar">{g.p.label}</h3>{table(g.ls, '')}</Fragment>) : table([], emptyText);
  }

  const other = actionsFor(null).filter((a) =>
    (!who || a.ownerName === (isPartner(who) ? who : names[who]) || a.ownerWith.includes(isPartner(who) ? who : names[who] ?? '')) &&
    (!q || `${a.task} ${a.ownerName} ${a.ownerWith}`.toLowerCase().includes(q.toLowerCase())));

  const counts = { open: lines.filter((l) => l.status !== 'Done').length, done: lines.filter((l) => l.status === 'Done').length, late: lines.filter((l) => lineLate(l, today)).length };
  const pct = lines.length ? Math.round((100 * counts.done) / lines.length) : 0;
  const openAsks = state.asks.filter((a) => !a.done).length;
  const filtered = !!(q || who || tile || pillar !== 'All');
  const TABS: [typeof tab, string][] = [['lines', 'Lines'], ['soon', 'Next two weeks'], ['asks', `Asks${openAsks ? ` (${openAsks})` : ''}`], ['rhythm', 'Rhythm and parked'], ['log', 'Log']];

  return (
    <div className="plan-board calm">
      <div className="progress-line">
        <div className="pbar" aria-hidden><span style={{ width: `${pct}%` }} /></div>
        <span><b>{counts.done}</b> of {lines.length} lines done · <b>{counts.open}</b> open{counts.late > 0 && <span className="late-text"> · <b>{counts.late}</b> overdue</span>}</span>
      </div>

      <nav className="tabs" aria-label="Plan sections">
        {TABS.map(([k, label]) => <button key={k} className="tab" aria-pressed={tab === k} onClick={() => setTab(k)}>{label}</button>)}
      </nav>

      {(error || note) && <p className={error ? 'err banner' : 'ok banner'} role={error ? 'alert' : 'status'}>{error ?? note}</p>}

      {tab === 'lines' && (
        <>
          <div className="toolbar2">
            <input type="search" className="search" placeholder="Search lines" aria-label="Search lines" value={q} onChange={(e) => setQ(e.target.value)} />
            <select value={who ?? ''} aria-label="Person" onChange={(e) => setWho(e.target.value || null)}>
              <option value="">Everyone</option>
              <optgroup label="Our team">{ours.filter((id) => lines.some((l) => l.ownerId === id)).map((id) => <option key={id} value={id}>{names[id]}</option>)}</optgroup>
              <optgroup label={partner}>{project.partnerPeople.map((n) => <option key={n} value={n}>{n}</option>)}</optgroup>
            </select>
            <select value={pillar} aria-label="Pillar" onChange={(e) => setPillar(e.target.value)}>
              <option value="All">All pillars</option>{project.pillars.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
            <select value={tile ?? ''} aria-label="Show" onChange={(e) => setTile(e.target.value || null)}>
              <option value="">All lines</option>{TILES.map((t) => <option key={t.key} value={t.key}>{t.label}{t.sub ? ` (${t.sub})` : ''}</option>)}
            </select>
            <span className="seg" role="group" aria-label="Order lines">
              <button aria-pressed={view === 'pillar'} onClick={() => setView('pillar')}>By pillar</button>
              <button aria-pressed={view === 'date'} onClick={() => setView('date')}>By date</button>
            </span>
            {filtered && <button className="act" onClick={() => { setQ(''); setWho(null); setTile(null); setPillar('All'); }}>Clear</button>}
            <span className="toolbar-end">
              <button className="btn" onClick={() => setAddOpen(true)}>+ Add line</button>
              <span className="menu-wrap">
                <button className="btn ghost icon-btn" aria-label="More" aria-expanded={menu} onClick={() => setMenu(!menu)}>⋯</button>
                {menu && (
                  <div className="menu" role="menu" onMouseLeave={() => setMenu(false)}>
                    <button role="menuitem" onClick={() => { setImportOpen(true); setMenu(false); }}>Import meeting minutes</button>
                    <button role="menuitem" onClick={() => { setTab('log'); setMenu(false); }}>Update log</button>
                  </div>
                )}
              </span>
            </span>
          </div>

          {state.proposals.length > 0 && !reviewing && (
            <button className="notice-bar" onClick={() => setReviewing(true)}>
              <b>{state.proposals.length} proposed {state.proposals.length === 1 ? 'action' : 'actions'}</b> from meeting minutes are waiting for review <span className="act">Review</span>
            </button>
          )}
          {reviewing && state.proposals.length > 0 && <Inbox mode="plan" proposals={state.proposals} lines={lines} busy={busy} today={today} op={op} />}

          {board}

          {other.length > 0 && (<><h3 className="pillar">Other actions</h3><div className="card card-pad"><ActionList list={other} busy={busy} today={today} op={op} /></div></>)}

          {state.removed.length > 0 && (
            <section className="group">
              <button className="log-toggle small-toggle" aria-expanded={removedOpen} onClick={() => setRemovedOpen(!removedOpen)}>
                <span aria-hidden>{removedOpen ? '▾' : '▸'}</span> Removed lines <span className="count-badge">{state.removed.length}</span>
              </button>
              {removedOpen && (
                <div className="removed-list">
                  {state.removed.map((l) => (
                    <div key={l.id} className="card removed-row">
                      <div>
                        <div className="removed-task">{l.num}. {l.what}</div>
                        <div className="removed-meta">{l.removedBy ? names[l.removedBy] ?? 'Someone' : 'Someone'} removed this{l.removedAt ? ` on ${fmtDate(l.removedAt.slice(0, 10))}` : ''}: <em>{l.removeReason}</em></div>
                      </div>
                      <button className="btn ghost" disabled={busy} onClick={() => op({ op: 'restoreLine', lineId: l.id })}>Restore</button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}

      {tab === 'soon' && <section className="card panel"><TwoWeeks project={project} state={state} names={names} today={today} /></section>}

      {tab === 'asks' && (
        <section className="card panel">
          <p className="sub">What {partner} needs from us. Tick each off as it happens.</p>
          {state.asks.length === 0 ? <p className="empty">No asks recorded.</p> : (
            <div className="ask-list">
              {state.asks.map((a) => {
                const late = !a.done && !!a.dueOn && a.dueOn < today;
                return (
                  <label key={a.id} className={`ask-card${a.done ? ' ticked' : ''}`}>
                    <input type="checkbox" checked={a.done} disabled={busy} onChange={(e) => op({ op: 'tickAsk', askId: a.id, done: e.target.checked })} />
                    <span className="ask-body">
                      <span className="ask-head">
                        <span className="ask-title">{a.short}</span>
                        {a.dueOn ? (a.done && a.doneOn ? <span className="ask-pill done"><Stamp on={a.doneOn} due={a.dueOn} /></span>
                          : <span className={`ask-pill${late ? ' late' : ''}`}>Due {fmtDate(a.dueOn)}{a.done ? '' : ` · ${dueWords(a.dueOn, today)}`}</span>)
                          : a.checkpoints.length === 0 && <span className="ask-pill quiet">Ongoing</span>}
                      </span>
                      <span className="ask-text">{a.text}</span>
                      {a.checkpoints.length > 0 && (
                        <span className="ask-chips">
                          {[...a.checkpoints].sort((x, y) => x.date.localeCompare(y.date)).map((m) => (
                            <span key={m.label} className={`ask-chip${!a.done && m.date < today ? ' late' : ''}`}><span className="ask-chip-date">{fmtDate(m.date)}</span>{m.label}</span>
                          ))}
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </section>
      )}

      {tab === 'rhythm' && (
        <div className="panels" style={{ marginTop: 0 }}>
          <section className="card panel">
            <h2>How we’ll run it</h2>
            {project.cadence.length === 0 ? <p className="empty">Not recorded yet.</p> : (
              <div className="cad-list">
                {project.cadence.map((c, i) => (
                  <div key={i} className="cad-row">
                    <div className="cad-when"><span className="cad-day">{c.day}</span>{c.time && <span className="cad-time">{c.time}</span>}</div>
                    <div><div className="cad-what">{c.what}</div>{c.detail && <div className="cad-detail">{c.detail}</div>}</div>
                    {c.until ? <span className="cad-until">until {c.until}</span> : <span />}
                  </div>
                ))}
              </div>
            )}
          </section>
          <section className="card panel">
            <h2>Parked, by choice</h2>
            {state.parked.length === 0 ? <p className="empty">Nothing parked.</p> : <ul className="parked-list">{state.parked.map((p) => <li key={p}>{p}</li>)}</ul>}
          </section>
        </div>
      )}

      {tab === 'log' && (
        <div className="card card-pad">
          {state.activity.length === 0 ? <p className="empty">No updates logged yet.</p> : (
            <ol className="log">
              {state.activity.map((a) => (
                <li key={a.id}><span className="when">{fmtDate(a.at.slice(0, 10))}</span><span><b>{a.actorName ?? 'Someone'}</b> {a.summary}</span></li>
              ))}
            </ol>
          )}
        </div>
      )}

      {addOpen && (
        <Modal title="Add a line" onClose={() => setAddOpen(false)} wide>
          <AddLine project={project} people={people} pillar={pillar} busy={busy} op={async (b) => { const ok = await op(b); if (ok) setAddOpen(false); return ok; }} />
        </Modal>
      )}
      {importOpen && (
        <Modal title="Import meeting minutes" onClose={() => setImportOpen(false)} wide>
          <ImportPanel what="plan" busy={busy} today={today} onRead={async (b) => { if (await op({ op: 'importMinutes', ...b })) { setImportOpen(false); setReviewing(true); } }} />
        </Modal>
      )}
    </div>
  );
}

// ---------- pieces ----------

type Op = (b: Record<string, unknown>) => Promise<boolean>;

function ActionList({ list, busy, today, op }: { list: PlanAction[]; busy: boolean; today: string; op: Op }) {
  const [armed, setArmed] = useState<string | null>(null);
  return (
    <ul className="acts">
      {list.map((a) => (
        <li key={a.id} className={a.done ? 'ticked' : ''}>
          <input type="checkbox" checked={a.done} disabled={busy} aria-label="Mark action done" onChange={(e) => op({ op: 'tickAction', actionId: a.id, done: e.target.checked })} />
          <div className="act-main">
            <div className="act-task">{a.task}</div>
            <div className="act-meta">
              <b>{a.ownerName || 'No owner'}</b>{a.ownerWith && ` · with ${a.ownerWith}`}
              {a.done && a.doneOn ? <> · <Stamp on={a.doneOn} due={a.dueOn} /></> : a.dueOn && <span className={a.dueOn < today ? 'late' : ''}> · due {fmtDate(a.dueOn)}</span>}
              {a.source.title && <span className="act-src"> · {a.source.title}{a.source.date ? `, ${fmtDate(a.source.date)}` : ''}</span>}
            </div>
          </div>
          <button className={`row-btn del${armed === a.id ? ' armed' : ''}`} disabled={busy} aria-label="Remove action"
            onClick={() => { if (armed === a.id) { op({ op: 'removeAction', actionId: a.id }); setArmed(null); } else { setArmed(a.id); setTimeout(() => setArmed(null), 4000); } }}>
            {armed === a.id ? 'Remove?' : '✕'}
          </button>
        </li>
      ))}
    </ul>
  );
}

function ReasonRow({ title, label, min, go, busy, onCancel, onGo }: {
  title: string; label: string; min: number; go: string; busy: boolean; onCancel: () => void; onGo: (reason: string) => void;
}) {
  const [r, setR] = useState('');
  const ok = r.trim().length >= min;
  return (
    <tr className="prompt-row">
      <td colSpan={8}>
        <div className="prompt">
          <div className="small"><b>{title}</b></div>
          <div className="row">
            <label className="f"><span>{label}</span>
              <input autoFocus maxLength={280} value={r} onChange={(e) => setR(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && ok) onGo(r.trim()); if (e.key === 'Escape') onCancel(); }} />
            </label>
            <span className="row" style={{ flex: 'none' }}>
              <button className="btn danger" disabled={!ok || busy} onClick={() => onGo(r.trim())}>{go}</button>
              <button className="btn ghost" onClick={onCancel}>Cancel</button>
            </span>
          </div>
        </div>
      </td>
    </tr>
  );
}

function EditLine({ l, project, people, busy, onCancel, onSave }: {
  l: PlanLine; project: Project; people: P[]; busy: boolean; onCancel: () => void; onSave: (b: Record<string, unknown>) => void;
}) {
  const [f, setF] = useState({
    what: l.what, doneDef: l.doneDef, note: l.note, ownerId: l.ownerId ?? '', ownerWith: l.ownerWith, partner: l.partner,
    partnerRole: l.partnerRole, mode: l.mode, dueOn: l.dueOn ?? '', byLabel: l.byLabel, dateReason: '',
  });
  const [cps, setCps] = useState(l.checkpoints.map((c) => ({ id: c.id as string | undefined, label: c.label, dueOn: c.dueOn ?? '', key: c.id })));
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  // Show the reason box as soon as any date moves later; the server decides if it counts.
  const pushed = (!!l.dueOn && !!f.dueOn && f.dueOn > l.dueOn) ||
    cps.some((c) => { const o = l.checkpoints.find((x) => x.id === c.id); return !!o?.dueOn && !!c.dueOn && c.dueOn > o.dueOn; });
  return (
    <tr className="editing-row">
      <td colSpan={8}>
        <div className="edit-grid plan-edit">
          <label className="f wide"><span>What</span><input value={f.what} maxLength={200} onChange={set('what')} /></label>
          <label className="f wide"><span>Done looks like</span><textarea value={f.doneDef} maxLength={600} rows={2} onChange={set('doneDef')} /></label>
          <label className="f wide"><span>Note (one line: blocker or dependency)</span><input value={f.note} maxLength={160} onChange={set('note')} /></label>
          <label className="f"><span>Our owner</span>
            <select value={f.ownerId} onChange={set('ownerId')}><option value="">Pending</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          </label>
          <label className="f"><span>With</span><input value={f.ownerWith} placeholder="Others involved" onChange={set('ownerWith')} /></label>
          <label className="f"><span>{project.partnerName ?? 'Partner'} owner</span>
            <select value={f.partner} onChange={set('partner')}><option value="">Pending</option>{project.partnerPeople.map((n) => <option key={n}>{n}</option>)}</select>
          </label>
          <label className="f"><span>Mode</span>
            <select value={f.mode} onChange={set('mode')}><option value="coaching">Coaching</option><option value="hands-on">Hands-on</option></select>
          </label>
          <label className="f wide"><span>What they do</span><textarea value={f.partnerRole} rows={2} maxLength={400} onChange={set('partnerRole')} /></label>
          <label className="f"><span>Due date</span><input type="date" value={f.dueOn} onChange={set('dueOn')} /></label>
          <label className="f"><span>Or a no-date label</span><input value={f.byLabel} placeholder="e.g. Through OND" maxLength={80} onChange={set('byLabel')} /></label>
          <div className="f wide">
            <span className="flabel">Checkpoints</span>
            {cps.map((c, i) => (
              <div key={c.key} className="ms-ed">
                <input value={c.label} placeholder="Checkpoint" aria-label="Checkpoint" onChange={(e) => setCps(cps.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                <input type="date" value={c.dueOn} aria-label="Checkpoint date" onChange={(e) => setCps(cps.map((x, j) => (j === i ? { ...x, dueOn: e.target.value } : x)))} />
                <button type="button" className="row-btn del" aria-label="Remove checkpoint" onClick={() => setCps(cps.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
            <button type="button" className="mini-btn" onClick={() => setCps([...cps, { id: undefined, label: '', dueOn: '', key: `new${Date.now()}` }])}>+ Add checkpoint</button>
          </div>
          {pushed && (
            <label className="f wide"><span>Why the date moved later (kept in the log; the first date stays on record)</span>
              <input value={f.dateReason} maxLength={280} onChange={set('dateReason')} />
            </label>
          )}
          <span className="row wide">
            <button className="btn" disabled={busy || f.what.trim().length < 2} onClick={() => onSave({
              what: f.what, doneDef: f.doneDef, note: f.note, ownerId: f.ownerId || null, ownerWith: f.ownerWith, partner: f.partner,
              partnerRole: f.partnerRole, mode: f.mode, dueOn: f.dueOn || null, byLabel: f.byLabel,
              checkpoints: cps.map((c) => ({ ...(c.id ? { id: c.id } : {}), label: c.label, dueOn: c.dueOn || null })),
              ...(f.dateReason.trim() ? { dateReason: f.dateReason } : {}),
            })}>Save line</button>
            <button className="btn ghost" onClick={onCancel}>Cancel</button>
          </span>
        </div>
      </td>
    </tr>
  );
}

function AddLine({ project, people, pillar, busy, op }: { project: Project; people: P[]; pillar: string; busy: boolean; op: Op }) {
  const blank = { pillar: pillar !== 'All' ? pillar : project.pillars[0]?.key ?? '', what: '', doneDef: '', ownerId: '', partner: '', partnerRole: '', dueOn: '' };
  const [f, setF] = useState(blank);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <form className="stack" onSubmit={async (e) => {
      e.preventDefault();
      if (await op({ op: 'addLine', ...f, ownerId: f.ownerId || null, dueOn: f.dueOn || null })) setF(blank);
    }}>
      <div className="row">
        <label className="f"><span>Pillar</span><select value={f.pillar} onChange={set('pillar')}>{project.pillars.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}</select></label>
        <label className="f"><span>Our owner</span><select value={f.ownerId} onChange={set('ownerId')}><option value="">Pending</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label className="f"><span>{project.partnerName ?? 'Partner'} owner</span><select value={f.partner} onChange={set('partner')}><option value="">Pending</option>{project.partnerPeople.map((n) => <option key={n}>{n}</option>)}</select></label>
        <label className="f" style={{ flex: '0 1 170px' }}><span>Due date</span><input type="date" value={f.dueOn} onChange={set('dueOn')} /></label>
      </div>
      <label className="f"><span>What</span><input required value={f.what} maxLength={200} placeholder="Short title, e.g. “Context files”" onChange={set('what')} /></label>
      <label className="f"><span>Done looks like</span><input value={f.doneDef} maxLength={600} placeholder="One or two short sentences" onChange={set('doneDef')} /></label>
      <label className="f"><span>{project.partnerName ?? 'Partner'} role</span><input value={f.partnerRole} maxLength={400} placeholder="What they do to support" onChange={set('partnerRole')} /></label>
      <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn" disabled={busy || !f.what.trim()}>Add line</button></div>
    </form>
  );
}

function TwoWeeks({ project, state, names, today }: { project: Project; state: PlanState; names: Record<string, string>; today: string }) {
  const horizon = new Date(Date.parse(`${today}T00:00:00Z`) + 14 * 86400000).toISOString().slice(0, 10);
  type Item = { date: string; title: string; sub: string; who: string };
  const items: Item[] = [];
  for (const l of state.lines) {
    if (l.status === 'Done') continue;
    const owner = l.ownerId ? names[l.ownerId] : 'Owner pending';
    const cps = sortedCheckpoints(l).filter((c) => !c.done && c.dueOn);
    if (cps.length) cps.forEach((c) => items.push({ date: c.dueOn!, title: c.label, sub: `${l.what} · Line ${l.num}`, who: owner }));
    else if (l.dueOn) items.push({ date: l.dueOn, title: l.what, sub: `Line ${l.num}`, who: owner });
  }
  for (const a of state.asks) {
    if (a.done) continue;
    const from = `Ask from ${project.partnerName ?? 'the partner'}`;
    if (a.checkpoints.length) a.checkpoints.forEach((m) => items.push({ date: m.date, title: `${a.short}: ${m.label}`, sub: from, who: a.ownerName || 'Our asks' }));
    else if (a.dueOn) items.push({ date: a.dueOn, title: a.short, sub: from, who: a.ownerName || 'Our asks' });
  }
  for (const a of state.actions) {
    if (a.done || !a.dueOn) continue;
    const ln = state.lines.find((l) => l.id === a.lineId);
    items.push({ date: a.dueOn, title: a.task, sub: `Action · ${ln ? `${ln.what} · Line ${ln.num}` : 'Other actions'}`, who: a.ownerName || 'No owner' });
  }
  const list = items.filter((i) => i.date <= horizon).sort((a, b) => a.date.localeCompare(b.date));
  if (!list.length) return <p className="empty">Nothing due in the next two weeks.</p>;
  const late = list.filter((i) => i.date < today).length;
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay();
  const weekEnd = new Date(Date.parse(`${today}T00:00:00Z`) + ((7 - dow) % 7) * 86400000).toISOString().slice(0, 10);
  const groups = [
    { name: 'Overdue', cls: 'late', items: list.filter((i) => i.date < today) },
    { name: 'This week', cls: '', items: list.filter((i) => i.date >= today && i.date <= weekEnd) },
    { name: 'Next week', cls: '', items: list.filter((i) => i.date > weekEnd) },
  ].filter((g) => g.items.length);
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return (
    <>
      <p className="sub">Checkpoints due by {fmtDate(horizon)}, plus anything already late.</p>
      <div className="tw-summary">
        {late > 0 && <span className="tw-chip late">{late} overdue</span>}
        <span className="tw-chip">{list.length - late} coming up</span>
        <span className="tw-chip quiet">across {new Set(list.map((i) => i.who)).size} owners</span>
      </div>
      <div className="tw-grid">
        {groups.map((g) => (
          <div key={g.name} className={`tw-card ${g.cls}`}>
            <div className="tw-head"><span className="tw-name">{g.name}</span><span className="tw-count">{g.items.length}</span></div>
            {g.items.map((i, k) => {
              const same = k > 0 && g.items[k - 1].date === i.date;
              const n = daysBetween(today, i.date);
              return (
                <div key={k} className={`tw-row${i.date < today ? ' late' : ''}`}>
                  {same ? <span /> : <div className="tw-date"><span className="tw-day">{Number(i.date.slice(8, 10))}</span><span className="tw-mon">{M[Number(i.date.slice(5, 7)) - 1]}</span></div>}
                  <div className="tw-body"><div className="tw-title">{i.title}</div><div className="tw-sub"><b>{i.who}</b> · {i.sub}</div></div>
                  <span className="tw-when">{same ? '' : n < 0 ? `${-n} day${n === -1 ? '' : 's'} late` : n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : `In ${n} days`}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}
