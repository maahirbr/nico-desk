import type { Me } from './auth';
import type { Db, Tx } from './db';
import { bad, forbidden, notFound } from './errors';
import { assertNotViewing } from './http';
import { via } from './origin';
import { newId } from './service';
import { seesProject, seesTaskRow, sightOf, type Sight } from './sight';
import { today as todayIst } from './time';
import { projectFor, sightFor, taskFor } from './visibility';

// Comments on a task or a project, with @person, #task and #project (workstream 5, 13 Oct).
//
// The body is stored with tokens: "Ask [[person:per_ada]] about [[task:tsk_x]]". The picker in the browser writes them,
// and the same text is checked again here. comment_refs holds the ids, so a mention never depends on a name matching.
// Whoever can see the task or project can comment. Only the author edits or removes a comment, and a removed one keeps its
// row with an empty body, so the thread reads "Comment removed". A reference is shown by title only to a reader who can
// see that item; to anyone else it reads "a hidden item".

export const COMMENT_MAX = 2000;
export type SubjectKind = 'task' | 'project';
export type RefKind = 'person' | 'task' | 'project';
type Ref = { kind: RefKind; id: string };

export type Part =
  | { t: 'text'; text: string }
  | { t: 'person'; id: string; name: string }
  | { t: 'task'; id: string; title: string }
  | { t: 'project'; id: string; name: string }
  | { t: 'hidden' };

export type CommentView = {
  id: string; subjectKind: SubjectKind; subjectId: string; authorId: string; authorName: string;
  createdAt: string; editedAt: string | null; deleted: boolean; mine: boolean;
  via: 'claude' | null; // written through the MCP server (lib/origin.ts)
  parts: Part[];
  body: string | null; // the stored text with tokens, for the author only, to edit
};
// Who was told about a mention and has an address, so the writer can open a Gmail draft. Nothing is sent from here.
export type MailTarget = { personId: string; name: string; to: string };
export type CommentResult = { comment: CommentView; mail: MailTarget[] };

const TOKEN = /\[\[(person|task|project):([A-Za-z0-9_-]{1,80})\]\]/g;

export function refsIn(body: string): Ref[] {
  const seen = new Set<string>();
  const out: Ref[] = [];
  for (const m of body.matchAll(TOKEN)) {
    const k = `${m[1]}:${m[2]}`;
    if (!seen.has(k)) { seen.add(k); out.push({ kind: m[1] as RefKind, id: m[2] }); }
  }
  return out;
}

type Row = { id: string; subject_kind: SubjectKind; subject_id: string; author_id: string; body: string; created_at: string; edited_at: string | null; deleted_at: string | null; author_name: string; via: 'claude' | null };
const COMMENT_SQL = `SELECT c.*, COALESCE(p.nickname, p.display_name) AS author_name FROM comments c JOIN people p ON p.id = c.author_id`;

// The label each reference shows for this reader, or null when they may not see it.
async function labels(tx: Tx, me: Me, sight: Sight, refs: Ref[]): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  const key = (r: Ref) => `${r.kind}:${r.id}`;
  const ids = (k: RefKind) => [...new Set(refs.filter((r) => r.kind === k).map((r) => r.id))];
  if (ids('person').length) {
    const { rows } = await tx.query<{ id: string; display_name: string }>(
      `SELECT p.id, COALESCE(p.nickname, p.display_name) AS display_name FROM people p WHERE p.id = ANY($1) AND p.id IN (SELECT person_id FROM team_members WHERE team_id = $2)`, [ids('person'), me.team.id]);
    for (const r of rows) out.set(`person:${r.id}`, r.display_name);
  }
  if (ids('task').length) {
    const { rows } = await tx.query<{ id: string; title: string; team_id: string; project_id: string | null; owner_id: string; created_by: string | null; blocked_on_id: string | null }>(
      `SELECT id, title, team_id, project_id, owner_id, created_by, blocked_on_id FROM tasks WHERE id = ANY($1)`, [ids('task')]);
    for (const r of rows) if (r.team_id === me.team.id && seesTaskRow(sight, r)) out.set(`task:${r.id}`, r.title);
  }
  if (ids('project').length) {
    const { rows } = await tx.query<{ id: string; name: string; team_id: string }>(`SELECT id, name, team_id FROM projects WHERE id = ANY($1)`, [ids('project')]);
    for (const r of rows) if (r.team_id === me.team.id && seesProject(sight, r.id)) out.set(`project:${r.id}`, r.name);
  }
  for (const r of refs) if (!out.has(key(r))) out.set(key(r), null);
  return out;
}

function partsOf(body: string, names: Map<string, string | null>): Part[] {
  const parts: Part[] = [];
  let at = 0;
  for (const m of body.matchAll(TOKEN)) {
    if (m.index! > at) parts.push({ t: 'text', text: body.slice(at, m.index) });
    const kind = m[1] as RefKind;
    const label = names.get(`${kind}:${m[2]}`);
    if (label == null) parts.push({ t: 'hidden' });
    else if (kind === 'person') parts.push({ t: 'person', id: m[2], name: label });
    else if (kind === 'task') parts.push({ t: 'task', id: m[2], title: label });
    else parts.push({ t: 'project', id: m[2], name: label });
    at = m.index! + m[0].length;
  }
  if (at < body.length) parts.push({ t: 'text', text: body.slice(at) });
  return parts;
}

