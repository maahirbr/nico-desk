import Link from 'next/link';
import type { Health, Outcome, Task } from '@/lib/derive';
import { fmtDate } from '@/lib/time';
import type { HelpTerm } from './help';
import { Help } from './HelpMode';

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

export function Chip({ word, tone = 'idle', help }: { word: string; tone?: Tone; help?: HelpTerm }) {
  return <span className={`st tone-${tone}`}>{help ? <Help term={help}>{word}</Help> : word}</span>;
}

export function StatusChips({ t, names }: { t: Task; names?: Record<string, string> }) {
  return (
    <span className="chips">
      {t.statusCategory === 'open' && t.health && <Chip {...HEALTH[t.health]} help={t.health === 'not_started' ? 'status_todo' : 'status_doing'} />}
      {t.statusCategory === 'open' && !t.health && <Chip word={t.sourceStatus} tone="quiet" />}
      {t.outcome && <Chip {...OUTCOME[t.outcome]} help={t.outcome} />}
      {t.statusCategory === 'dropped' && <Chip word="Dropped" tone="quiet" help="status_dropped" />}
      {t.overdue && <Chip word="Late" tone="late" help="late" />}
      {t.slippedSilently && <Chip word="Slipped silently" tone="late" help="slipped_silently" />}
      {t.blocked && <Chip word={t.blocked.onId ? `Blocked on ${names?.[t.blocked.onId] ?? 'someone'}` : 'Blocked'} tone="blocked" help={t.blocked.onId ? 'blocked_on' : 'status_blocked'} />}
      {t.priority && <Chip word={`Priority ${t.priority.value}`} tone="quiet" help="priority" />}
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
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return <span className={`av${lg ? ' lg' : ''}${you ? ' you' : ''}`} style={{ '--h': h } as React.CSSProperties} aria-hidden>{initials}</span>;
}

// A person's name or mark that opens their page (/people/[id]). Without an id it is plain text.
export function PersonLink({ id, className, children }: { id?: string | null; className?: string; children: React.ReactNode }) {
  if (!id) return <span className={className}>{children}</span>;
  return <Link href={`/people/${id}`} className={`plink${className ? ` ${className}` : ''}`}>{children}</Link>;
}

export function Person({ name, id }: { name: string; id?: string }) {
  return <PersonLink id={id} className="person-cell"><Avatar name={name} />{name}</PersonLink>;
}
