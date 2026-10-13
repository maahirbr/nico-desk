'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Agenda } from '@/lib/meetings';
import { EVERY_WORDS, MEET_EVERY, nextMeetingDate, snapToDay, WEEKDAYS, weekdayOf, type Rhythm } from '@/lib/meetDates';
import type { MeetEvery } from '@/lib/plan';
import { fmtDate } from '@/lib/time';
import { DateField } from './DateField';
import { Help } from './HelpMode';
import { useReadOnly } from './readonly';
import { Select } from './Select';
import { api } from './task-ui';
import { notify } from './toast';

// The project's meeting: how often it meets, the next date, and the agenda worked out from the board
// (lib/meetings.ts, no model). Write the minutes opens the same import the board already has. Meeting held
// records today and moves the next date on. Both setting the rhythm and marking held are for the project owner,
// its lead, a team lead or an admin (`canRun`); the server checks the same rule.

export const IMPORT_EVENT = 'nd:import-minutes';

const EVERY_VALUES = [...MEET_EVERY, 'none'] as const;
const EVERY_LABEL: Record<MeetEvery | 'none', string> = { ...EVERY_WORDS, none: 'No rhythm' };

function rhythmWords(r: Rhythm): string {
  if (!r.meetEvery) return 'No meeting rhythm yet';
  const day = r.meetDay ? WEEKDAYS[r.meetDay - 1] : null;
  if (r.meetEvery === 'weekly') return day ? `Every ${day}` : 'Every week';
  if (r.meetEvery === 'fortnightly') return day ? `Every other ${day}` : 'Every two weeks';
  if (r.meetEvery === 'monthly') return day ? `Every month, on a ${day}` : 'Every month';
  return 'As needed';
}

function RhythmForm({ projectId, rhythm, today, onDone }: { projectId: string; rhythm: Rhythm; today: string; onDone: () => void }) {
  const router = useRouter();
  const [every, setEvery] = useState<MeetEvery | 'none'>(rhythm.meetEvery ?? 'weekly');
  const [day, setDay] = useState<number | null>(rhythm.meetDay);
  const [next, setNext] = useState(nextMeetingDate(rhythm, today) ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const timed = every !== 'none' && every !== 'as_needed';

  const pickDay = (v: string) => {
    const d = v === 'any' ? null : Number(v);
    setDay(d);
    // The date has to fall on the weekday, so move it to the next one.
    if (d && next) setNext(snapToDay(next, d));
  };
  const pickNext = (v: string) => {
    setNext(v);
    if (v && timed && day) setDay(weekdayOf(v)); // the date wins: the weekday follows it
  };
  const save = async () => {
    setBusy(true); setErr(null);
    try {
      await api(`/projects/${projectId}/meeting`, 'PUT', every === 'none'
        ? { every: null }
        : { every, day: timed ? day : null, next: next || null });
      notify(every === 'none' ? 'Meeting rhythm cleared' : 'Meeting rhythm saved');
      onDone();
      router.refresh();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="meet-form">
      <div className="row">
        <label className="f"><span>How often</span>
          <Select value={every} onChange={(v) => setEvery(v as MeetEvery | 'none')}>
            {EVERY_VALUES.map((k) => <option key={k} value={k}>{EVERY_LABEL[k]}</option>)}
          </Select>
        </label>
        {timed && (
          <label className="f"><span>Day</span>
            <Select value={day ? String(day) : 'any'} onChange={pickDay}>
              <option value="any">Any day</option>
              {WEEKDAYS.map((w, i) => <option key={w} value={i + 1}>{w}</option>)}
            </Select>
          </label>
        )}
        {every !== 'none' && (
          <label className="f"><span>Next meeting</span>
            <DateField value={next} min={today} onChange={(e) => pickNext(e.target.value)} />
          </label>
        )}
      </div>
      {every !== 'none' && <p className="hint">{every === 'as_needed' ? 'As needed has no automatic date. Add one only if you know it.' : 'Leave the date empty and the app works it out.'}</p>}
      {err && <p className="err" role="alert">{err}</p>}
      <div className="row meet-form-actions">
        <button className="btn ghost" onClick={onDone} disabled={busy}>Cancel</button>
        <button className="btn" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
    </div>
  );
}

export function MeetingSection({ projectId, kind, rhythm, agenda, canRun, today }: {
  projectId: string; kind: 'tasks' | 'plan'; rhythm: Rhythm; agenda: Agenda; canRun: boolean; today: string;
}) {
  const router = useRouter();
  const readOnly = useReadOnly(); // View as, and an archived project
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const next = nextMeetingDate(rhythm, today);
  const heldToday = rhythm.meetLast === today;
  const write = !readOnly && canRun;

  const held = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await api(`/projects/${projectId}/meeting/held`, 'POST') as { meetNext: string | null };
      notify(r.meetNext ? `Meeting held. Next is ${fmtDate(r.meetNext)}` : 'Meeting held');
      router.refresh();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <section className="card card-pad meet" aria-label="Meeting">
      <div className="meet-head">
        <div className="meet-title">
          <h3 className="section-title"><Help term="meeting_rhythm">Meeting</Help></h3>
          <p className="meet-line">
            <b>{rhythmWords(rhythm)}</b>
            {rhythm.meetEvery && <span className="dim"> · {next ? <>Next {next === today ? 'today' : fmtDate(next)}</> : 'No date set'}</span>}
            {rhythm.meetLast && <span className="dim"> · Last {fmtDate(rhythm.meetLast)}</span>}
          </p>
        </div>
        <div className="meet-actions">
          {!readOnly && <button className="btn ghost" onClick={() => window.dispatchEvent(new Event(IMPORT_EVENT))}>Write the minutes</button>}
          {write && <button className="btn ghost" onClick={() => setEditing(!editing)} aria-expanded={editing}>{rhythm.meetEvery ? 'Edit rhythm' : 'Set the rhythm'}</button>}
          {write && <button className="btn" onClick={held} disabled={busy || heldToday}>{heldToday ? 'Held today' : <Help term="meeting_held">Meeting held</Help>}</button>}
        </div>
      </div>
      {err && <p className="err" role="alert">{err}</p>}
      {editing && write && <RhythmForm projectId={projectId} rhythm={rhythm} today={today} onDone={() => setEditing(false)} />}

      <details className="meet-agenda" open>
        <summary><Help term="meeting_agenda">Agenda</Help> <span className="dim">{agenda.total ? `${agenda.total} ${agenda.total === 1 ? 'item' : 'items'}` : 'nothing to raise'}</span></summary>
        {agenda.sections.length === 0 && (
          <p className="hint">Nothing is late, blocked or at risk, and nothing has changed {agenda.last ? `since ${fmtDate(agenda.last)}` : 'this week'}.</p>
        )}
        {agenda.sections.map((s) => (
          <div className="meet-sec" key={s.key}>
            <h4 className={s.key === 'late' ? 'late-text' : undefined}>{s.title} <span className="count-badge">{s.rows.length + s.more}</span></h4>
            <ul className="meet-list">
              {s.rows.map((r) => (
                <li key={r.id} className="meet-row">
                  {r.taskId && kind === 'tasks'
                    ? <Link className="meet-link" href={`?task=${r.taskId}`} scroll={false}>{r.title}</Link>
                    : <span className="meet-text">{r.title}</span>}
                  <span className={`meet-note ${r.tone === 'late' ? 'late-text' : 'dim'}`}>{r.note}</span>
                </li>
              ))}
            </ul>
            {s.more > 0 && <p className="hint">And {s.more} more.</p>}
          </div>
        ))}
      </details>
    </section>
  );
}
