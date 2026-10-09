import type { Health, Outcome, Task } from '@/lib/derive';
import { fmtDate } from '@/lib/time';

// A word in a quiet pill, always. The tone only picks a token pair in globals.css (.tone-*).

export type Tone = 'idle' | 'active' | 'blocked' | 'done' | 'quiet' | 'late' | 'risk' | 'ok';

// A person picks not started or in progress. Older ahead and off-track values read as in progress;
// ahead, at risk and late are now worked out from the dates.
export const HEALTH: Record<Health, { word: string; tone: Tone }> = {
  not_started: { word: 'Not started', tone: 'idle' },
  on_track: { word: 'In progress', tone: 'active' },
  ahead: { word: 'In progress', tone: 'active' },
  off_track: { word: 'In progress', tone: 'active' },
};

export const OUTCOME: Record<Outcome, { word: string; tone: Tone }> = {
  ahead: { word: 'Closed ahead', tone: 'done' },
  on_time: { word: 'Closed on time', tone: 'done' },
  late: { word: 'Closed late', tone: 'done' },
};

export function Chip({ word, tone = 'idle' }: { word: string; tone?: Tone }) {
  return <span className={`st tone-${tone}`}>{word}</span>;
}

export function StatusChips({ t, names }: { t: Task; names?: Record<string, string> }) {
  return (
    <span className="chips">
      {t.statusCategory === 'open' && t.health && <Chip {...HEALTH[t.health]} />}
      {t.statusCategory === 'open' && !t.health && <Chip word={t.sourceStatus} tone="quiet" />}
      {t.outcome && <Chip {...OUTCOME[t.outcome]} />}
      {t.statusCategory === 'dropped' && <Chip word="Dropped" tone="quiet" />}
      {t.overdue && <Chip word="Late" tone="late" />}
      {t.slippedSilently && <Chip word="Slipped silently" tone="late" />}
      {t.blocked && <Chip word={t.blocked.onId ? `Blocked on ${names?.[t.blocked.onId] ?? 'someone'}` : 'Blocked'} tone="blocked" />}
      {t.priority && <Chip word={`Priority ${t.priority.value}`} tone="quiet" />}
      {t.readOnly && <Chip word="From Sheet" tone="quiet" />}
    </span>
  );
}

// "Due 26 Sep (first given 23 Sep, moved once)", from SPEC.md FR-19.
export function dueLine(t: Task): string {
  if (t.dateMoves === 0) return `Due ${fmtDate(t.dueOn)}`;
  const moved = t.dateMoves === 1 ? 'moved once' : `moved ${t.dateMoves} times`;
  return `Due ${fmtDate(t.dueOn)} (first given ${fmtDate(t.firstDueOn)}, ${moved})`;
}

// Initials on a neutral mark. The viewer's own mark is the one blue one.
export function Avatar({ name, lg = false, you = false }: { name: string; lg?: boolean; you?: boolean }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return <span className={`av${lg ? ' lg' : ''}${you ? ' you' : ''}`} aria-hidden>{initials}</span>;
}

export function Person({ name }: { name: string }) {
  return <span className="person-cell"><Avatar name={name} />{name}</span>;
}