// The comment as plain words, for search: a reference becomes its label, and one the reader may not see becomes nothing.
export function plainOf(body: string, label: (kind: RefKind, id: string) => string | null): string {
  return body.replace(TOKEN, (_m, kind: RefKind, id: string) => label(kind, id) ?? '').replace(/\s+/g, ' ').trim();
}

async function views(tx: Tx, me: Me, sight: Sight, rows: Row[]): Promise<CommentView[]> {
  const names = await labels(tx, me, sight, rows.flatMap((r) => (r.deleted_at ? [] : refsIn(r.body))));
  return rows.map((r) => {
    const deleted = !!r.deleted_at;
    const mine = r.author_id === me.person.id;
    return {
      id: r.id, subjectKind: r.subject_kind, subjectId: r.subject_id, authorId: r.author_id, authorName: r.author_name,
      createdAt: r.created_at, editedAt: r.edited_at, deleted, mine, via: r.via ?? null,
      parts: deleted ? [] : partsOf(r.body, names), body: mine && !deleted ? r.body : null,
    };
  });
}

// Hidden and missing both read as 404, like the task or project itself.
async function assertSees(tx: Tx, me: Me, kind: SubjectKind, id: string): Promise<void> {
  if (kind === 'task') await taskFor(tx, me, id);
  else await projectFor(tx, me, id);
}

export async function listComments(db: Db, me: Me, kind: SubjectKind, subjectId: string): Promise<CommentView[]> {
  await assertSees(db, me, kind, subjectId);
  const { rows } = await db.query<Row>(`${COMMENT_SQL} WHERE c.subject_kind = $1 AND c.subject_id = $2 ORDER BY c.created_at, c.id`, [kind, subjectId]);
  return views(db, me, await sightFor(db, me), rows);
}

// A reference the writer cannot see is refused, with the same words as one that does not exist.
async function checkBody(tx: Tx, me: Me, sight: Sight, raw: string): Promise<{ body: string; refs: Ref[] }> {
  const body = raw.trim();
  if (body.length < 1 || body.length > COMMENT_MAX) throw bad('invalid_body', `A comment is 1 to ${COMMENT_MAX} characters.`, 'body');
  const refs = refsIn(body);
  const names = await labels(tx, me, sight, refs);
  if (refs.some((r) => names.get(`${r.kind}:${r.id}`) == null)) throw bad('invalid_ref', 'One of the @ or # items is not available. Pick it again.', 'body');
  return { body, refs };
}

// Tells each newly mentioned person, unless they cannot see the task or project or are the writer. The notice has no task:
// comment_id points at the comment, and the comment at its subject.
async function notifyMentions(tx: Tx, me: Me, kind: SubjectKind, subjectId: string, commentId: string, personIds: string[]): Promise<MailTarget[]> {
  const mail: MailTarget[] = [];
  const subject = kind === 'task'
    ? (await tx.query<{ project_id: string | null; owner_id: string; created_by: string | null; blocked_on_id: string | null }>(
        `SELECT project_id, owner_id, created_by, blocked_on_id FROM tasks WHERE id = $1`, [subjectId])).rows[0]
    : null;
  for (const pid of new Set(personIds)) {
    if (pid === me.person.id) continue;
    const { rows } = await tx.query<{ display_name: string; email: string; contact_email: string | null }>(
      `SELECT COALESCE(p.nickname, p.display_name) AS display_name, p.email, p.contact_email FROM people p
       WHERE p.id = $1 AND p.active AND p.id IN (SELECT person_id FROM team_members WHERE team_id = $2)`, [pid, me.team.id]);
    if (!rows[0]) continue;
    const sight = await sightOf(tx, me.team.id, pid);
    if (kind === 'task' ? !subject || !seesTaskRow(sight, subject) : !seesProject(sight, subjectId)) continue;
    await tx.query(
      `INSERT INTO notices (id, person_id, task_id, comment_id, kind, for_date, created_at) VALUES ($1,$2,NULL,$3,'mentioned',$4,now())`,
      [newId('ntc'), pid, commentId, todayIst()]);
    const p = rows[0];
    const to = p.contact_email ?? (p.email.endsWith('@example.test') ? null : p.email);
    if (to) mail.push({ personId: pid, name: p.display_name, to });
  }
  return mail;
}

