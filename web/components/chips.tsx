import type { Health, Outcome, Task } from '@/lib/derive';
import { fmtDate } from '@/lib/time';

// Colour plus a word, always (SPEC.md FR-11, INTENT.md principle 5).

// A person picks not started or in progress. Older ahead and off-track values read as in progress;
// ahead, at risk and late are now worked out from the dates.
export const HEALTH: Record<Health, { word: string; c: string }> = {
  not_started: { word: 'Not started', c: 'var(--black)' },
  on_track: { word: 'In progress', c: 'var(--amber)' },
  ahead: { word: 'In progress', c: 'var(--amber)' },
  off_track: { word: 'In progress', c: 'var(--amber)' },
};

export const OUTCOME: Record<Outcome, { word: string; c: string }> = {
  ahead: { word: 'Closed ahead', c: 'var(--purple)' },
  on_time: { word: 'Closed on time', c: 'var(--purple)' },
  late: { word: 'Closed late', c: 'var(--navy)' },
};

type Style = React.CSSProperties & { '--c'?: string; '--h'?: number };

export function Chip({ word, c, kind = '' }: { word: string; c?: string; kind?: '' | 'outline' | 'plain' }) {
  return (
    <span className={`st ${kind}`} style={c ? ({ '--c': c } as Style) : undefined}>
      {word}
    </span>
  );
}

export function StatusChips({ t, names }: { t: Task; names?: Record<string, string> }) {
  return (
    <span className="chips">
      {t.statusCategory === 'open' && t.health && <Chip {...HEALTH[t.health]} />}
      {t.statusCategory === 'open' && !t.health && <Chip word={t.sourceStatus} kind="plain" />}
      {t.outcome && <Chip {...OUTCOME[t.outcome]} />}
      {t.statusCategory === 'dropped' && <Chip word="Dropped" c="var(--ink-65)" kind="outline" />}
      {t.overdue && <Chip word="Late" c="var(--red)" kind="outline" />}
      {t.slippedSilently && <Chip word="Slipped silently" c="var(--red)" kind="plain" />}
      {t.blocked && <Chip word={t.blocked.onId ? `Blocked on ${names?.[t.blocked.onId] ?? 'someone'}` : 'Blocked'} c="var(--red)" kind="outline" />}
      {t.priority && <Chip word={`Priority ${t.priority.value}`} kind="plain" />}
      {t.readOnly && <Chip word="From Sheet" kind="plain" />}
    </span>
  );
}

// "Due 26 Sep (first given 23 Sep, moved once)", from SPEC.md FR-19.
export function dueLine(t: Task): string {
  if (t.dateMoves === 0) return `Due ${fmtDate(t.dueOn)}`;
  const moved = t.dateMoves === 1 ? 'moved once' : `moved ${t.dateMoves} times`;
  return `Due ${fmtDate(t.dueOn)} (first given ${fmtDate(t.firstDueOn)}, ${moved})`;
}

// Initials on a tint picked from the name, so each person reads the same everywhere.
export function Avatar({ name, lg = false }: { name: string; lg?: boolean }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return <span className={`av${lg ? ' lg' : ''}`} style={{ '--h': h } as Style} aria-hidden>{initials}</span>;
}

export function Person({ name }: { name: string }) {
  return <span className="person-cell"><Avatar name={name} />{name}</span>;
}
