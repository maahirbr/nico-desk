import { fold, scoreText } from '@/lib/fuzzy';
import { SKINS } from './skins';
import { THEMES } from './theme';

// Commands in the search box (Cmd+K). Only actions that already exist: a page in the side menu, New task, the help
// mode, the shortcut list and the skins in the account menu. This file is data and a filter, with no React, so a test
// can run it. TopSearch.tsx runs a command; it never adds an action of its own.

export type CommandRun =
  | { kind: 'go'; href: string }
  | { kind: 'event'; name: string; detail?: string }
  | { kind: 'help' };

export type Command = { id: string; label: string; words: string; run: CommandRun };
export type CommandCtx = { isLead: boolean; readOnly: boolean };

const ALL: (Command & { need?: 'write' | 'lead' })[] = [
  { id: 'new-task', label: 'New task', words: 'add create task', run: { kind: 'go', href: '/tasks/new' }, need: 'write' },
  { id: 'go-home', label: 'Go to Home', words: 'me my tasks today', run: { kind: 'go', href: '/me' } },
  { id: 'go-team', label: 'Go to Team', words: 'everyone people week', run: { kind: 'go', href: '/team' } },
  { id: 'go-projects', label: 'Go to Projects', words: 'plans boards', run: { kind: 'go', href: '/projects' } },
  { id: 'go-ledger', label: 'Go to Ledger', words: 'record habits on time', run: { kind: 'go', href: '/ledger' } },
  { id: 'go-reminders', label: 'Go to Reminders', words: 'nudge email drafts', run: { kind: 'go', href: '/reminders' }, need: 'lead' },
  { id: 'go-search', label: 'Open the search page', words: 'results find', run: { kind: 'go', href: '/search' } },
  { id: 'help', label: 'Toggle help', words: 'help mode tooltips explain', run: { kind: 'help' } },
  { id: 'shortcuts', label: 'Show keyboard shortcuts', words: 'keys keyboard', run: { kind: 'event', name: 'nd:shortcuts' } },
  ...SKINS.map((s) => ({ id: `skin-${s.id}`, label: `Appearance: ${s.name}`, words: 'skin look theme', run: { kind: 'event', name: 'nd:skin', detail: s.id } as CommandRun })),
  ...THEMES.map((t) => ({ id: `theme-${t.id}`, label: `Appearance: ${t.name}`, words: 'mode night day theme', run: { kind: 'event', name: 'nd:theme', detail: t.id } as CommandRun })),
];

const SHOWN_EMPTY = ['new-task', 'go-home', 'go-team', 'go-projects', 'help'];
const MAX = 6;

export function commandsFor(q: string, ctx: CommandCtx): Command[] {
  const ok = ALL.filter((c) => (c.need === 'write' ? !ctx.readOnly : c.need === 'lead' ? ctx.isLead : true));
  const term = fold(q).trim();
  if (!term) return ok.filter((c) => SHOWN_EMPTY.includes(c.id));
  // A query with a filter in it ("is:late", "@sam", "#plan") is for items, not commands.
  if (/[:@#]/.test(term) || term.length < 2) return [];
  const words = term.split(/\s+/);
  return ok
    .map((c, i) => {
      const m = scoreText(words, `${c.label} ${c.words}`);
      const title = scoreText(words, c.label).matched;
      return { c, i, ...m, title };
    })
    .filter((x) => x.matched === words.length)
    .sort((a, b) => a.fuzzy - b.fuzzy || b.title - a.title || a.i - b.i)
    .slice(0, MAX)
    .map((x) => x.c);
}
