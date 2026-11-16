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

// ---------- several named notes (15 Nov, the PM's call) ----------
// A person has one or more notes, each with a name, in the order they made them. The first time, their old single page
// (personal_pages) becomes the first note, "Notes", so nothing is lost. Calls without a note id use the first note.
// Apple Notes style (16 Nov, the PM's pick): newest first, each with its created date and a short preview. A note made
// with ✎ is untitled (named false) and takes its first line as its name until it is renamed.
export type NoteMeta = { id: string; name: string; updatedAt: string | null; createdAt: string; preview: string; deletedAt?: string | null };
export const KEEP_DELETED_DAYS = 30;
const UNTITLED = 'New note';

// The text of a note, one entry per paragraph, heading or list item, blank ones left out.
function lines(doc: Doc): string[] {
  const out: string[] = [];
  const text = (n: unknown): string => {
    const o = n as { text?: string; content?: unknown[] };
    return typeof o?.text === 'string' ? o.text : Array.isArray(o?.content) ? o.content.map(text).join('') : '';
  };
  const walk = (n: unknown) => {
    const o = n as { type?: string; content?: unknown[] };
    if (!o || !Array.isArray(o.content)) return;
    if (o.type === 'paragraph' || o.type === 'heading') { const t = text(o).trim(); if (t) out.push(t); return; }
    o.content.forEach(walk);
  };
  walk(doc);
  return out;
}
const firstLine = (doc: Doc) => (lines(doc)[0] ?? '').slice(0, 80);
// The preview under the name: what follows the first line when the name is that line, else the start of the note.
const previewOf = (doc: Doc, named: boolean) => (named ? lines(doc) : lines(doc).slice(1)).join(' ').slice(0, 90);
export const NOTES_MAX = 50;
const iso = (v: string | Date | null) => (v ? new Date(v).toISOString() : null);

async function ensureNotes(db: Db, me: Me): Promise<void> {
  // Notes in Recently Deleted for more than 30 days go for good.
  await db.query(`DELETE FROM personal_notes WHERE person_id = $1 AND deleted_at < now() - interval '${KEEP_DELETED_DAYS} days'`, [me.person.id]);
  const { rows: [any] } = await db.query(`SELECT 1 FROM personal_notes WHERE person_id = $1 AND deleted_at IS NULL LIMIT 1`, [me.person.id]);
  if (any) return;
  const { rows: [had] } = await db.query(`SELECT 1 FROM personal_notes WHERE person_id = $1 LIMIT 1`, [me.person.id]);
  if (had) { // only deleted notes left: start a fresh, empty one
    await db.query(`INSERT INTO personal_notes (id, person_id, team_id, name, position, doc) VALUES ($1,$2,$3,'Notes',0,$4::jsonb)`, [newId('pnt'), me.person.id, me.team.id, JSON.stringify(EMPTY)]);
    return;
  }
  const { rows: [old] } = await db.query<{ doc: Doc; prev_doc: Doc | null; prev_at: string | Date | null; updated_at: string | Date }>(
    `SELECT doc, prev_doc, prev_at, updated_at FROM personal_pages WHERE person_id = $1`, [me.person.id]);
  await db.query(
    `INSERT INTO personal_notes (id, person_id, team_id, name, position, doc, prev_doc, prev_at, updated_at, created_at)
     VALUES ($1, $2, $3, 'Notes', 0, $4::jsonb, $5::jsonb, $6, COALESCE($7, now()), COALESCE($7, now()))`,
    [newId('pnt'), me.person.id, me.team.id, JSON.stringify(old?.doc ?? EMPTY), old?.prev_doc ? JSON.stringify(old.prev_doc) : null, old?.prev_at ?? null, old?.updated_at ?? null]);
}

export async function listNotes(db: Db, me: Me): Promise<NoteMeta[]> {
  if (me.viewingAs) return [];
  await ensureNotes(db, me);
  // Live notes newest first, then Recently Deleted (most recently deleted first).
  const { rows } = await db.query<{ id: string; name: string; named: boolean; doc: Doc; updated_at: string | Date; created_at: string | Date; deleted_at: string | Date | null }>(
    `SELECT id, name, named, doc, updated_at, created_at, deleted_at FROM personal_notes WHERE person_id = $1
      ORDER BY deleted_at IS NOT NULL, deleted_at DESC, updated_at DESC, created_at DESC`, [me.person.id]);
  return rows.map((r) => ({ id: r.id, name: r.name, updatedAt: iso(r.updated_at), createdAt: iso(r.created_at)!, preview: previewOf(r.doc, r.named), deletedAt: iso(r.deleted_at) }));
}

