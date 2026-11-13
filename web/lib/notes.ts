import type { Db } from './db';
import { ApiError, bad, notFound } from './errors';
import { assertNotViewing } from './http';
import { newId } from './service';
import type { Me } from './auth';

// Running notes in someone's Personal project (11 Nov): one page per person, written in a rich editor (bold, italic,
// underline, headings, bullets, numbers, checklists, pictures, attached files) and saved as you type. Only that person
// reads or writes it; an admin viewing as them sees nothing. Once a day the page as it stood is kept, so "Restore
// yesterday's version" can bring it back after a slip. Attached pictures and files are kept here too, served only to
// their owner. In the app only, never sent anywhere.

export const PAGE_MAX = 400_000; // the stored page, in bytes of JSON
export const FILE_MAX = 5 * 1024 * 1024;
export const FILES_PER_PERSON = 200;
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const FILE_TYPES = [...IMAGE_TYPES, 'application/pdf', 'text/plain', 'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.ms-powerpoint'];
const FILE_URL = '/api/v1/me/files/';

export type Doc = { type: 'doc'; content?: unknown[] };
export type Page = { doc: Doc; updatedAt: string | null; prevAt: string | null };
const EMPTY: Doc = { type: 'doc', content: [{ type: 'paragraph' }] };

// What the editor sends is kept only if it is a document, and a picture only if it points at one of my files; a link
// keeps only a web, mail or in-app address. Anything else in it is dropped, so a stored page can never carry a script.
function cleanDoc(d: unknown): Doc {
  const node = (n: unknown): unknown => {
    if (!n || typeof n !== 'object') return null;
    const o = n as { type?: unknown; attrs?: Record<string, unknown>; marks?: unknown[]; content?: unknown[]; text?: unknown };
    if (typeof o.type !== 'string' || !/^[a-zA-Z]+$/.test(o.type)) return null;
    if (o.type === 'image' && !(typeof o.attrs?.src === 'string' && o.attrs.src.startsWith(FILE_URL))) return null;
    // Colours are a plain #hex only, so no style can be slipped in through them.
    const hex = (v: unknown) => typeof v === 'string' && /^#[0-9a-f]{3,8}$/i.test(v);
    const marks = Array.isArray(o.marks) ? o.marks.filter((m) => {
      const mk = m as { type?: unknown; attrs?: { href?: unknown; color?: unknown } };
      if (typeof mk?.type !== 'string') return false;
      if ((mk.type === 'textStyle' || mk.type === 'highlight') && mk.attrs?.color != null && !hex(mk.attrs.color)) return false;
      return mk.type !== 'link' || (typeof mk.attrs?.href === 'string' && /^(https?:|mailto:|\/)/i.test(mk.attrs.href));
    }) : undefined;
    if (o.attrs) {
      if ('textAlign' in o.attrs && !['left', 'center', 'right', 'justify', null].includes(o.attrs.textAlign as string | null)) delete o.attrs.textAlign;
      if ('indent' in o.attrs && !(Number.isInteger(o.attrs.indent) && (o.attrs.indent as number) >= 0 && (o.attrs.indent as number) <= 8)) o.attrs.indent = 0;
    }
    const content = Array.isArray(o.content) ? o.content.map(node).filter(Boolean) : undefined;
    return { type: o.type, ...(o.attrs ? { attrs: o.attrs } : {}), ...(marks?.length ? { marks } : {}), ...(content ? { content } : {}), ...(typeof o.text === 'string' ? { text: o.text } : {}) };
  };
  const out = node(d) as Doc | null;
  if (!out || out.type !== 'doc') throw bad('invalid_body', 'That page could not be saved. Reload and try again.', 'doc');
  return out;
}

export async function myPage(db: Db, me: Me): Promise<Page | null> {
  if (me.viewingAs) return null;
  const { rows } = await db.query<{ doc: Doc; updated_at: string | Date; prev_at: string | Date | null }>(
    `SELECT doc, updated_at, prev_at FROM personal_pages WHERE person_id = $1`, [me.person.id]);
  const r = rows[0];
  return r ? { doc: r.doc, updatedAt: new Date(r.updated_at).toISOString(), prevAt: r.prev_at ? new Date(r.prev_at).toISOString() : null }
    : { doc: EMPTY, updatedAt: null, prevAt: null };
}

