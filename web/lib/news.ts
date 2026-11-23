import type { Db } from './db';
import { bad } from './errors';
import { today } from './time';

// What's new (13 Nov): one short note from the NicoDesk team at the top of Home, until the person presses Got it.
// Got it is kept per person in update_seen under the scope "news:<id>", so it holds on every device. In the app only:
// nothing is sent anywhere. To announce something new, add a note to NOTES (a new id shows it again); none shows nothing.
// `mark` is the words shown highlighted (the feature's name); `link` turns other words in the body into a link.
// `admins` (19 Nov): a note only admins see. One note shows at a time, the first in NOTES not yet seen.
// `until` (24 Nov): the first day (IST) a note no longer shows, Got it or not.
export type News = { id: string; title: string; body: string; mark: string | null; link: { text: string; href: string } | null; admins?: boolean; until?: string };
export const NOTES: News[] = [
  {
    id: 'hide-admin-19nov',
    title: '✨ New for admins',
    body: 'Hide admin tools is here. With so many projects on NicoDesk now, the admin view can get busy for your own day-to-day work. It gives you a simpler view with only the projects you’re on, and no admin controls. Click your name at the bottom left, then Hide admin tools. Untick it anytime to switch back.',
    mark: 'Hide admin tools',
    link: null,
    admins: true,
  },
  {
    id: 'personal-13nov',
    title: '✨ New in NicoDesk',
    body: 'Personal 🔒 is here: a private corner just for you, for quick to-dos, meeting jots, ideas and your own tasks. You’ll find it under Projects.',
    mark: 'Personal 🔒',
    link: { text: 'Projects', href: '/projects' },
    until: '2026-12-01', // the PM's call (24 Nov): it closes itself on 1 Dec
  },
];
// The note everyone sees (kept for callers that want the main one).
export const NEWS: News | null = NOTES.find((n) => !n.admins) ?? null;

const scope = (id: string) => `news:${id}`;

// The note for this person, or null once they have pressed Got it on every note meant for them.
export async function newsFor(db: Db, personId: string, isAdmin = false): Promise<News | null> {
  const now = today();
  const mine = NOTES.filter((n) => (!n.admins || isAdmin) && (!n.until || now < n.until));
  if (!mine.length) return null;
  const { rows } = await db.query<{ scope: string }>(`SELECT scope FROM update_seen WHERE person_id = $1 AND scope = ANY($2::text[])`, [personId, mine.map((n) => scope(n.id))]);
  const seen = new Set(rows.map((r) => r.scope));
  return mine.find((n) => !seen.has(scope(n.id))) ?? null;
}

export async function markNewsSeen(db: Db, personId: string, id: string): Promise<void> {
  if (!NOTES.some((n) => n.id === id)) throw bad('invalid_body', 'That note is no longer showing. Reload the page.', 'id');
  await db.query(`INSERT INTO update_seen (person_id, scope, seen_at) VALUES ($1, $2, now()) ON CONFLICT (person_id, scope) DO NOTHING`, [personId, scope(id)]);
}