async function noteId(db: Db, me: Me, id?: string | null): Promise<string> {
  await ensureNotes(db, me);
  const { rows } = id
    ? await db.query<{ id: string }>(`SELECT id FROM personal_notes WHERE id = $1 AND person_id = $2`, [id, me.person.id])
    // No id: the first note made ("Notes"), so a save from elsewhere always lands in the same place.
    : await db.query<{ id: string }>(`SELECT id FROM personal_notes WHERE person_id = $1 AND deleted_at IS NULL ORDER BY position, created_at LIMIT 1`, [me.person.id]);
  if (!rows[0]) throw notFound('No such note.');
  return rows[0].id;
}

export async function getNote(db: Db, me: Me, id?: string | null): Promise<(Page & { id: string; name: string; createdAt: string; deletedAt: string | null }) | null> {
  if (me.viewingAs) return null;
  const nid = await noteId(db, me, id);
  // A note never saved (made, but nothing written yet) has no saved time, so the editor does not say "Saved".
  const { rows: [r] } = await db.query<{ id: string; name: string; doc: Doc; updated_at: string | Date; prev_at: string | Date | null; created_at: string | Date; deleted_at: string | Date | null; fresh: boolean }>(
    `SELECT id, name, doc, updated_at, prev_at, created_at, deleted_at, updated_at = created_at AS fresh FROM personal_notes WHERE id = $1`, [nid]);
  return { id: r.id, name: r.name, doc: r.doc, updatedAt: r.fresh ? null : iso(r.updated_at), prevAt: iso(r.prev_at), createdAt: iso(r.created_at)!, deletedAt: iso(r.deleted_at) };
}

// The page as it was before today is kept on the first save of a new day, for Restore.
export async function saveNote(db: Db, me: Me, id: string | null | undefined, doc: unknown): Promise<{ updatedAt: string; prevAt: string | null; name: string; preview: string }> {
  assertNotViewing(me);
  const clean = cleanDoc(doc);
  const text = JSON.stringify(clean);
  if (text.length > PAGE_MAX) throw bad('invalid_body', 'The page is too long to save. Move some of it to a Doc and link to it.', 'doc');
  const nid = await noteId(db, me, id);
  const day = `date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata'`;
  // An untitled note takes its first line as its name (Apple Notes style).
  const { rows } = await db.query<{ updated_at: string | Date; prev_at: string | Date | null; name: string; named: boolean }>(
    `UPDATE personal_notes SET
       prev_doc = CASE WHEN updated_at < ${day} THEN doc ELSE prev_doc END,
       prev_at = CASE WHEN updated_at < ${day} THEN updated_at ELSE prev_at END,
       name = CASE WHEN named THEN name ELSE $3 END,
       doc = $2::jsonb, updated_at = now()
     WHERE id = $1 AND deleted_at IS NULL RETURNING updated_at, prev_at, name, named`, [nid, text, firstLine(clean) || UNTITLED]);
  if (!rows[0]) throw bad('invalid_body', 'This note is in Recently Deleted. Recover it to write in it.', 'id');
  return { updatedAt: iso(rows[0].updated_at)!, prevAt: iso(rows[0].prev_at), name: rows[0].name, preview: previewOf(clean, rows[0].named) };
}

export async function restoreNote(db: Db, me: Me, id?: string | null): Promise<Page> {
  assertNotViewing(me);
  const nid = await noteId(db, me, id);
  const { rows } = await db.query<{ doc: Doc; updated_at: string | Date; prev_at: string | Date | null }>(
    `UPDATE personal_notes SET doc = prev_doc, prev_doc = doc, prev_at = updated_at, updated_at = now()
      WHERE id = $1 AND prev_doc IS NOT NULL RETURNING doc, updated_at, prev_at`, [nid]);
  if (!rows[0]) throw notFound('There is no earlier version to restore.');
  return { doc: rows[0].doc, updatedAt: iso(rows[0].updated_at), prevAt: iso(rows[0].prev_at) };
}