export async function addComment(db: Db, me: Me, kind: SubjectKind, subjectId: string, raw: string): Promise<CommentResult> {
  assertNotViewing(me);
  return db.transaction(async (tx) => {
    await assertSees(tx, me, kind, subjectId);
    const sight = await sightFor(tx, me);
    const { body, refs } = await checkBody(tx, me, sight, raw);
    const id = newId('cmt');
    await tx.query(`INSERT INTO comments (id, subject_kind, subject_id, author_id, body, via) VALUES ($1,$2,$3,$4,$5,$6)`, [id, kind, subjectId, me.person.id, body, via.getStore() ?? null]);
    for (const r of refs) await tx.query(`INSERT INTO comment_refs (comment_id, ref_kind, ref_id) VALUES ($1,$2,$3)`, [id, r.kind, r.id]);
    const mail = await notifyMentions(tx, me, kind, subjectId, id, refs.filter((r) => r.kind === 'person').map((r) => r.id));
    const { rows } = await tx.query<Row>(`${COMMENT_SQL} WHERE c.id = $1`, [id]);
    return { comment: (await views(tx, me, sight, rows))[0], mail };
  });
}

// Loads a comment the reader may see, then lets only its author through.
async function ownComment(tx: Tx, me: Me, id: string): Promise<Row> {
  const { rows } = await tx.query<Row>(`${COMMENT_SQL} WHERE c.id = $1 FOR UPDATE OF c`, [id]);
  const row = rows[0];
  if (!row) throw notFound('No such comment.');
  await assertSees(tx, me, row.subject_kind, row.subject_id);
  if (row.deleted_at) throw notFound('No such comment.');
  if (row.author_id !== me.person.id) throw forbidden('Only the author can change a comment.');
  return row;
}

export async function editComment(db: Db, me: Me, id: string, raw: string): Promise<CommentResult> {
  assertNotViewing(me);
  return db.transaction(async (tx) => {
    const row = await ownComment(tx, me, id);
    const sight = await sightFor(tx, me);
    const { body, refs } = await checkBody(tx, me, sight, raw);
    const { rows: before } = await tx.query<{ ref_kind: RefKind; ref_id: string }>(`SELECT ref_kind, ref_id FROM comment_refs WHERE comment_id = $1`, [id]);
    const had = new Set(before.filter((r) => r.ref_kind === 'person').map((r) => r.ref_id));
    await tx.query(`UPDATE comments SET body = $2, edited_at = now() WHERE id = $1`, [id, body]);
    await tx.query(`DELETE FROM comment_refs WHERE comment_id = $1`, [id]);
    for (const r of refs) await tx.query(`INSERT INTO comment_refs (comment_id, ref_kind, ref_id) VALUES ($1,$2,$3)`, [id, r.kind, r.id]);
    // Only people added by this edit are told; someone already mentioned is not told again.
    const mail = await notifyMentions(tx, me, row.subject_kind, row.subject_id, id, refs.filter((r) => r.kind === 'person' && !had.has(r.id)).map((r) => r.id));
    const { rows } = await tx.query<Row>(`${COMMENT_SQL} WHERE c.id = $1`, [id]);
    return { comment: (await views(tx, me, sight, rows))[0], mail };
  });
}

export async function deleteComment(db: Db, me: Me, id: string): Promise<void> {
  assertNotViewing(me);
  await db.transaction(async (tx) => {
    await ownComment(tx, me, id);
    await tx.query(`UPDATE comments SET body = '', deleted_at = now() WHERE id = $1`, [id]);
    await tx.query(`DELETE FROM comment_refs WHERE comment_id = $1`, [id]);
  });
}

// ---------- mentions on Home ----------

export type Mention = { noticeId: string; commentId: string; byName: string; subjectKind: SubjectKind; subjectId: string; subjectTitle: string; snippet: string; createdAt: string };

// Unread "mentioned" notices whose comment still stands and whose task or project this person still sees.
export async function listMentions(db: Db, me: Me): Promise<Mention[]> {
  const { rows } = await db.query<{ notice_id: string; created_at: string } & Row>(
    `SELECT n.id AS notice_id, c.*, COALESCE(p.nickname, p.display_name) AS author_name FROM notices n
     JOIN comments c ON c.id = n.comment_id JOIN people p ON p.id = c.author_id
     WHERE n.person_id = $1 AND n.kind = 'mentioned' AND n.read_at IS NULL AND c.deleted_at IS NULL
     ORDER BY n.created_at DESC LIMIT 50`, [me.person.id]);
  const sight = await sightFor(db, me);
  const seen = new Map<string, string | null>();
  const out: Mention[] = [];
  const vs = await views(db, me, sight, rows);
  for (let i = 0; i < rows.length; i++) {
    const v = vs[i];
    const key = `${v.subjectKind}:${v.subjectId}`;
    if (!seen.has(key)) {
      const l = await labels(db, me, sight, [{ kind: v.subjectKind, id: v.subjectId }]);
      seen.set(key, l.get(key) ?? null);
    }
    const title = seen.get(key);
    if (title == null) continue;
    const text = v.parts.map((p) => (p.t === 'text' ? p.text : p.t === 'person' ? `@${p.name}` : p.t === 'task' ? `#${p.title}` : p.t === 'project' ? `#${p.name}` : 'a hidden item')).join('');
    out.push({
      noticeId: rows[i].notice_id, commentId: v.id, byName: v.authorName, subjectKind: v.subjectKind, subjectId: v.subjectId, subjectTitle: title,
      snippet: text.length > 140 ? `${text.slice(0, 137)}...` : text, createdAt: v.createdAt,
    });
  }
  return out;
}
