import type { Db } from './db';
import type { Me } from './auth';
import { bad, forbidden, notFound } from './errors';
import { checkLinkUrl, LINK_LABEL_MAX } from './links';
import { getProject, projectAccess } from './plan';
import { newId } from './service';

// Key documents on a project (23 Nov, the PM's call, from a teammate's feedback): links to the brief, plan, tracker or a
// Drive folder, at the top of the project page, in the order they were added. A pre-read says so in its name. Everyone
// who can see the project sees them, except that a link marked Nicobar only is kept from a partner. Anyone on the project
// adds one (the PM's call, 23 Nov); whoever added a link, or the project's owner, its lead or an admin, removes it. A
// view-only person or a partner only reads. Google's own sharing still decides who can open the file.
export const PROJECT_LINKS_MAX = 12;
export type ProjectLink = { id: string; url: string; label: string | null; nicobarOnly: boolean; createdBy: string | null; createdAt: string };
type Row = { id: string; url: string; label: string | null; nicobar_only: boolean; created_by: string | null; created_at: string | Date };
const toLink = (r: Row): ProjectLink => ({ id: r.id, url: r.url, label: r.label, nicobarOnly: r.nicobar_only, createdBy: r.created_by, createdAt: new Date(r.created_at).toISOString() });

export async function projectLinks(db: Db, projectId: string, partner: boolean): Promise<ProjectLink[]> {
  const { rows } = await db.query<Row>(
    `SELECT id, url, label, nicobar_only, created_by, created_at FROM project_links WHERE project_id = $1 ${partner ? 'AND NOT nicobar_only' : ''}
     ORDER BY created_at, id`, [projectId]);
  return rows.map(toLink);
}

async function mayAdd(db: Db, me: Me, projectId: string) {
  const p = await getProject(db, projectId);
  if (p.teamId !== me.team.id) throw notFound('No such project.');
  if (p.archivedAt) throw bad('project_archived', 'This project is archived. Restore it before changing it.');
  const access = me.person.appRoles.includes('partner') ? 'view' : await projectAccess(db, p, me.person.id);
  if (access === 'view') throw forbidden('Only the people on this project can add key documents.');
  return { p, full: access === 'full' };
}

export async function addProjectLink(db: Db, me: Me, projectId: string, input: { url: string; label?: string | null; nicobarOnly?: boolean }): Promise<ProjectLink[]> {
  const { p } = await mayAdd(db, me, projectId);
  const ok = checkLinkUrl(input.url);
  if ('error' in ok) throw bad('invalid_body', ok.error, 'url');
  const label = input.label?.trim() || null;
  if (label && label.length > LINK_LABEL_MAX) throw bad('invalid_body', `A name is up to ${LINK_LABEL_MAX} characters.`, 'label');
  await db.transaction(async (tx) => {
    const { rows: [n] } = await tx.query<{ n: number }>(`SELECT count(*)::int AS n FROM project_links WHERE project_id = $1`, [projectId]);
    if (n.n >= PROJECT_LINKS_MAX) throw bad('invalid_body', `A project holds up to ${PROJECT_LINKS_MAX} key documents. Remove one first.`, 'url');
    await tx.query(`INSERT INTO project_links (id, project_id, url, label, nicobar_only, created_by) VALUES ($1,$2,$3,$4,$5,$6)`,
      [newId('plk'), projectId, ok.url, label, !!input.nicobarOnly && !!p.partnerName, me.person.id]);
  });
  return projectLinks(db, projectId, false);
}

export async function removeProjectLink(db: Db, me: Me, projectId: string, linkId: string): Promise<ProjectLink[]> {
  const { full } = await mayAdd(db, me, projectId);
  const { rows: [l] } = await db.query<{ created_by: string | null }>(`SELECT created_by FROM project_links WHERE id = $1 AND project_id = $2`, [linkId, projectId]);
  if (!l) throw notFound('No such link.');
  if (!full && l.created_by !== me.person.id) throw forbidden('Only whoever added it, or the project owner or lead, can remove this link.');
  await db.query(`DELETE FROM project_links WHERE id = $1`, [linkId]);
  return projectLinks(db, projectId, false);
}
