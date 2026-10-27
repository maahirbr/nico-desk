'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useReadOnly } from './readonly';

// Who is looking, for the client pieces that need it without a prop on every row: the person, whether
// they act as a lead, today, and which tasks have something new for them ("since you last looked").
//
// Fresh tasks come from the server and reuse the seen tracking that already exists: the updates feed
// (its "Mark all seen" cookie, nd_seen_<id>) and the unread "assigned" notices. A cut-off for the whole
// feed cannot say "I opened this one", so opening a task also writes its own seen time into
// localStorage of this browser. A dot shows while a change is newer than that. Opening a task never
// marks anything while an admin is viewing as someone else.

export type Fresh = Record<string, { at: string; notice?: string }>;

type Viewer = { meId: string; isLead: boolean; today: string; isFresh: (taskId: string) => boolean; markSeen: (taskId: string) => void };

const noop = () => {};
const ViewerContext = createContext<Viewer>({ meId: '', isLead: false, today: '', isFresh: () => false, markSeen: noop });

export const useViewer = () => useContext(ViewerContext);

const key = (meId: string) => `nd_tseen_${meId.replace(/[^A-Za-z0-9_-]/g, '')}`;
const KEEP_MS = 8 * 86_400_000; // the feed looks back 7 days, so older marks are noise

export function ViewerProvider({ meId, isLead, today, fresh, children }: { meId: string; isLead: boolean; today: string; fresh: Fresh; children: React.ReactNode }) {
  const readOnly = useReadOnly();
  const [seen, setSeen] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false); // dots appear after the browser has read its marks, so a seen one never flashes

  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(key(meId)) ?? '{}') as Record<string, string>;
      const cut = Date.now() - KEEP_MS;
      setSeen(Object.fromEntries(Object.entries(raw).filter(([, at]) => Date.parse(at) >= cut)));
    } catch { /* no storage: dots stay until the feed is marked seen */ }
    setReady(true);
  }, [meId]);

  const isFresh = useCallback((id: string) => {
    const f = fresh[id];
    return ready && !!f && !(seen[id] && seen[id] >= f.at);
  }, [fresh, seen, ready]);

  const markSeen = useCallback((id: string) => {
    const f = fresh[id];
    if (readOnly || !f) return; // viewing as someone: mark nothing as seen
    const at = new Date().toISOString();
    setSeen((cur) => {
      const next = { ...cur, [id]: at };
      try { localStorage.setItem(key(meId), JSON.stringify(next)); } catch { /* storage blocked: the mark lasts until reload */ }
      return next;
    });
    if (f.notice) fetch(`/api/v1/me/notices/${f.notice}/read`, { method: 'POST' }).catch(() => {});
  }, [fresh, meId, readOnly]);

  const value = useMemo(() => ({ meId, isLead, today, isFresh, markSeen }), [meId, isLead, today, isFresh, markSeen]);
  return <ViewerContext.Provider value={value}>{children}</ViewerContext.Provider>;
}

// The dot. Hidden from the page unless the task has something new for this person.
export function FreshDot({ id }: { id: string }) {
  const { isFresh } = useViewer();
  if (!isFresh(id)) return null;
  return <span className="fresh-dot" role="img" aria-label="New or changed since you last looked" />;
}
