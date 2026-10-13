import type { MessageView } from '@/lib/teamchat';
import { fmtDate, istDate } from '@/lib/time';

// The plain parts of the chat room, kept out of the component so they can be tested: how a poll folds into what is
// on screen, and how messages are grouped by day.

// A poll asks for the newest page. Messages already shown are replaced (an edit or a removal shows up), new ones are
// added at the end. If a whole page of new messages arrived since the last poll, nothing on screen touches the new
// page, so it starts again from the newest page and the earlier ones load on demand.
export function mergeLatest(shown: MessageView[], latest: MessageView[], latestHasMore: boolean): MessageView[] {
  if (shown.length === 0) return latest;
  const have = new Set(shown.map((m) => m.id));
  if (latestHasMore && !latest.some((m) => have.has(m.id))) return latest;
  const fresh = new Map(latest.map((m) => [m.id, m]));
  const next = shown.map((m) => fresh.get(m.id) ?? m);
  for (const m of latest) if (!have.has(m.id)) next.push(m);
  return next;
}

export const dayLabel = (day: string, today: string): string => {
  if (day === today) return 'Today';
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return day === d.toISOString().slice(0, 10) ? 'Yesterday' : fmtDate(day);
};

export type ChatRow =
  | { kind: 'day'; key: string; label: string }
  | { kind: 'new'; key: string }
  | { kind: 'msg'; key: string; m: MessageView; head: boolean };

const SAME_SPEAKER_MS = 5 * 60 * 1000;

// The list as it is drawn: a day line when the day changes, a "New" line before the first message the reader has not
// seen, and a header (name and time) on a message unless the same person wrote the one above it a moment ago.
export function rowsOf(messages: MessageView[], today: string, firstUnreadId: string | null): ChatRow[] {
  const rows: ChatRow[] = [];
  let prev: MessageView | null = null;
  let day = '';
  for (const m of messages) {
    const d = istDate(m.createdAt);
    const newDay = d !== day;
    if (newDay) { day = d; rows.push({ kind: 'day', key: `day-${d}`, label: dayLabel(d, today) }); }
    const marked = m.id === firstUnreadId;
    if (marked) rows.push({ kind: 'new', key: 'new' });
    const near = prev && !newDay && !marked && prev.authorId === m.authorId && new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < SAME_SPEAKER_MS;
    rows.push({ kind: 'msg', key: m.id, m, head: !near });
    prev = m;
  }
  return rows;
}

// The first message from someone else that is newer than the read mark, for the "New" line. Only worked out once, when the room opens.
export function firstUnread(messages: MessageView[], lastReadAt: string | null): string | null {
  const m = messages.find((x) => !x.mine && !x.deleted && (lastReadAt == null || x.createdAt > lastReadAt));
  return m?.id ?? null;
}