const cleanName = (name: string) => {
  const n = name.trim().replace(/\s+/g, ' ');
  if (!n) throw bad('invalid_body', 'Give the note a name.', 'name');
  if (n.length > 80) throw bad('invalid_body', 'A note name holds 80 characters.', 'name');
  return n;
};

// No name (✎): an untitled note whose name follows its first line. With a name: that name, kept.
export async function createNote(db: Db, me: Me, name?: string | null): Promise<NoteMeta> {
  assertNotViewing(me);
  await ensureNotes(db, me);
  const { rows: [c] } = await db.query<{ n: number; pos: number }>(
    `SELECT count(*)::int AS n, COALESCE(max(position), 0)::int AS pos FROM personal_notes WHERE person_id = $1`, [me.person.id]);
  if (c.n >= NOTES_MAX) throw bad('invalid_body', `You have ${NOTES_MAX} notes. Delete one to make another.`, 'name');
  const id = newId('pnt');
  const named = !!name?.trim();
  const nm = named ? cleanName(name!) : UNTITLED;
  const { rows: [r] } = await db.query<{ created_at: string | Date }>(
    `INSERT INTO personal_notes (id, person_id, team_id, name, named, position, doc) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb) RETURNING created_at`,
    [id, me.person.id, me.team.id, nm, named, c.pos + 1, JSON.stringify(EMPTY)]);
  return { id, name: nm, updatedAt: null, createdAt: iso(r.created_at)!, preview: '' };
}

export async function renameNote(db: Db, me: Me, id: string, name: string): Promise<void> {
  assertNotViewing(me);
  const { rows } = await db.query(`UPDATE personal_notes SET name = $3, named = true WHERE id = $1 AND person_id = $2 RETURNING id`, [id, me.person.id, cleanName(name)]);
  if (!rows[0]) throw notFound('No such note.');
}

// Delete (16 Nov, Apple Notes style): a live note moves to Recently Deleted for 30 days; deleting it there, or with
// `forever`, removes it for good. Deleting the only live note leaves an empty "Notes", so there is always one to write in.
export async function deleteNote(db: Db, me: Me, id: string, forever = false): Promise<void> {
  assertNotViewing(me);
  const { rows: [n] } = await db.query<{ deleted_at: string | Date | null }>(`SELECT deleted_at FROM personal_notes WHERE id = $1 AND person_id = $2`, [id, me.person.id]);
  if (!n) throw notFound('No such note.');
  if (forever || n.deleted_at) await db.query(`DELETE FROM personal_notes WHERE id = $1 AND person_id = $2`, [id, me.person.id]);
  else await db.query(`UPDATE personal_notes SET deleted_at = now() WHERE id = $1 AND person_id = $2`, [id, me.person.id]);
  const { rows: [left] } = await db.query(`SELECT 1 FROM personal_notes WHERE person_id = $1 AND deleted_at IS NULL LIMIT 1`, [me.person.id]);
  if (!left) await db.query(`INSERT INTO personal_notes (id, person_id, team_id, name, position, doc) VALUES ($1,$2,$3,'Notes',0,$4::jsonb)`,
    [newId('pnt'), me.person.id, me.team.id, JSON.stringify(EMPTY)]);
}

// Bring a note back from Recently Deleted.
export async function recoverNote(db: Db, me: Me, id: string): Promise<void> {
  assertNotViewing(me);
  const { rows } = await db.query(`UPDATE personal_notes SET deleted_at = NULL WHERE id = $1 AND person_id = $2 AND deleted_at IS NOT NULL RETURNING id`, [id, me.person.id]);
  if (!rows[0]) throw notFound('That note is not in Recently Deleted.');
}

// The single-page calls, kept for anything that still uses them: they mean the first note.
export async function myPage(db: Db, me: Me): Promise<Page | null> { return getNote(db, me); }
export async function savePage(db: Db, me: Me, doc: unknown) { return saveNote(db, me, null, doc); }
export async function restorePage(db: Db, me: Me): Promise<Page> { return restoreNote(db, me); }

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
