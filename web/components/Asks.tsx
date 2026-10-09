'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { AskItem } from '@/lib/service';
import { fmtDate } from '@/lib/time';
import { api } from './task-ui';
import { arrivals, usePreviousWhileChanging } from './motion';
import s from './Asks.module.css';

// v2 /me: the ask is the central object. "Asked of you" waits for your answer. "You asked" shows
// where each ask you made stands. Every answer goes through /api/v1 and lands in the events log.

type Mode = null | 'counter' | 'cant';

const WORD: Record<string, string> = { asked: 'Waiting for an answer', countered: 'Proposed another date', accepted: 'Agreed', declined: 'Declined', cant: 'Can’t' };
const TONE: Record<string, string> = { asked: 'idle', countered: 'risk', accepted: 'ok', declined: 'quiet', cant: 'late' };

function first(names: Record<string, string>, id: string | null) {
  return (id && names[id]?.split(' ')[0]) || 'Someone';
}

function StatePill({ state }: { state: string }) {
  const from = usePreviousWhileChanging(state, 140);
  return <span className={`st tone-${TONE[state]}${from !== undefined ? ' state-set' : ''}`}>{WORD[state]}</span>;
}

function OfMeRow({ a, today, names }: { a: AskItem; today: string; names: Record<string, string> }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  const [counterOn, setCounterOn] = useState('');
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [arrive] = useState(() => arrivals.delete(a.id));
  const asked = a.ask!.requestedOn;

  async function send(body: Record<string, unknown>) {
    setBusy(true); setErr(null);
    try { await api(`/tasks/${a.id}/answer`, 'POST', { version: a.version, ...body }); router.refresh(); }
    catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  return (
    <li className={`${s.item}${arrive ? ' arrive' : ''}`} data-ask={a.id}>
      <div className={s.top}>
        <div className={s.what}>
          <span className={s.title}>{a.title}</span>
          <span className={s.who}>{first(names, a.ask!.askedBy)} asks for it by</span>
        </div>
        <span className={s.date}>{fmtDate(asked)}</span>
      </div>
      {mode === null && (
        <div className={s.actions}>
          <button className="btn" disabled={busy} onClick={() => send({ answer: 'yes' })}>Yes, by then</button>
          <button className="btn ghost" disabled={busy} onClick={() => setMode('counter')}>Not by then</button>
          <button className="btn ghost" disabled={busy} onClick={() => setMode('cant')}>Can’t</button>
        </div>
      )}
      {mode === 'counter' && (
        <form className={s.form} onSubmit={(e) => { e.preventDefault(); send({ answer: 'counter', counterOn, ...(note.trim() ? { reason: note.trim() } : {}) }); }}>
          <label className="f"><span>I can do it by</span>
            <input type="date" required min={today} value={counterOn} onChange={(e) => setCounterOn(e.target.value)} />
          </label>
          <label className="f"><span>Why (optional)</span>
            <input type="text" maxLength={280} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <div className={s.actions}>
            <button className="btn" disabled={busy || !counterOn || counterOn === asked}>Send date</button>
            <button type="button" className="btn ghost" disabled={busy} onClick={() => setMode(null)}>Back</button>
          </div>
        </form>
      )}
      {mode === 'cant' && (
        <form className={s.form} onSubmit={(e) => { e.preventDefault(); send({ answer: 'cant', reason: reason.trim() }); }}>
          <label className="f"><span>Why not</span>
            <input type="text" required minLength={10} maxLength={280} value={reason} placeholder="A short reason, at least 10 characters" onChange={(e) => setReason(e.target.value)} />
          </label>
          <div className={s.actions}>
            <button className="btn" disabled={busy || reason.trim().length < 10}>Send</button>
            <button type="button" className="btn ghost" disabled={busy} onClick={() => setMode(null)}>Back</button>
          </div>
        </form>
      )}
      {err && <p className="err">{err}</p>}
    </li>
  );
}

function ByMeRow({ a, names }: { a: AskItem; names: Record<string, string> }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [arrive] = useState(() => arrivals.delete(a.id));
  const k = a.ask!;

  async function decide(accept: boolean) {
    setBusy(true); setErr(null);
    try { await api(`/tasks/${a.id}/counter`, 'POST', { version: a.version, accept }); router.refresh(); }
    catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  const line =
    k.state === 'asked' ? `Waiting for ${first(names, a.ownerId)} to answer. You asked for ${fmtDate(k.requestedOn)}.`
    : k.state === 'countered' ? `${first(names, a.ownerId)} can do ${fmtDate(k.counterOn!)}, not ${fmtDate(k.requestedOn)}.${k.reason ? ` ${k.reason}` : ''}`
    : k.state === 'accepted' ? `${first(names, a.ownerId)} is on it, due ${fmtDate(a.dueOn)}. It is on their desk.`
    : k.state === 'cant' ? `${first(names, a.ownerId)} can’t. ${k.reason ?? ''}`
    : `You declined ${fmtDate(k.counterOn ?? k.requestedOn)}. It did not become a task.`;

  return (
    <li className={`${s.item}${arrive ? ' arrive' : ''}`} data-ask={a.id}>
      <div className={s.top}>
        <div className={s.what}>
          <span className={s.title}>{a.title}</span>
          <span className={s.who}>To {first(names, a.ownerId)}</span>
        </div>
        <StatePill state={k.state} />
      </div>
      <p className={s.line}>{line}</p>
      {k.state === 'countered' && (
        <div className={s.actions}>
          <button className="btn" disabled={busy} onClick={() => decide(true)}>Accept {fmtDate(k.counterOn!)}</button>
          <button className="btn ghost" disabled={busy} onClick={() => decide(false)}>Decline</button>
        </div>
      )}
      {err && <p className="err">{err}</p>}
    </li>
  );
}

export function Asks({ ofMe, byMe, today, names }: { ofMe: AskItem[]; byMe: AskItem[]; today: string; names: Record<string, string> }) {
  if (!ofMe.length && !byMe.length) return null;
  return (
    <div className={s.wrap}>
      {ofMe.length > 0 && (
        <section className={s.sect} aria-labelledby="asks-of-me">
          <h2 id="asks-of-me" className={s.h}>Asked of you <span className="dim">{ofMe.length}</span></h2>
          <ul className={s.list}>{ofMe.map((a) => <OfMeRow key={a.id} a={a} today={today} names={names} />)}</ul>
        </section>
      )}
      {byMe.length > 0 && (
        <section className={s.sect} aria-labelledby="asks-by-me">
          <h2 id="asks-by-me" className={s.h}>You asked <span className="dim">{byMe.length}</span></h2>
          <ul className={s.list}>{byMe.map((a) => <ByMeRow key={a.id} a={a} names={names} />)}</ul>
        </section>
      )}
    </div>
  );
}
