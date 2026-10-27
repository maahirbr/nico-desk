// Recent searches, kept in this browser for this person only (workstream 9). Storage can be missing or blocked
// (a private window, site data cleared), so every read and write is wrapped and the box works the same without it.
// Nothing here goes to the server.

export const RECENT_MAX = 6;
const keyOf = (meId: string) => `nd_recent_${meId.replace(/[^A-Za-z0-9_-]/g, '')}`;

// Newest first, no repeats (case ignored), at most RECENT_MAX. Pure.
export function pushRecent(list: string[], q: string): string[] {
  const t = q.trim().replace(/\s+/g, ' ');
  if (t.length < 2) return list;
  return [t, ...list.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, RECENT_MAX);
}

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const store = (): Store | null => { try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; } };

export function readRecent(meId: string, s: Store | null = store()): string[] {
  if (!meId || !s) return [];
  try {
    const v = JSON.parse(s.getItem(keyOf(meId)) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, RECENT_MAX) : [];
  } catch { return []; }
}

export function writeRecent(meId: string, list: string[], s: Store | null = store()): void {
  if (!meId || !s) return;
  try { s.setItem(keyOf(meId), JSON.stringify(list.slice(0, RECENT_MAX))); } catch { /* blocked: the list lasts until reload */ }
}

export function clearRecent(meId: string, s: Store | null = store()): void {
  if (!meId || !s) return;
  try { s.removeItem(keyOf(meId)); } catch { /* nothing to clear */ }
}