// Saved as I type. The first save on a new day keeps the page as it was, for Restore.
export async function savePage(db: Db, me: Me, doc: unknown): Promise<{ updatedAt: string; prevAt: string | null }> {
  assertNotViewing(me);
  const clean = cleanDoc(doc);
  const text = JSON.stringify(clean);
  if (text.length > PAGE_MAX) throw bad('invalid_body', 'The page is too long to save. Move some of it to a Doc and link to it.', 'doc');
  const { rows } = await db.query<{ updated_at: string | Date; prev_at: string | Date | null }>(
    `INSERT INTO personal_pages (person_id, team_id, doc) VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (person_id) DO UPDATE SET
       prev_doc = CASE WHEN personal_pages.updated_at < date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata'
                       THEN personal_pages.doc ELSE personal_pages.prev_doc END,
       prev_at = CASE WHEN personal_pages.updated_at < date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata'
                      THEN personal_pages.updated_at ELSE personal_pages.prev_at END,
       doc = EXCLUDED.doc, updated_at = now()
     RETURNING updated_at, prev_at`, [me.person.id, me.team.id, text]);
  return { updatedAt: new Date(rows[0].updated_at).toISOString(), prevAt: rows[0].prev_at ? new Date(rows[0].prev_at).toISOString() : null };
}

// Swap the page and the one kept from before, so Restore can itself be undone by pressing it again.
export async function restorePage(db: Db, me: Me): Promise<Page> {
  assertNotViewing(me);
  const { rows } = await db.query<{ doc: Doc; updated_at: string | Date; prev_at: string | Date | null }>(
    `UPDATE personal_pages SET doc = prev_doc, prev_doc = doc, prev_at = updated_at, updated_at = now()
      WHERE person_id = $1 AND prev_doc IS NOT NULL RETURNING doc, updated_at, prev_at`, [me.person.id]);
  if (!rows[0]) throw notFound('There is no earlier version to restore.');
  return { doc: rows[0].doc, updatedAt: new Date(rows[0].updated_at).toISOString(), prevAt: rows[0].prev_at ? new Date(rows[0].prev_at).toISOString() : null };
}

// A picture or file for the page. The kind is checked against its first bytes for pictures, and against a short list
// for documents; anything else is refused.
const MAGIC: Record<string, (b: Uint8Array) => boolean> = {
  'image/png': (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8,
  'image/gif': (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46,
  'image/webp': (b) => b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
};
export async function addFile(db: Db, me: Me, name: string, mime: string, bytes: Uint8Array): Promise<{ id: string; url: string; name: string; image: boolean }> {
  assertNotViewing(me);
  const n = name.trim().replace(/[\\/\r\n\0]/g, '_').slice(0, 200) || 'file';
  if (!FILE_TYPES.includes(mime)) throw bad('invalid_body', 'That kind of file cannot be attached. Pictures, PDFs, Word, Excel, PowerPoint, CSV and text files can.', 'file');
  if (!bytes.length) throw bad('invalid_body', 'That file is empty.', 'file');
  if (bytes.length > FILE_MAX) throw new ApiError(413, 'file_too_big', 'A file must be under 5 MB.', 'file');
  if (MAGIC[mime] && !MAGIC[mime](bytes)) throw bad('invalid_body', 'That picture could not be read.', 'file');
  const { rows: [c] } = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM personal_files WHERE person_id = $1`, [me.person.id]);
  if (c.n >= FILES_PER_PERSON) throw bad('invalid_body', `You have ${FILES_PER_PERSON} files on your notes. Remove some to add more.`, 'file');
  const id = newId('pfl');
  await db.query(`INSERT INTO personal_files (id, team_id, person_id, name, mime, bytes, size) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [id, me.team.id, me.person.id, n, mime, bytes, bytes.length]);
  return { id, url: `${FILE_URL}${id}`, name: n, image: IMAGE_TYPES.includes(mime) };
}

export async function getFile(db: Db, me: Me, id: string): Promise<{ name: string; mime: string; bytes: Uint8Array; image: boolean } | null> {
  if (me.viewingAs) return null;
  const { rows } = await db.query<{ name: string; mime: string; bytes: Uint8Array }>(
    `SELECT name, mime, bytes FROM personal_files WHERE id = $1 AND person_id = $2`, [id, me.person.id]);
  return rows[0] ? { ...rows[0], image: IMAGE_TYPES.includes(rows[0].mime) } : null;
}
