import type { Db } from './db';
import { bad } from './errors';

// What's new (13 Nov): one short note from the NicoDesk team at the top of Home, until the person presses Got it.
// Got it is kept per person in update_seen under the scope "news:<id>", so it holds on every device. In the app only:
// nothing is sent anywhere. To announce something new, change NEWS (a new id shows it to everyone again); null shows nothing.
// `mark` is the words shown highlighted (the feature's name); `link` turns other words in the body into a link.
export type News = { id: string; title: string; body: string; mark: string | null; link: { text: string; href: string } | null };
export const NEWS: News | null = {
  id: 'personal-13nov',
  title: '✨ New in NicoDesk',
  body: 'Personal 🔒 is here: a private corner just for you, for quick to-dos, meeting jots, ideas and your own tasks. You’ll find it under Projects.',
  mark: 'Personal 🔒',
  link: { text: 'Projects', href: '/projects' },
};

const scope = (id: string) => `news:${id}`;

// The note for this person, or null once they have pressed Got it.
export async function newsFor(db: Db, personId: string): Promise<News | null> {
  if (!NEWS) return null;
  const { rows: [seen] } = await db.query(`SELECT 1 FROM update_seen WHERE person_id = $1 AND scope = $2`, [personId, scope(NEWS.id)]);
  return seen ? null : NEWS;
}

export async function markNewsSeen(db: Db, personId: string, id: string): Promise<void> {
  if (!NEWS || id !== NEWS.id) throw bad('invalid_body', 'That note is no longer showing. Reload the page.', 'id');
  await db.query(`INSERT INTO update_seen (person_id, scope, seen_at) VALUES ($1, $2, now()) ON CONFLICT (person_id, scope) DO NOTHING`, [personId, scope(id)]);
}
